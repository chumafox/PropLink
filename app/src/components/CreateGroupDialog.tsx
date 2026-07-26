import { useState } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: contacts, isLoading } = trpc.messages.chatContacts.useQuery(undefined, {
    enabled: open,
  });

  const createGroup = trpc.messages.createGroup.useMutation({
    onSuccess: (data) => {
      utils.messages.conversations.invalidate();
      setOpen(false);
      setSubject("");
      setSelectedIds(new Set());
      navigate(`/messages/${data.conversationId}`);
    },
    onError: (e) => {
      toast.error(e.message);
    }
  });

  const toggleContact = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleCreate = () => {
    if (!subject.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (selectedIds.size < 2) {
      toast.error("Please select at least 2 other participants");
      return;
    }
    createGroup.mutate({
      subject: subject.trim(),
      participantIds: Array.from(selectedIds),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Create Group Chat">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Group Name</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E.g. Closing Team"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Participants (Min 2)</label>
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
              {isLoading && <p className="text-sm text-muted-foreground p-2">Loading contacts...</p>}
              {!isLoading && contacts?.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">No active contacts found.</p>
              )}
              {contacts?.map((c) => (
                <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleContact(c.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.avatar ?? undefined} />
                    <AvatarFallback>{c.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={selectedIds.size < 2 || !subject.trim() || createGroup.isPending}
            onClick={handleCreate}
          >
            {createGroup.isPending ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
