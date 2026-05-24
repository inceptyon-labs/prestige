/**
 * Fetch available model ids from each provider's API.
 *
 * Eliminates hardcoded model lists that go stale within months. The user
 * pastes an API key in settings, clicks "Refresh", and gets the actual
 * current models the API will accept.
 *
 * Each function returns the raw model ids as the provider names them, in
 * the order the provider returns them. The SettingsModal applies its own
 * filtering / grouping on top (e.g. exclude vision-only models, sort by
 * tier).
 */

interface AnthropicModelsResp {
  data?: { id?: string }[];
  error?: { message?: string };
}

interface OpenAIModelsResp {
  data?: { id?: string }[];
  error?: { message?: string };
}

interface GeminiModelsResp {
  models?: {
    name?: string;
    supportedGenerationMethods?: string[];
  }[];
  error?: { message?: string };
}

export const listClaudeModels = async (apiKey: string): Promise<string[]> => {
  if (!apiKey.trim()) throw new Error("Anthropic API key required.");
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  }
  const payload = (await res.json()) as AnthropicModelsResp;
  if (payload.error?.message) throw new Error(payload.error.message);
  return (payload.data ?? [])
    .map((m) => m.id)
    .filter((s): s is string => typeof s === "string");
};

// OpenAI's /v1/models returns 100+ entries including embeddings, audio
// (whisper/tts), image (dall-e), and legacy completion models. Filter to
// what's actually usable as a chat model for Prestige.
const OPENAI_CHAT_RE = /^(gpt-|o\d|chatgpt-)/i;
const OPENAI_EXCLUDE_RE =
  /(embedding|whisper|tts|dall-e|audio|image|moderation|babbage|davinci|realtime|search|transcribe|instruct)/i;

export const listOpenAIModels = async (apiKey: string): Promise<string[]> => {
  if (!apiKey.trim()) throw new Error("OpenAI API key required.");
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const payload = (await res.json()) as OpenAIModelsResp;
  if (payload.error?.message) throw new Error(payload.error.message);
  return (payload.data ?? [])
    .map((m) => m.id)
    .filter((s): s is string => typeof s === "string")
    .filter((id) => OPENAI_CHAT_RE.test(id) && !OPENAI_EXCLUDE_RE.test(id))
    .sort();
};

// Gemini exposes embedding / TTS / image-only models alongside chat. Keep
// only generateContent-capable text/multimodal ones for the text picker.
const GEMINI_EXCLUDE_RE = /(embedding|aqa|tts|image|imagen|veo|audio)/i;

/** Internal: fetch all Gemini models with their capabilities. */
const fetchGeminiModels = async (
  apiKey: string,
): Promise<{ name: string; methods: string[] }[]> => {
  if (!apiKey.trim()) throw new Error("Gemini API key required.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  const payload = (await res.json()) as GeminiModelsResp;
  if (payload.error?.message) throw new Error(payload.error.message);
  return (payload.models ?? [])
    .map((m) => ({
      name: (m.name ?? "").replace(/^models\//, ""),
      methods: m.supportedGenerationMethods ?? [],
    }))
    .filter((m) => m.name);
};

/**
 * Gemini text models (chat / instruction generation). Excludes image,
 * embedding, audio variants.
 */
export const listGeminiModels = async (apiKey: string): Promise<string[]> => {
  const all = await fetchGeminiModels(apiKey);
  return all
    .filter((m) => m.methods.includes("generateContent"))
    .map((m) => m.name)
    .filter((id) => !GEMINI_EXCLUDE_RE.test(id))
    .sort();
};

/**
 * Gemini image-generation models. Picks anything with "image" / "imagen"
 * in the id (preview chat-with-image models AND Imagen predict-endpoint
 * models). The image picker in settings uses this so the user sees
 * whatever the API actually offers their account.
 */
export const listGeminiImageModels = async (
  apiKey: string,
): Promise<string[]> => {
  const all = await fetchGeminiModels(apiKey);
  return all
    .filter((m) =>
      /(image|imagen)/i.test(m.name) &&
      (m.methods.includes("generateContent") || m.methods.includes("predict")),
    )
    .map((m) => m.name)
    .sort();
};
