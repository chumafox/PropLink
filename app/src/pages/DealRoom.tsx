import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { uploadFileWithClient } from "@/lib/upload";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  MessageSquare,
  FileText,
  Plus,
  ChevronLeft,
  ExternalLink,
} from "lucide-react";
import { formatPrice, timeAgo, ROLE_LABELS } from "@/lib/format";
import { PRO_ROLES } from "@contracts/constants";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  under_contract: "bg-purple-100 text-purple-700",
  closing: "bg-amber-100 text-amber-700",
  closed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function DealRoom() {
  const { id } = useParams<{ id: string }>();
  const dealId = Number(id);
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading: loading } = trpc.deals.byId.useQuery(
    { id: dealId },
    { enabled: !!user && !!dealId },
  );

  const invalidate = () => utils.deals.byId.invalidate({ id: dealId });

  const toggleTask = trpc.deals.toggleTask.useMutation({ onSuccess: invalidate });
  const addTask = trpc.deals.addTask.useMutation({
    onSuccess: () => {
      invalidate();
      setNewTask("");
    },
    onError: (e) => toast.error(e.message),
  });
  const addDoc = trpc.deals.addDocument.useMutation({
    onSuccess: () => {
      invalidate();
      setDocName("");
      setDocUrl("");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.deals.updateStatus.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const [newTask, setNewTask] = useState("");
  const [newTaskRole, setNewTaskRole] = useState<string>("");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const { data: uploadInfo } = trpc.uploads.available.useQuery(undefined, {
    enabled: !!user,
  });
  const [docUploading, setDocUploading] = useState(false);

  if (isLoading || loading) return null;

  if (!data)
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center text-muted-foreground">
          Deal room not found or you don't have access.
        </div>
      </div>
    );

  const { deal, offer, listing, buyer, seller, tasks, documents } = data;
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const mySide = deal.buyerId === user?.id ? "buyer" : "seller";

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>

        {/* Header */}
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-5 p-6">
            <img
              src={listing.photos?.[0] || "/photos/house-1.jpg"}
              alt=""
              className="h-20 w-32 rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/photos/house-1.jpg";
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold">{listing.title}</h1>
                <Badge className={`border-0 ${STATUS_STYLES[deal.status]}`}>
                  {deal.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {listing.addressLine1}, {listing.city}, {listing.state}
              </p>
              <p className="mt-1 text-sm">
                Agreed price:{" "}
                <span className="font-semibold">{formatPrice(offer.price)}</span>{" "}
                · close in {offer.closingDays} days · {offer.financingType.replace("_", " ")}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate(`/messages/${deal.conversationId}`)}>
                <MessageSquare className="mr-2 h-4 w-4" /> Deal chat
              </Button>
              <Select
                value={deal.status}
                onValueChange={(v) =>
                  updateStatus.mutate({ id: dealId, status: v as any })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(STATUS_STYLES).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Parties */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Buyer", p: buyer, me: mySide === "buyer" },
            { label: "Seller / Agent", p: seller, me: mySide === "seller" },
          ].map(({ label, p, me }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p?.avatar ?? undefined} />
                  <AvatarFallback>
                    {p?.name?.slice(0, 2).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">
                    {p?.name ?? "—"} {me && <span className="text-primary">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Checklist */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Closing checklist</h2>
                <span className="text-sm text-muted-foreground">
                  {doneCount}/{tasks.length}
                </span>
              </div>
              <Progress value={progress} className="mt-3" />
              <div className="mt-4 space-y-2">
                {tasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={!!t.done}
                      onCheckedChange={() =>
                        toggleTask.mutate({ dealRoomId: dealId, taskId: t.id })
                      }
                    />
                    <span
                      className={
                        t.done ? "text-muted-foreground line-through" : ""
                      }
                    >
                      {t.title}
                    </span>
                    {t.assigneeRole && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        {ROLE_LABELS[t.assigneeRole] ?? t.assigneeRole}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  placeholder="Add a task…"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                />
                <Select value={newTaskRole} onValueChange={setNewTaskRole}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRO_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  disabled={!newTask.trim() || addTask.isPending}
                  onClick={() =>
                    addTask.mutate({
                      dealRoomId: dealId,
                      title: newTask.trim(),
                      assigneeRole: newTaskRole || undefined,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-semibold">Deal documents</h2>
              <div className="mt-4 space-y-2">
                {documents.length === 0 && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No documents yet — add the purchase agreement, title
                    commitment, inspection report…
                  </p>
                )}
                {documents.map(({ doc, uploaderName }) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {doc.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          v{doc.version}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {uploaderName} · {timeAgo(doc.createdAt)}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t pt-4">
                {uploadInfo?.configured && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Upload file</Label>
                    <Input
                      type="file"
                      disabled={docUploading}
                      accept="image/*,application/pdf,.doc,.docx,.txt,.csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > uploadInfo.maxBytes) {
                          toast.error("File is too large (max 25 MB)");
                          return;
                        }
                        setDocUploading(true);
                        try {
                          const { storedUrl } = await uploadFileWithClient(
                            utils.client,
                            file,
                            "private",
                          );
                          addDoc.mutate({
                            dealRoomId: dealId,
                            name: file.name,
                            url: storedUrl,
                          });
                        } catch (err: any) {
                          toast.error(err?.message ?? "Upload failed");
                        } finally {
                          setDocUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    {docUploading && (
                      <p className="text-xs text-muted-foreground">
                        Uploading…
                      </p>
                    )}
                    <p className="text-center text-xs text-muted-foreground">
                      — or link an external document —
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Document name</Label>
                  <Input
                    placeholder="Purchase agreement.pdf"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL</Label>
                  <Input
                    placeholder="https://…"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!docName || !docUrl || addDoc.isPending}
                  onClick={() =>
                    addDoc.mutate({ dealRoomId: dealId, name: docName, url: docUrl })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Add document
                </Button>
                <p className="text-xs text-muted-foreground">
                  Same name = new version automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
