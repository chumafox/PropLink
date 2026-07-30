import { useState } from "react";
import { useNavigate } from "react-router";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  Users,
  Building2,
  Handshake,
  Search,
  CheckCircle2,
  XCircle,
  Database,
  Bot,
  Ban,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("overview");
  const [userQuery, setUserQuery] = useState("");
  const [listingQuery, setListingQuery] = useState("");

  // Confirmation Modal States for Danger Actions
  const [userToDelete, setUserToDelete] = useState<{ id: number; name: string | null; email: string | null } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const [userToToggleBan, setUserToToggleBan] = useState<{ id: number; name: string | null; email: string | null; banned: number } | null>(null);

  const { data: metrics } = trpc.admin.getMetrics.useQuery(
    undefined,
    { enabled: user?.role === "admin" },
  );

  const { data: usersData } = trpc.admin.listUsers.useQuery(
    { q: userQuery || undefined, limit: 50 },
    { enabled: user?.role === "admin" },
  );

  const { data: listingsData } = trpc.admin.listListings.useQuery(
    { q: listingQuery || undefined, limit: 50 },
    { enabled: user?.role === "admin" },
  );

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      utils.admin.listUsers.invalidate();
      utils.admin.getMetrics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setVerification = trpc.admin.setVerificationStatus.useMutation({
    onSuccess: () => {
      toast.success("Verification status updated");
      utils.admin.listUsers.invalidate();
      utils.admin.getMetrics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleBan = trpc.admin.toggleUserBan.useMutation({
    onSuccess: () => {
      toast.success("User ban status updated");
      setUserToToggleBan(null);
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted successfully");
      setUserToDelete(null);
      setDeleteConfirmInput("");
      utils.admin.listUsers.invalidate();
      utils.admin.getMetrics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setListingStatus = trpc.admin.setListingStatus.useMutation({
    onSuccess: () => {
      toast.success("Listing status updated");
      utils.admin.listListings.invalidate();
      utils.admin.getMetrics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading) return null;

  if (user && user.role !== "admin") {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-primary" /> Admin Hub
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Platform administration, license verification, user roles, and listing moderation.
            </p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 border-0 px-3 py-1 text-xs">
            <Database className="mr-1.5 h-3.5 w-3.5" /> TiDB Cloud Production
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.totalUsers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Registered Users</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.totalVerified ?? 0}</p>
                <p className="text-xs text-muted-foreground">Verified Real Estate Pros</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.activeListings ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Homes Listed</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Handshake className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.totalDeals ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Deal Rooms</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="h-auto w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verification">
              Verification Center
              {(metrics?.totalPendingVerification ?? 0) > 0 && (
                <Badge className="ml-2 border-0 bg-amber-500 text-white">
                  {metrics?.totalPendingVerification}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="listings">Listing Moderation</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">System Infrastructure & Health</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Cloud Database</p>
                  <p className="mt-1 font-semibold flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-600" /> TiDB Cloud Serverless
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Region: AWS Tokyo (ap-northeast-1)</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Production Host</p>
                  <p className="mt-1 font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" /> Render Web Service
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Node.js + Hono + Vite</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">AI Engine & Agent Integration</p>
                  <p className="mt-1 font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-purple-600" /> DeepSeek + MCP Tools
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">5 Admin MCP endpoints exposed</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Verification Center Tab */}
          <TabsContent value="verification" className="mt-4 space-y-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-3">Real Estate Pro License Verification</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Review agent license numbers submitted during onboarding to grant verified status badges.
                </p>

                <div className="space-y-3">
                  {usersData?.items
                    .filter((u) => u.verificationStatus === "pending" || u.licenseNumber)
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 bg-white"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">{u.name}</p>
                            <Badge variant="outline">{u.role}</Badge>
                            <Badge
                              className={`border-0 ${
                                u.verificationStatus === "verified"
                                  ? "bg-green-100 text-green-700"
                                  : u.verificationStatus === "pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {u.verificationStatus ?? "none"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Email: {u.email} · Company: {u.company ?? "N/A"} · License #:{" "}
                            <span className="font-mono font-medium">{u.licenseNumber ?? "None"}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={setVerification.isPending}
                            onClick={() =>
                              setVerification.mutate({
                                userId: u.id,
                                verificationStatus: "verified",
                              })
                            }
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={setVerification.isPending}
                            onClick={() =>
                              setVerification.mutate({
                                userId: u.id,
                                verificationStatus: "rejected",
                              })
                            }
                          >
                            <XCircle className="mr-1 h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}

                  {usersData?.items.filter(
                    (u) => u.verificationStatus === "pending" || u.licenseNumber,
                  ).length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      No pending license verification requests at this time.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="mt-4 space-y-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-1.5">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      className="border-0 shadow-none focus-visible:ring-0"
                      placeholder="Search users by name or email…"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted/50 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="p-3">User</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Verification</th>
                        <th className="p-3">Company</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usersData?.items.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <p className="font-semibold">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </td>
                          <td className="p-3">
                            <Select
                              value={u.role}
                              onValueChange={(r) =>
                                setRole.mutate({ userId: u.id, role: r as any })
                              }
                            >
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">user</SelectItem>
                                <SelectItem value="agent">agent</SelectItem>
                                <SelectItem value="investor">investor</SelectItem>
                                <SelectItem value="title_company">title_company</SelectItem>
                                <SelectItem value="lenders">lenders</SelectItem>
                                <SelectItem value="wholesaler">wholesaler</SelectItem>
                                <SelectItem value="fix_flip">fix_flip</SelectItem>
                                <SelectItem value="admin">admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                className={`border-0 ${
                                  u.verificationStatus === "verified"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {u.verificationStatus ?? "none"}
                              </Badge>
                              {u.banned === 1 && (
                                <Badge className="border-0 bg-red-100 text-red-700 font-semibold">
                                  Banned
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{u.company ?? "—"}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() =>
                                  setRole.mutate({
                                    userId: u.id,
                                    role: u.role === "admin" ? "user" : "admin",
                                  })
                                }
                              >
                                {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                              </Button>
                              <Button
                                size="sm"
                                variant={u.banned === 1 ? "outline" : "secondary"}
                                className={`h-8 text-xs ${
                                  u.banned === 1
                                    ? "text-emerald-700 hover:text-emerald-800"
                                    : "text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border-0"
                                }`}
                                onClick={() =>
                                  setUserToToggleBan({
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                    banned: u.banned,
                                  })
                                }
                              >
                                <Ban className="mr-1 h-3.5 w-3.5" />
                                {u.banned === 1 ? "Unblock" : "Block"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setUserToDelete({
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                  });
                                  setDeleteConfirmInput("");
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Listing Moderation Tab */}
          <TabsContent value="listings" className="mt-4 space-y-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-1.5">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      className="border-0 shadow-none focus-visible:ring-0"
                      placeholder="Search listings by title, address, or city…"
                      value={listingQuery}
                      onChange={(e) => setListingQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {listingsData?.items.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-4 rounded-lg border p-4 bg-white"
                    >
                      <img
                        src={l.photos?.[0] || "/photos/house-1.jpg"}
                        alt=""
                        className="h-16 w-20 rounded-md object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/photos/house-1.jpg";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{l.title || l.addressLine1}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatPrice(l.price)} · {l.city}, {l.state}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Select
                            value={l.status}
                            onValueChange={(st) =>
                              setListingStatus.mutate({
                                listingId: l.id,
                                status: st as any,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">active</SelectItem>
                              <SelectItem value="draft">draft</SelectItem>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="sold">sold</SelectItem>
                              <SelectItem value="archived">archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Block / Unblock User Confirmation Modal */}
      <Dialog
        open={!!userToToggleBan}
        onOpenChange={(open) => !open && setUserToToggleBan(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-2">
              <Ban className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">
              {userToToggleBan?.banned === 1 ? "Unblock User Account?" : "Block User Account?"}
            </DialogTitle>
            <DialogDescription className="text-center text-sm pt-2">
              {userToToggleBan?.banned === 1 ? (
                <>
                  Are you sure you want to unblock <strong>{userToToggleBan?.name || userToToggleBan?.email}</strong>? They will regain access to sign in and use PropLink.
                </>
              ) : (
                <>
                  Are you sure you want to block <strong>{userToToggleBan?.name || userToToggleBan?.email}</strong>? The user will be immediately prohibited from logging in.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setUserToToggleBan(null)}
              disabled={toggleBan.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={userToToggleBan?.banned === 1 ? "default" : "destructive"}
              className={userToToggleBan?.banned === 1 ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              disabled={toggleBan.isPending}
              onClick={() => {
                if (userToToggleBan) {
                  toggleBan.mutate({
                    userId: userToToggleBan.id,
                    banned: userToToggleBan.banned === 1 ? 0 : 1,
                  });
                }
              }}
            >
              {toggleBan.isPending
                ? "Updating…"
                : userToToggleBan?.banned === 1
                ? "Confirm Unblock"
                : "Confirm Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Modal (Requires Email Type Match Protection) */}
      <Dialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
            setDeleteConfirmInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md border-red-200">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-red-700 font-bold">
              Permanently Delete User Account?
            </DialogTitle>
            <DialogDescription className="text-center text-sm pt-2 text-muted-foreground">
              This action <strong>CANNOT be undone</strong>. This will permanently delete user{" "}
              <strong className="text-foreground">{userToDelete?.name || "User"}</strong> (
              <span className="font-mono text-xs text-foreground">{userToDelete?.email}</span>), along with all their profile data, listings, and messages.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2 rounded-lg bg-red-50 p-3 text-xs text-red-900 border border-red-100">
            <p className="font-semibold">⚠️ Safety Verification:</p>
            <p>
              To confirm deletion, please type the user's email below:
            </p>
            <p className="font-mono font-bold select-all text-red-700">{userToDelete?.email}</p>
            <Input
              className="mt-2 bg-white border-red-300 text-sm focus-visible:ring-red-500"
              placeholder={userToDelete?.email || "Type email to confirm"}
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUserToDelete(null);
                setDeleteConfirmInput("");
              }}
              disabled={deleteUser.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              disabled={
                deleteUser.isPending ||
                deleteConfirmInput.trim().toLowerCase() !== (userToDelete?.email || "").toLowerCase()
              }
              onClick={() => {
                if (userToDelete) {
                  deleteUser.mutate({ userId: userToDelete.id });
                }
              }}
            >
              {deleteUser.isPending ? "Deleting…" : "Permanently Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
