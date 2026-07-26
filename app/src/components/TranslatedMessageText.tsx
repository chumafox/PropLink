import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Msg = {
  id: number;
  body: string | null;
  translations?: Record<string, string> | null;
};

/**
 * Renders an incoming message with BYOK translation:
 *  - shows a cached translation instantly (no extra API cost),
 *  - auto-translates when the user enabled it in Dashboard → AI Bot,
 *  - otherwise shows a "Translate" button; original is always one click away.
 */
export function TranslatedMessageText({
  message,
  targetLang,
  autoTranslate,
}: {
  message: Msg;
  targetLang?: string | null;
  autoTranslate?: boolean;
}) {
  const [fetched, setFetched] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const started = useRef(false);

  const translate = trpc.messages.translate.useMutation({
    onSuccess: (r) => setFetched(r.text),
    onError: (e) => toast.error(e.message),
  });

  const cached = targetLang ? (message.translations?.[targetLang] ?? null) : null;
  const translated = fetched ?? cached;

  useEffect(() => {
    if (!autoTranslate || !targetLang || translated || started.current) return;
    if (!message.body?.trim()) return;
    started.current = true;
    translate.mutate({ messageId: message.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, targetLang, translated, message.id]);

  if (!targetLang) {
    return (
      <div>
        <p className="whitespace-pre-line text-sm">{message.body}</p>
        <Link
          to="/dashboard?tab=aibot"
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground underline hover:text-foreground"
        >
          <Languages className="h-3 w-3" /> Set up AI translation
        </Link>
      </div>
    );
  }

  const showTranslated = Boolean(translated) && !showOriginal;

  return (
    <div>
      <p className="whitespace-pre-line text-sm">
        {showTranslated ? translated : message.body}
      </p>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {(translate.isPending && !translated) ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Translating…
          </span>
        ) : translated ? (
          <button
            className="flex items-center gap-1 underline hover:text-foreground"
            onClick={() => setShowOriginal((v) => !v)}
          >
            <Languages className="h-3 w-3" />
            {showOriginal
              ? `Show translation (${targetLang})`
              : `Translated to ${targetLang} · Show original`}
          </button>
        ) : (
          <button
            className="flex items-center gap-1 underline hover:text-foreground"
            onClick={() => {
              started.current = true;
              translate.mutate({ messageId: message.id });
            }}
          >
            <Languages className="h-3 w-3" /> Translate to {targetLang}
          </button>
        )}
      </div>
    </div>
  );
}
