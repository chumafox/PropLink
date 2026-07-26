import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FINANCING_TYPES, CONTINGENCY_OPTIONS } from "@contracts/constants";
import { formatPrice } from "@/lib/format";
import { ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";

export default function OfferDialog({
  listingId,
  listPrice,
  trigger,
}: {
  listingId: number;
  listPrice: number;
  trigger: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<string>(String(listPrice));
  const [earnest, setEarnest] = useState("");
  const [financing, setFinancing] = useState<string>("cash");
  const [closingDays, setClosingDays] = useState("30");
  const [contingencies, setContingencies] = useState<string[]>([]);
  const [pofUrl, setPofUrl] = useState("");
  const [preApprovalUrl, setPreApprovalUrl] = useState("");
  const [message, setMessage] = useState("");

  const createOffer = trpc.offers.create.useMutation({
    onSuccess: () => {
      toast.success("Offer delivered to the listing agent");
      setOpen(false);
      utils.offers.sent.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    createOffer.mutate({
      listingId,
      price: Number(price),
      earnestMoney: earnest ? Number(earnest) : undefined,
      financingType: financing as any,
      closingDays: Number(closingDays) || 30,
      contingencies,
      proofOfFundsUrl: pofUrl || undefined,
      preApprovalUrl: preApprovalUrl || undefined,
      message: message || undefined,
    });
  };

  const verified = !!pofUrl || !!preApprovalUrl;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v && !isAuthenticated) {
          navigate("/login");
          return;
        }
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make an offer</DialogTitle>
          <DialogDescription>
            Your offer goes straight to the decision maker — structured, trackable,
            with a guaranteed response status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="offer-price">Offer price, $</Label>
              <Input
                id="offer-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                List price: {formatPrice(listPrice)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-earnest">Earnest money, $</Label>
              <Input
                id="offer-earnest"
                type="number"
                placeholder="e.g. 10000"
                value={earnest}
                onChange={(e) => setEarnest(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Financing</Label>
              <Select value={financing} onValueChange={setFinancing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCING_TYPES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-closing">Close in, days</Label>
              <Input
                id="offer-closing"
                type="number"
                value={closingDays}
                onChange={(e) => setClosingDays(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contingencies</Label>
            <div className="grid grid-cols-2 gap-2">
              {CONTINGENCY_OPTIONS.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={contingencies.includes(c.value)}
                    onCheckedChange={(checked) =>
                      setContingencies((prev) =>
                        checked
                          ? [...prev, c.value]
                          : prev.filter((x) => x !== c.value),
                      )
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="offer-pof">Proof of funds (URL)</Label>
              {verified && (
                <Badge className="border-0 bg-green-100 text-green-700">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Verified buyer
                </Badge>
              )}
            </div>
            <Input
              id="offer-pof"
              placeholder="https://… bank letter / statement"
              value={pofUrl}
              onChange={(e) => setPofUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offer-pre">Pre-approval letter (URL)</Label>
            <Input
              id="offer-pre"
              placeholder="https://… lender pre-approval"
              value={preApprovalUrl}
              onChange={(e) => setPreApprovalUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offer-msg">Message to the agent</Label>
            <Textarea
              id="offer-msg"
              rows={3}
              placeholder="Introduce yourself, timeline, anything that strengthens your offer…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={createOffer.isPending || !price}
            onClick={submit}
          >
            <Send className="mr-2 h-4 w-4" />
            {createOffer.isPending ? "Delivering…" : "Deliver offer"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            The agent must respond: accept, counter, or decline. You'll see the
            status in your dashboard.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
