# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in Prestige, please **do not open a public issue**. Instead, report it privately so we can investigate and ship a fix before details are disclosed.

Send a report to **jnew00@gmail.com** with:

- A description of the issue
- Steps to reproduce (or a proof-of-concept)
- The affected version / commit SHA
- Your assessment of the impact

You can expect an acknowledgment within 72 hours and a status update within 7 days.

## Scope

Prestige is a local desktop / browser tool. Of particular interest:

- The Tauri command surface in `src-tauri/src/lib.rs` (subprocess spawning, file reads/writes)
- Path-traversal or arbitrary-file-read paths via the AI image-gen workspace
- XSS in user-controlled rich text rendering (`src/components/RichTextEditor/`)
- Issues that escape the `/tmp/prestige` cwd restriction for spawned CLIs

Out of scope:
- Anything requiring local code execution or filesystem access already granted by the user
- Reports against unsupported third-party CLIs (claude, codex, gemini, uv) themselves

## Supported Versions

Pre-1.0 — only the latest commit on `master` is supported.

## Disclosure

Once a fix is released we'll publish a brief advisory in the repo. We're happy to credit you in the advisory (or keep your report anonymous — your call).
