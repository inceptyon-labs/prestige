use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use base64::Engine as _;
use serde::Serialize;
use tokio::io::AsyncWriteExt;
use tokio::process::Command as TokioCommand;

/// Whitelist of AI CLI binaries we'll spawn. Mirrors the user-facing provider
/// list — keep in sync with src/lib/ai/provider.ts. We refuse to launch
/// anything else so we don't become a general-purpose shell-out.
///
/// `uv` is included to power the Nano Banana Pro image-generation wrapper
/// (`uv run ~/.codex/skills/nano-banana-pro/scripts/generate_image.py ...`).
const ALLOWED_AI_BINARIES: &[&str] = &["claude", "codex", "gemini", "uv"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiCliResult {
    stdout: String,
    stderr: String,
    /// Process exit code, if any. None on signal-kill.
    code: Option<i32>,
    duration_ms: u64,
}

/// Run an AI CLI as a subprocess with a prompt piped over stdin.
///
/// Why this exists instead of using @tauri-apps/plugin-shell:
/// the plugin's JS Child handle has no way to *close* stdin — it can only
/// write to it. AI CLIs read until EOF, so without a close we hang until
/// timeout. Doing it natively lets us drop stdin cleanly.
#[tauri::command]
async fn run_ai_cli(
    binary: String,
    args: Vec<String>,
    prompt: String,
    timeout_ms: u64,
    env: Option<Vec<(String, String)>>,
    cwd: Option<String>,
) -> Result<AiCliResult, String> {
    if !ALLOWED_AI_BINARIES.contains(&binary.as_str()) {
        return Err(format!(
            "Refusing to spawn '{}'. Allowed: {:?}",
            binary, ALLOWED_AI_BINARIES
        ));
    }

    let started = Instant::now();
    let mut cmd = TokioCommand::new(&binary);
    cmd.args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    if let Some(extra_env) = env {
        for (k, v) in extra_env {
            cmd.env(k, v);
        }
    }
    // Restrict cwd to /tmp/prestige so a misbehaving CLI can't be coerced
    // into writing arbitrary files via this command.
    if let Some(dir) = cwd {
        if !dir.starts_with("/tmp/prestige") {
            return Err(format!(
                "Refusing cwd outside /tmp/prestige: {}",
                dir
            ));
        }
        cmd.current_dir(&dir);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", binary, e))?;

    // Write the prompt and explicitly drop stdin so the CLI sees EOF.
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to {} stdin: {}", binary, e))?;
        // Dropping `stdin` here closes the pipe, signaling EOF to the child.
    }

    let output = match tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        child.wait_with_output(),
    )
    .await
    {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => return Err(format!("{} wait failed: {}", binary, e)),
        Err(_) => return Err(format!("{} timed out after {}ms", binary, timeout_ms)),
    };

    let duration_ms = started.elapsed().as_millis() as u64;
    Ok(AiCliResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        code: output.status.code(),
        duration_ms,
    })
}

/// Files we look for when the user points at a project folder as the AI
/// "brand context" reference. The order roughly matches how informative
/// each file is for ASO copywriting.
const BRAND_FILES: &[&str] = &[
    "brand.md",
    "BRAND.md",
    "design.md",
    "DESIGN.md",
    "brand.json",
    "README.md",
    "package.json",
    "app.json",
    "tailwind.config.ts",
    "tailwind.config.js",
];

/// Per-file size cap so a giant README can't blow up the AI prompt token
/// budget. Tuned to ~50 KB; matches the AI tier we're targeting (subscription
/// CLIs, multi-thousand token context windows but not infinite).
const MAX_FILE_BYTES: u64 = 50 * 1024;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct BrandFolderContents {
    /// Absolute path that was read.
    root: String,
    /// Map of file name → text content. Only includes files that were found
    /// and small enough to read.
    files: std::collections::BTreeMap<String, String>,
    /// Names of files that exist but were skipped because they exceeded
    /// MAX_FILE_BYTES.
    skipped_oversize: Vec<String>,
}

#[tauri::command]
async fn read_brand_folder(path: String) -> Result<BrandFolderContents, String> {
    let root = PathBuf::from(&path);

    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut out = BrandFolderContents {
        root: root.to_string_lossy().to_string(),
        ..Default::default()
    };

    for name in BRAND_FILES {
        let file_path = root.join(name);
        if !file_path.exists() {
            continue;
        }
        match read_brand_file(&file_path) {
            Ok(BrandFileResult::Ok(text)) => {
                out.files.insert((*name).to_string(), text);
            }
            Ok(BrandFileResult::Oversize) => {
                out.skipped_oversize.push((*name).to_string());
            }
            Err(err) => {
                // Don't fail the whole call for one unreadable file; just log
                // to stderr in dev and skip it.
                eprintln!("Failed to read {}: {}", file_path.display(), err);
            }
        }
    }

    Ok(out)
}

enum BrandFileResult {
    Ok(String),
    Oversize,
}

fn read_brand_file(path: &Path) -> Result<BrandFileResult, std::io::Error> {
    let metadata = std::fs::metadata(path)?;
    if metadata.len() > MAX_FILE_BYTES {
        return Ok(BrandFileResult::Oversize);
    }
    let text = std::fs::read_to_string(path)?;
    Ok(BrandFileResult::Ok(text))
}

/// Write a data URL (typically a screenshot pasted into the editor) to a
/// temporary file and return its absolute path. Used by the vision AI flow
/// so we can pass the screenshot to a CLI subprocess as a real file path
/// — CLIs don't accept inline base64 the way SDKs do.
///
/// Files land in the OS temp dir prefixed with "prestige-screenshot-" so
/// they're easy to identify and the OS will sweep them eventually.
#[tauri::command]
async fn write_temp_image(data_url: String) -> Result<String, String> {
    // data:image/png;base64,XXXX
    let comma = data_url
        .find(',')
        .ok_or_else(|| "Invalid data URL: no comma found".to_string())?;
    let header = &data_url[..comma];
    let payload = &data_url[comma + 1..];

    // Derive a file extension from the mime type — we only care about the
    // /<subtype> portion. Default to .png since that's overwhelmingly what
    // the editor produces.
    let extension = if header.contains("image/jpeg") || header.contains("image/jpg") {
        "jpg"
    } else if header.contains("image/webp") {
        "webp"
    } else if header.contains("image/gif") {
        "gif"
    } else {
        "png"
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| format!("Failed to base64-decode image data: {}", e))?;

    // Write to /tmp/prestige/ instead of std::env::temp_dir() (which on macOS
    // resolves to /var/folders/... per-user paths). A predictable /tmp/prestige
    // dir lets us grant Claude's Read tool a single `--add-dir /tmp` scope.
    let mut dir = PathBuf::from("/tmp/prestige");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create temp dir {}: {}", dir.display(), e))?;

    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let unique = format!(
        "screenshot-{}-{}.{}",
        std::process::id(),
        nanos,
        extension,
    );
    dir.push(unique);

    std::fs::write(&dir, bytes)
        .map_err(|e| format!("Failed to write temp file {}: {}", dir.display(), e))?;
    Ok(dir.to_string_lossy().to_string())
}

/// Prepare a workspace dir + filename for an AI image generation run.
///
/// Both nano-banana-pro (uv-driven Python script) and codex's image tool
/// expect to write a PNG to a path. We centralize the dir under
/// /tmp/prestige/image-gen so cwd-restriction in `run_ai_cli` and the
/// matching `read_generated_image` reader can rely on a known prefix.
///
/// Returns:
///   workspace: absolute dir path (caller passes this as `cwd`)
///   filename:  unique filename inside workspace (caller passes this as the
///              CLI's --filename / output path)
///   absPath:   workspace + "/" + filename — convenient for the reader
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageGenWorkspace {
    workspace: String,
    filename: String,
    abs_path: String,
}

#[tauri::command]
async fn prepare_image_gen_workspace() -> Result<ImageGenWorkspace, String> {
    let workspace = PathBuf::from("/tmp/prestige/image-gen");
    std::fs::create_dir_all(&workspace)
        .map_err(|e| format!("Failed to create {}: {}", workspace.display(), e))?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let filename = format!("gen-{}-{}.png", std::process::id(), nanos);
    let abs_path = workspace.join(&filename);
    Ok(ImageGenWorkspace {
        workspace: workspace.to_string_lossy().to_string(),
        filename,
        abs_path: abs_path.to_string_lossy().to_string(),
    })
}

/// Read an AI-generated image file and return it as a data URL.
///
/// Restricted to paths under /tmp/prestige/image-gen so this can't be used
/// as a generic arbitrary-file reader from the webview. Caps file size at
/// 30 MB which is generous for 4K PNGs from the image-gen tools we support.
#[tauri::command]
async fn read_generated_image(path: String) -> Result<String, String> {
    if !path.starts_with("/tmp/prestige/image-gen/") {
        return Err(format!(
            "Refusing to read outside /tmp/prestige/image-gen: {}",
            path
        ));
    }
    let buf = PathBuf::from(&path);
    let metadata = std::fs::metadata(&buf)
        .map_err(|e| format!("Failed to stat {}: {}", path, e))?;
    const MAX_IMAGE_BYTES: u64 = 30 * 1024 * 1024;
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(format!(
            "Generated image {} is too large ({} bytes)",
            path,
            metadata.len()
        ));
    }
    let bytes = std::fs::read(&buf)
        .map_err(|e| format!("Failed to read {}: {}", path, e))?;
    let mime = match buf.extension().and_then(|e| e.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "image/png",
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_brand_folder,
            run_ai_cli,
            write_temp_image,
            prepare_image_gen_workspace,
            read_generated_image,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
