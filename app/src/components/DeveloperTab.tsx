import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, KeyRound, Trash2, Webhook, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { WEBHOOK_EVENTS_LIST } from "@/lib/api-docs";
import { toast } from "sonner";

export default function DeveloperTab() {
  const utils = trpc.useUtils();
  const { data: keys } = trpc.developer.keys.useQuery();
  const { data: hooks } = trpc.developer.webhooks.useQuery();

  const [keyName, setKeyName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["offer.created"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<number | null>(null);

  const { data: deliveries } = trpc.developer.deliveries.useQuery(
    { webhookId: deliveriesFor! },
    { enabled: deliveriesFor != null },
  );

  const createKey = trpc.developer.createKey.useMutation({
    onSuccess: (r) => {
      setNewToken(r.token);
      setKeyName("");
      utils.developer.keys.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeKey = trpc.developer.revokeKey.useMutation({
    onSuccess: () => utils.developer.keys.invalidate(),
  });
  const createHook = trpc.developer.createWebhook.useMutation({
    onSuccess: (r) => {
      setNewSecret(r.secret);
      setHookUrl("");
      utils.developer.webhooks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteHook = trpc.developer.deleteWebhook.useMutation({
    onSuccess: () => utils.developer.webhooks.invalidate(),
  });

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };

  return (
    <div className="space-y-6">
      {/* API keys */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <KeyRound className="h-5 w-5 text-primary" /> API keys
            </h3>
            <a
              href="/developers"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              API docs <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              placeholder="Key name, e.g. CRM sync"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <Button
              disabled={!keyName.trim() || createKey.isPending}
              onClick={() => createKey.mutate({ name: keyName.trim() })}
            >
              Create key
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {keys?.length === 0 && (
              <p className="text-sm text-muted-foreground">No keys yet.</p>
            )}
            {keys?.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {k.name}{" "}
                    <code className="text-xs text-muted-foreground">
                      {k.prefix}…
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    created {timeAgo(k.createdAt)}
                    {k.lastUsedAt && ` · last used ${timeAgo(k.lastUsedAt)}`}
                  </p>
                </div>
                {k.revokedAt ? (
                  <Badge variant="secondary">revoked</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeKey.mutate({ id: k.id })}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Webhook className="h-5 w-5 text-primary" /> Webhooks
          </h3>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input
                placeholder="https://your-server.com/hooks/proplink"
                value={hookUrl}
                onChange={(e) => setHookUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {WEBHOOK_EVENTS_LIST.map((ev) => (
                <label
                  key={ev}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <Checkbox
                    checked={hookEvents.includes(ev)}
                    onCheckedChange={(checked) =>
                      setHookEvents((p) =>
                        checked ? [...p, ev] : p.filter((x) => x !== ev),
                      )
                    }
                  />
                  <code className="text-xs">{ev}</code>
                </label>
              ))}
            </div>
            <Button
              disabled={!hookUrl || !hookEvents.length || createHook.isPending}
              onClick={() =>
                createHook.mutate({ url: hookUrl, events: hookEvents as any })
              }
            >
              Add webhook
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {hooks?.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {(h.events ?? []).join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeliveriesFor(h.id)}
                  >
                    Log
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteHook.mutate({ id: h.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* New token dialog — shown once */}
      <Dialog open={!!newToken} onOpenChange={() => setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this key now</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            It is shown only once. Store it somewhere safe.
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <code className="flex-1 break-all text-xs">{newToken}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => newToken && copy(newToken, "Key")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New webhook secret dialog */}
      <Dialog open={!!newSecret} onOpenChange={() => setNewSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook signing secret</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Verify <code>X-PropLink-Signature</code> with this secret.
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <code className="flex-1 break-all text-xs">{newSecret}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => newSecret && copy(newSecret, "Secret")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deliveries dialog */}
      <Dialog open={deliveriesFor != null} onOpenChange={() => setDeliveriesFor(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent deliveries</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {deliveries?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No deliveries yet — trigger an event.
              </p>
            )}
            {deliveries?.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <code className="text-xs font-medium">{d.event}</code>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(d.createdAt)}
                  </p>
                </div>
                <Badge
                  className={`border-0 ${
                    d.status === "success"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {d.responseCode ?? d.status}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
