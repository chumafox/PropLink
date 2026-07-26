import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, Eraser } from "lucide-react";
import { timeAgo } from "@/lib/format";

export default function NotificationsBell() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const { data: items } = trpc.notifications.list.useQuery();
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  const clearRead = trpc.notifications.clearRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {!!unread && unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 border-0 bg-primary px-1 text-[10px] text-white">
              {unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-3">
            {!!unread && unread > 0 && (
              <button
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => markAll.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            {items?.some((n) => n.readAt) && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => clearRead.mutate()}
                title="Clear read messages"
              >
                <Eraser className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing yet — offers, messages and matches land here.
            </p>
          )}
          {items?.map((n) => (
            <button
              key={n.id}
              className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                !n.readAt ? "bg-primary/5" : ""
              }`}
              onClick={() => {
                if (n.link) navigate(n.link);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                {!n.readAt && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
              {n.body && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {n.body}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {timeAgo(n.createdAt)}
              </p>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
