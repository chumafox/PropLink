// BYOK translation layer.
// Provider families:
//  - OpenAI-compatible chat completions: openai, moonshot, deepseek,
//    openrouter, ollama, lmstudio, custom (any base URL)
//  - Anthropic Messages API: anthropic
import type { AiProvider } from "../../db/schema";

export interface AiConfig {
  provider: AiProvider;
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
}

const DEFAULT_BASE_URLS: Record<AiProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  moonshot: "https://api.moonshot.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
  custom: "",
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  moonshot: "moonshot-v1-8k",
  deepseek: "deepseek-v4-flash",
  openrouter: "openai/gpt-4o-mini",
  ollama: "llama3.1",
  lmstudio: "local-model",
  custom: "",
};

export function resolveConfig(cfg: AiConfig) {
  const baseUrl = (cfg.baseUrl?.trim() || DEFAULT_BASE_URLS[cfg.provider]).replace(/\/+$/, "");
  const model = cfg.model?.trim() || DEFAULT_MODELS[cfg.provider];
  return { baseUrl, model };
}

export function maskApiKey(key?: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
  pt: "Portuguese",
  zh: "Chinese",
  ko: "Korean",
  ja: "Japanese",
  de: "German",
  fr: "French",
  it: "Italian",
  uk: "Ukrainian",
  ar: "Arabic",
  hi: "Hindi",
  vi: "Vietnamese",
  tr: "Turkish",
  pl: "Polish",
};

export function langName(code: string): string {
  return LANG_NAMES[code] ?? code;
}

function buildPrompt(text: string, targetLang: string): string {
  return `Translate the following real-estate chat message into ${langName(targetLang)}. ` +
    `Keep names, addresses, numbers, prices, dates and legal terms accurate. ` +
    `Preserve line breaks and tone. Return ONLY the translated text, no explanations.\n\n${text}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function translateOpenAiCompatible(
  cfg: AiConfig,
  text: string,
  targetLang: string,
): Promise<string> {
  const { baseUrl, model } = resolveConfig(cfg);
  if (!baseUrl) throw new Error("Base URL is required for this provider");
  if (!model) throw new Error("Model is required");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a precise translation engine for real-estate messaging." },
        { role: "user", content: buildPrompt(text, targetLang) },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${cfg.provider} API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const out = data?.choices?.[0]?.message?.content;
  if (typeof out !== "string" || !out.trim()) throw new Error("Empty translation from provider");
  return out.trim();
}

async function translateAnthropic(
  cfg: AiConfig,
  text: string,
  targetLang: string,
): Promise<string> {
  const { baseUrl, model } = resolveConfig(cfg);
  if (!cfg.apiKey) throw new Error("API key is required for Anthropic");
  const res = await fetchWithTimeout(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: "You are a precise translation engine for real-estate messaging.",
      messages: [{ role: "user", content: buildPrompt(text, targetLang) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const out = data?.content?.[0]?.text;
  if (typeof out !== "string" || !out.trim()) throw new Error("Empty translation from Anthropic");
  return out.trim();
}

export async function getModels(cfg: AiConfig): Promise<string[]> {
  const { baseUrl } = resolveConfig(cfg);
  if (!baseUrl) throw new Error("Base URL is required to fetch models");
  
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  
  if (cfg.provider === "anthropic") {
    throw new Error("Fetching models for Anthropic is not supported via this generic endpoint.");
  }

  const res = await fetchWithTimeout(`${baseUrl}/models`, { method: "GET", headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch models: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  if (Array.isArray(data?.data)) {
    return data.data.map((m: any) => m.id).sort();
  }
  if (Array.isArray(data?.models)) {
    return data.models.map((m: any) => m.name || m.id).sort();
  }
  throw new Error("Unrecognized models format from provider");
}

export async function translateText(
  cfg: AiConfig,
  text: string,
  targetLang: string,
): Promise<string> {
  if (!text.trim()) return text;
  if (cfg.provider === "anthropic") return translateAnthropic(cfg, text, targetLang);
  return translateOpenAiCompatible(cfg, text, targetLang);
}

// Cheap check used by "Test connection": translate a tiny phrase.
export async function testConnection(cfg: AiConfig, targetLang: string): Promise<string> {
  return translateText(cfg, "Hello, this property is still available.", targetLang);
}
