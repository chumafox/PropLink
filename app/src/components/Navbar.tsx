import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, LayoutDashboard, LogOut, MessageSquare, Upload } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import NotificationsBell from "@/components/NotificationsBell";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: unread } = trpc.messages.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Prop<span className="text-primary">Link</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            to="/listings"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Buy
          </Link>
          <Link
            to="/listings/new"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sell — list free
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>

              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => {
                  if (location.pathname.startsWith("/messages")) {
                    navigate("/dashboard");
                  } else {
                    navigate("/messages");
                  }
                }}
              >
                <MessageSquare className="h-5 w-5" />
                {!!unread && unread > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 border-0 bg-primary px-1 text-[10px] text-white">
                    {unread}
                  </Badge>
                )}
              </Button>
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <Avatar className="h-9 w-9 cursor-pointer">
                    <AvatarImage src={user?.avatar ?? undefined} />
                    <AvatarFallback>
                      {user?.name?.slice(0, 2).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/import")}>
                    <Upload className="mr-2 h-4 w-4" /> Import CSV / JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => navigate("/login")}>
                Join free
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
