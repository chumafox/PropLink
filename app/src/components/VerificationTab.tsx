import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Check, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/format";
import { toast } from "sonner";

export default function VerificationTab() {
  const utils = trpc.useUtils();
  const { data: pending } = trpc.verification.pending.useQuery();
  const decide = trpc.verification.decide.useMutation({
    onSuccess: () => {
      utils.verification.pending.invalidate();
      toast.success("Decision saved");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {pending?.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center text-muted-foreground">
            No pending verification requests.
          </CardContent>
        </Card>
      )}
      {pending?.map(({ profile, userName, userEmail }) => (
        <Card key={profile.id} className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">
                  {userName}{" "}
                  <span className="text-sm text-muted-foreground">
                    ({userEmail})
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABELS[profile.proRole]} · license{" "}
                  <code className="rounded bg-muted px-1">
                    {profile.licenseNumber}
                  </code>
                  {profile.company && ` · ${profile.company}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  decide.mutate({ userId: profile.userId, approve: true })
                }
              >
                <Check className="mr-1 h-4 w-4" /> Verify
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  decide.mutate({ userId: profile.userId, approve: false })
                }
              >
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
