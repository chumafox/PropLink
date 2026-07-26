import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bot, KeyRound, Loader2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", hint: "api.openai.com — gpt-4o-mini, gpt-4o…" },
  { id: "anthropic", label: "Anthropic", hint: "Claude — claude-3-5-haiku…" },
  { id: "moonshot", label: "Kimi / Moonshot", hint: "api.moonshot.ai — moonshot-v1-8k…" },
  { id: "deepseek", label: "DeepSeek", hint: "api.deepseek.com — deepseek-chat" },
  { id: "openrouter", label: "OpenRouter", hint: "One key, hundreds of models" },
  { id: "ollama", label: "Ollama (local)", hint: "Your hardware — llama3.1, qwen…" },
  { id: "lmstudio", label: "LM Studio (local)", hint: "Local server on :1234" },
  { id: "custom", label: "Custom (OpenAI-compatible)", hint: "Any compatible endpoint" },
] as const;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "uk", label: "Українська" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tr", label: "Türkçe" },
];

export function AiBotTab() {
  const utils = trpc.useUtils();
  const settings = trpc.ai.getSettings.useQuery();

  const [provider, setProvider] = useState<string>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[] | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setProvider(s.provider);
    setBaseUrl(s.baseUrl ?? "");
    setModel(s.model ?? "");
    setTargetLanguage(s.targetLanguage ?? "en");
    setAutoTranslate(s.autoTranslate);
  }, [settings.data]);

  const save = trpc.ai.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("AI bot settings saved");
      setApiKey("");
      utils.ai.getSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.ai.deleteSettings.useMutation({
    onSuccess: () => {
      toast.success("AI bot disconnected");
      setApiKey("");
      setBaseUrl("");
      setModel("");
      setTestResult(null);
      utils.ai.getSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const test = trpc.ai.testConnection.useMutation({
    onSuccess: (r) => setTestResult(r.sample),
    onError: (e) => {
      setTestResult(null);
      toast.error(e.message);
    },
  });

  const fetchModels = trpc.ai.getModels.useMutation({
    onSuccess: (r) => {
      console.log("[AiBot] Models loaded successfully:", r.models);
      setAvailableModels(r.models);
      toast.success("Models loaded successfully");
    },
    onError: (e) => {
      console.error("[AiBot] Failed to load models:", e.message);
      toast.error(e.message);
    },
  });

  const s = settings.data;
  const isLocal = provider === "ollama" || provider === "lmstudio";

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> AI Translator (BYOK)
          </CardTitle>
          <CardDescription>
            Bring your own API key — PropLink never pays for your tokens and
            never sees your bill. Incoming messages can be translated into your
            language using your own provider or even a model running on your
            own machine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PROVIDERS.find((p) => p.id === provider)?.hint}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> API key
            </Label>
            <Input
              type="password"
              placeholder={
                s?.hasKey
                  ? `Saved: ${s.maskedKey} — paste a new one to replace`
                  : isLocal
                    ? "Usually not required for local models"
                    : "sk-..."
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {isLocal && (
              <p className="text-xs text-amber-600">
                Note: the PropLink server must be able to reach your machine.
                localhost URLs won't work from the cloud — expose Ollama/LM
                Studio through a tunnel (e.g. Tailscale Funnel) and paste the
                public URL below.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input
                placeholder={
                  provider === "custom"
                    ? "https://your-endpoint/v1"
                    : "Leave empty for provider default"
                }
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Model (optional)</Label>
                {provider !== "anthropic" && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      console.log("[AiBot] Button clicked, calling mutate");
                      fetchModels.mutate({
                        provider: provider as any,
                        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
                        baseUrl: baseUrl.trim() || null,
                      });
                    }}
                    disabled={fetchModels.isPending}
                  >
                    {fetchModels.isPending ? "Loading..." : "Load models"}
                  </button>
                )}
              </div>
              {availableModels && availableModels.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder={s?.resolved?.model || "Select a model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={
                    s?.resolved?.model
                      ? `Default: ${s.resolved.model}`
                      : "e.g. gpt-4o-mini"
                  }
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>My language</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto-translate incoming</Label>
              <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Switch
                  checked={autoTranslate}
                  onCheckedChange={setAutoTranslate}
                />
                <span className="text-sm text-muted-foreground">
                  {autoTranslate
                    ? "Translations appear automatically"
                    : "Translate on demand (per message)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() =>
                save.mutate({
                  provider: provider as any,
                  apiKey: apiKey.trim() ? apiKey.trim() : undefined,
                  baseUrl: baseUrl.trim() || null,
                  model: model.trim() || null,
                  targetLanguage,
                  autoTranslate,
                })
              }
              disabled={save.isPending}
            >
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save settings
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                test.mutate({
                  provider: provider as any,
                  apiKey: apiKey.trim() ? apiKey.trim() : undefined,
                  baseUrl: baseUrl.trim() || null,
                  model: model.trim() || null,
                })
              }
              disabled={test.isPending}
            >
              {test.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
            {s && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => del.mutate()}
                disabled={del.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            )}
          </div>

          {testResult && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
              <p className="mb-1 font-medium text-green-800 dark:text-green-200">
                Connection works — sample translation:
              </p>
              <p className="text-green-900 dark:text-green-100">{testResult}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            · Your key is stored encrypted at rest and never shown in full —
            only the first/last 4 characters.
          </p>
          <p>
            · Translation is lazy: a message is translated only when you open
            it, and the result is cached, so you never pay twice for the same
            message.
          </p>
          <p>
            · ChatGPT Plus / Claude Pro subscriptions do not include API
            access — you need an API key from the provider's developer
            platform, or run a local model.
          </p>
          <p>
            · The original message is always one click away ("Show original").
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
