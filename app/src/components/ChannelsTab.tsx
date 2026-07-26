import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Twitter,
  Plug,
  Copy,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const CHANNEL_META = {
  facebook: {
    icon: Facebook,
    title: "Facebook Messenger",
    color: "text-blue-600",
    desc: "Private messages to your Facebook Page land in your PropLink inbox. Reply here — clients see it in Messenger.",
  },
  instagram: {
    icon: Instagram,
    title: "Instagram DM",
    color: "text-pink-600",
    desc: "Direct messages from your Instagram professional account, unified into the same inbox.",
  },
  whatsapp: {
    icon: MessageCircle,
    title: "WhatsApp Business",
    color: "text-green-600",
    desc: "WhatsApp Business Cloud API. Replies within the 24-hour window are free-form; outside it WhatsApp requires template messages.",
  },
  x: {
    icon: Twitter,
    title: "X (Twitter) DM",
    color: "text-foreground",
    desc: "Direct messages via X API. Note: X requires a paid API tier (Basic+) for DM access — X's policy, not ours.",
  },
} as const;

type ChannelKey = keyof typeof CHANNEL_META;

export function ChannelsTab() {
  const utils = trpc.useUtils();
  const list = trpc.channels.list.useQuery();
  const [open, setOpen] = useState<ChannelKey | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhooks/channels/meta`;

  const connectedFor = (ch: ChannelKey) =>
    list.data?.filter((c) => c.channel === ch) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" /> Omnichannel inbox
          </CardTitle>
          <CardDescription>
            Connect your social messengers — every conversation lands in one
            PropLink inbox, and the AI translator (Dashboard → AI Bot) works on
            all of them. You bring your own API credentials; PropLink never
            touches your tokens in plain text (AES-256 encrypted at rest).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Your webhook URL — paste it into your Meta app (works for
              Facebook, Instagram and WhatsApp products at once):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs dark:bg-muted">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(Object.keys(CHANNEL_META) as ChannelKey[]).map((ch) => {
        const meta = CHANNEL_META[ch];
        const Icon = meta.icon;
        const conns = connectedFor(ch);
        return (
          <Card key={ch}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className={`h-5 w-5 ${meta.color}`} /> {meta.title}
                  {conns.length > 0 && (
                    <Badge className="border-0 bg-green-100 text-green-800">
                      {conns.length} connected
                    </Badge>
                  )}
                </CardTitle>
                <ConnectDialog
                  channel={ch}
                  open={open === ch}
                  onOpenChange={(v) => setOpen(v ? ch : null)}
                  onSaved={() => {
                    utils.channels.list.invalidate();
                    setOpen(null);
                  }}
                />
              </div>
              <CardDescription>{meta.desc}</CardDescription>
            </CardHeader>
            {conns.length > 0 && (
              <CardContent className="space-y-2">
                {conns.map((c) => (
                  <ConnectionRow key={c.id} conn={c} />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup guides (honest version)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            · <b>Facebook / Instagram / WhatsApp</b>: create a Meta developer
            app at developers.facebook.com, add the Messenger / Instagram /
            WhatsApp products, generate a <b>Page access token</b> (or
            WhatsApp permanent token), then set the webhook URL above with the
            verify token you receive after connecting here.
          </p>
          <p>
            · <b>Facebook Groups</b>: Meta does not provide an official API
            for reading group posts/messages — no CRM (including GHL) can do
            it legally. Page private messages and comments are supported;
            groups are not.
          </p>
          <p>
            · <b>X (Twitter)</b>: DM read/write requires X's paid API tier.
            If you have it, paste your OAuth2 user token — sending works
            immediately.
          </p>
          <p>
            · App Review: for messaging anyone beyond your own test accounts,
            Meta requires <b>App Review</b> (pages_messaging permission) —
            standard procedure, takes a few days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionRow({ conn }: { conn: any }) {
  const utils = trpc.useUtils();
  const disconnect = trpc.channels.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Channel disconnected");
      utils.channels.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <div>
        <p className="font-medium">
          {conn.externalAccountName ?? conn.externalAccountId}
        </p>
        <p className="text-xs text-muted-foreground">
          ID: {conn.externalAccountId}
          {conn.verifyToken && (
            <>
              {" · verify token: "}
              <code className="rounded bg-muted px-1">{conn.verifyToken}</code>
            </>
          )}
          {conn.lastEventAt && (
            <> · last event {new Date(conn.lastEventAt).toLocaleString()}</>
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={disconnect.isPending}
        onClick={() => disconnect.mutate({ id: conn.id })}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ConnectDialog({
  channel,
  open,
  onOpenChange,
  onSaved,
}: {
  channel: ChannelKey;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [token, setToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [savedVerify, setSavedVerify] = useState<string | null>(null);

  const invalidateAndToast = (verifyToken?: string) => {
    if (verifyToken) setSavedVerify(verifyToken);
    else {
      toast.success("Channel connected");
      onSaved();
    }
  };

  const connectMeta = trpc.channels.connectMeta.useMutation({
    onSuccess: (r) => invalidateAndToast(r.verifyToken),
    onError: (e) => toast.error(e.message),
  });
  const connectWa = trpc.channels.connectWhatsApp.useMutation({
    onSuccess: (r) => invalidateAndToast(r.verifyToken),
    onError: (e) => toast.error(e.message),
  });
  const connectX = trpc.channels.connectX.useMutation({
    onSuccess: () => invalidateAndToast(),
    onError: (e) => toast.error(e.message),
  });

  const pending =
    connectMeta.isPending || connectWa.isPending || connectX.isPending;

  const submit = () => {
    if (channel === "facebook" || channel === "instagram") {
      connectMeta.mutate({
        channel,
        externalAccountId: accountId.trim(),
        externalAccountName: accountName.trim() || undefined,
        accessToken: token.trim(),
        appSecret: appSecret.trim() || undefined,
      });
    } else if (channel === "whatsapp") {
      connectWa.mutate({
        phoneNumberId: accountId.trim(),
        displayName: accountName.trim() || undefined,
        accessToken: token.trim(),
        appSecret: appSecret.trim() || undefined,
      });
    } else {
      connectX.mutate({
        xUserId: accountId.trim(),
        username: accountName.trim() || undefined,
        accessToken: token.trim(),
      });
    }
  };

  const idLabel =
    channel === "facebook"
      ? "Page ID"
      : channel === "instagram"
        ? "IG Business Account ID"
        : channel === "whatsapp"
          ? "Phone Number ID"
          : "X user ID (numeric)";
  const tokenLabel =
    channel === "whatsapp"
      ? "WhatsApp permanent access token"
      : channel === "x"
        ? "OAuth2 user access token (paid tier)"
        : "Page access token";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plug className="mr-2 h-4 w-4" /> Connect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {CHANNEL_META[channel].title}</DialogTitle>
          <DialogDescription>
            Credentials are encrypted with AES-256 before they touch the
            database.
          </DialogDescription>
        </DialogHeader>
        {savedVerify ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected. Now paste this into your Meta app's webhook settings:
            </p>
            <div className="rounded-md border p-3 text-xs">
              <p className="mb-1 font-medium">Callback URL:</p>
              <code className="break-all">
                {window.location.origin}/api/webhooks/channels/meta
              </code>
              <p className="mb-1 mt-3 font-medium">Verify token:</p>
              <code className="break-all">{savedVerify}</code>
            </div>
            <Button className="w-full" onClick={onSaved}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{idLabel}</Label>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display name (optional)</Label>
              <Input
                placeholder="My business page"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tokenLabel}</Label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            {(channel === "facebook" ||
              channel === "instagram" ||
              channel === "whatsapp") && (
              <div className="space-y-1.5">
                <Label>Meta app secret (recommended)</Label>
                <Input
                  type="password"
                  placeholder="Used to verify webhook signatures"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                />
              </div>
            )}
            <Button
              className="w-full"
              disabled={pending || !accountId.trim() || !token.trim()}
              onClick={submit}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
