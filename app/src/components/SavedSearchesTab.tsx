import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";

export default function SavedSearchesTab() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: searches } = trpc.notifications.savedSearches.useQuery();
  const del = trpc.notifications.deleteSavedSearch.useMutation({
    onSuccess: () => utils.notifications.savedSearches.invalidate(),
  });

  const runLink = (f: Record<string, unknown> | null) => {
    const p = new URLSearchParams();
    if (f?.q) p.set("q", String(f.q));
    return `/listings${p.size ? `?${p.toString()}` : ""}`;
  };

  return (
    <div className="space-y-3">
      {searches?.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center text-muted-foreground">
            No saved searches yet — set filters on the{" "}
            <a href="/listings" className="text-primary hover:underline">
              browse page
            </a>{" "}
            and hit the bookmark icon.
          </CardContent>
        </Card>
      )}
      {searches?.map((s) => (
        <Card key={s.id} className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{s.name}</p>
                {!!s.alertOn && (
                  <Badge className="border-0 bg-green-100 text-green-700">
                    <Bell className="mr-1 h-3 w-3" /> alerts on
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {Object.entries(s.filters ?? {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ") || "all listings"}{" "}
                · saved {timeAgo(s.createdAt)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(runLink(s.filters))}
              >
                <Search className="mr-1.5 h-3.5 w-3.5" /> Run
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => del.mutate({ id: s.id })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
