import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Eye,
  Inbox,
  Send,
  PlusCircle,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  ShieldCheck,
  Gavel,
  Settings2,
} from "lucide-react";
import {
  formatPrice,
  timeAgo,
  OFFER_STATUS_STYLES,
  LISTING_STATUS_STYLES,
  ROLE_LABELS,
} from "@/lib/format";
import { FINANCING_TYPES, CONTINGENCY_OPTIONS } from "@contracts/constants";
import { toast } from "sonner";
import DeveloperTab from "@/components/DeveloperTab";
import SavedSearchesTab from "@/components/SavedSearchesTab";
import BuyBoxTab from "@/components/BuyBoxTab";
import VerificationTab from "@/components/VerificationTab";
import { AiBotTab } from "@/components/AiBotTab";
import { ChannelsTab } from "@/components/ChannelsTab";

const financingLabel = (v: string) =>
  FINANCING_TYPES.find((f) => f.value === v)?.label ?? v;
const contingencyLabel = (v: string) =>
  CONTINGENCY_OPTIONS.find((c) => c.value === v)?.label ?? v;

export default function Dashboard() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "offers-in";
  const utils = trpc.useUtils();
  const [advancedMode, setAdvancedMode] = useState(false);

  const { data: profile, isLoading: profileLoading } =
    trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const { data: myListings } = trpc.listings.mine.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: received } = trpc.offers.received.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: sent } = trpc.offers.sent.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: deals } = trpc.deals.list.useQuery(undefined, {
    enabled: !!user,
  });

  const removeListing = trpc.listings.remove.useMutation({
    onSuccess: () => {
      toast.success("Listing deleted");
      utils.listings.mine.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const respond = trpc.offers.respond.useMutation({
    onSuccess: () => {
      toast.success("Response sent to the buyer");
      utils.offers.received.invalidate();
      setRespondDlg(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const withdraw = trpc.offers.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Offer withdrawn");
      utils.offers.sent.invalidate();
    },
  });

  const requestVerification = trpc.verification.request.useMutation({
    onSuccess: () => {
      toast.success("Verification requested — we'll review your license");
      utils.profile.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [respondDlg, setRespondDlg] = useState<{
    offerId: number;
    status: "accepted" | "declined" | "countered";
  } | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [responseMsg, setResponseMsg] = useState("");

  if (isLoading || profileLoading) return null;

  // Force onboarding for new users
  if (!profile) {
    navigate("/onboarding");
    return null;
  }

  const pendingReceived =
    received?.filter(
      (r) => r.offer.status === "submitted" || r.offer.status === "under_review",
    ) ?? [];

  const dealByOfferId = new Map(
    (deals ?? []).map((d) => [d.deal.offerId, d.deal.id] as const),
  );

  const DEAL_STATUS_STYLES: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    under_contract: "bg-purple-100 text-purple-700",
    closing: "bg-amber-100 text-amber-700",
    closed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-600",
  };

  const stats = [
    {
      icon: Building2,
      label: "My listings",
      value: myListings?.length ?? 0,
      to: undefined as string | undefined,
    },
    {
      icon: Eye,
      label: "Total views",
      value: myListings?.reduce((s, l) => s + l.views, 0) ?? 0,
      to: undefined,
    },
    { icon: Inbox, label: "Offers to answer", value: pendingReceived.length },
    { icon: Send, label: "My offers", value: sent?.length ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Hi, {user?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
              {ROLE_LABELS[profile.proRole] ?? profile.proRole}
              {profile.company ? ` · ${profile.company}` : ""} ·{" "}
              <Link to="/onboarding" className="text-primary hover:underline">
                Edit profile
              </Link>
              {profile.verificationStatus === "verified" && (
                <Badge className="border-0 bg-green-100 text-green-700">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Verified pro
                </Badge>
              )}
              {profile.verificationStatus === "pending" && (
                <Badge className="border-0 bg-amber-100 text-amber-700">
                  Verification pending
                </Badge>
              )}
              {profile.verificationStatus === "none" &&
                profile.licenseNumber && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={requestVerification.isPending}
                    onClick={() => requestVerification.mutate()}
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" /> Get verified
                  </Button>
                )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/distressed")}>
              <Gavel className="mr-2 h-4 w-4" /> Distressed
            </Button>
            <Button variant="outline" onClick={() => navigate("/import")}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button onClick={() => navigate("/listings/new")}>
              <PlusCircle className="mr-2 h-4 w-4" /> New listing
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
          className="mt-8"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="offers-in">
              Offers received
              {pendingReceived.length > 0 && (
                <Badge className="ml-2 border-0 bg-primary text-white">
                  {pendingReceived.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="listings">My listings</TabsTrigger>
            <TabsTrigger value="offers-out">My offers</TabsTrigger>
            <TabsTrigger value="deals">Deal rooms</TabsTrigger>

            <TabsTrigger value="searches">Saved searches</TabsTrigger>
            <TabsTrigger value="buybox">Buy box</TabsTrigger>
            {advancedMode && <TabsTrigger value="developer">API & Webhooks</TabsTrigger>}
            {advancedMode && <TabsTrigger value="aibot">AI Bot</TabsTrigger>}
            <TabsTrigger value="channels">Channels</TabsTrigger>
            {user?.role === "admin" && (
              <TabsTrigger value="verification">Verification</TabsTrigger>
            )}
            <Button
              variant="ghost"
              size="icon"
              title={advancedMode ? "Hide advanced tabs" : "Show advanced tabs"}
              className="ml-auto h-7 w-7 text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setAdvancedMode((prev) => !prev)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </TabsList>

          {/* Offers received */}
          <TabsContent value="offers-in" className="mt-4 space-y-3">
            {received?.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-10 text-center text-muted-foreground">
                  No offers yet. They land here the moment a buyer sends one.
                </CardContent>
              </Card>
            )}
            {received?.map(({ offer, listingTitle, listingCity, buyerName }) => (
              <Card key={offer.id} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold">
                          {formatPrice(offer.price)}
                        </p>
                        <Badge
                          className={`border-0 ${OFFER_STATUS_STYLES[offer.status]}`}
                        >
                          {offer.status.replace("_", " ")}
                        </Badge>
                        {(offer.proofOfFundsUrl || offer.preApprovalUrl) && (
                          <Badge className="border-0 bg-green-100 text-green-700">
                            <ShieldCheck className="mr-1 h-3 w-3" /> verified
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        from <span className="font-medium">{buyerName ?? "Buyer"}</span>{" "}
                        for «{listingTitle}», {listingCity} ·{" "}
                        {financingLabel(offer.financingType)} · close in{" "}
                        {offer.closingDays}d
                        {offer.earnestMoney
                          ? ` · EMD ${formatPrice(offer.earnestMoney)}`
                          : ""}{" "}
                        · {timeAgo(offer.createdAt)}
                      </p>
                      {!!offer.contingencies?.length && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Contingencies:{" "}
                          {offer.contingencies.map(contingencyLabel).join(", ")}
                        </p>
                      )}
                      {offer.message && (
                        <p className="mt-2 rounded-lg bg-muted/60 p-3 text-sm">
                          {offer.message}
                        </p>
                      )}
                      {offer.status === "countered" && offer.counterPrice && (
                        <p className="mt-2 text-sm font-medium text-purple-700">
                          Countered at {formatPrice(offer.counterPrice)}
                        </p>
                      )}
                    </div>
                    {(offer.status === "submitted" ||
                      offer.status === "under_review") && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            setRespondDlg({
                              offerId: offer.id,
                              status: "accepted",
                            })
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRespondDlg({
                              offerId: offer.id,
                              status: "countered",
                            })
                          }
                        >
                          Counter
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setRespondDlg({
                              offerId: offer.id,
                              status: "declined",
                            })
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                    {offer.status === "accepted" &&
                      dealByOfferId.get(offer.id) && (
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(`/deals/${dealByOfferId.get(offer.id)}`)
                          }
                        >
                          Open Deal Room
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* My listings */}
          <TabsContent value="listings" className="mt-4 space-y-3">
            {myListings?.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <p className="text-muted-foreground">
                    You haven't listed anything yet — it's free.
                  </p>
                  <Button onClick={() => navigate("/listings/new")}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add your first listing
                  </Button>
                </CardContent>
              </Card>
            )}
            {myListings?.map((l) => (
              <Card key={l.id} className="border-0 shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <img
                    src={l.photos?.[0] || "/photos/house-1.jpg"}
                    alt=""
                    className="h-16 w-24 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/photos/house-1.jpg";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/listings/${l.id}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {l.addressLine1}
                      </Link>
                      <Badge
                        className={`border-0 ${LISTING_STATUS_STYLES[l.status]}`}
                      >
                        {l.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(l.price)} · {l.city}, {l.state} ·{" "}
                      <Eye className="inline h-3 w-3" /> {l.views}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(`/listings/new?edit=${l.id}`)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => removeListing.mutate({ id: l.id })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* My offers */}
          <TabsContent value="offers-out" className="mt-4 space-y-3">
            {sent?.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-10 text-center text-muted-foreground">
                  You haven't sent any offers yet.{" "}
                  <Link to="/listings" className="text-primary hover:underline">
                    Browse homes
                  </Link>
                </CardContent>
              </Card>
            )}
            {sent?.map(({ offer, listingTitle, listingCity, listingPrice }) => (
              <Card key={offer.id} className="border-0 shadow-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">«{listingTitle}»</p>
                      <Badge
                        className={`border-0 ${OFFER_STATUS_STYLES[offer.status]}`}
                      >
                        {offer.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {listingCity} · your offer {formatPrice(offer.price)} vs
                      list {formatPrice(listingPrice)} · {timeAgo(offer.createdAt)}
                    </p>
                    {offer.status === "countered" && offer.counterPrice && (
                      <p className="mt-1 text-sm font-medium text-purple-700">
                        Counter offer: {formatPrice(offer.counterPrice)}
                      </p>
                    )}
                    {offer.responseMessage && (
                      <p className="mt-2 rounded-lg bg-muted/60 p-3 text-sm">
                        {offer.responseMessage}
                      </p>
                    )}
                  </div>
                  {(offer.status === "submitted" ||
                    offer.status === "under_review") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => withdraw.mutate({ offerId: offer.id })}
                    >
                      Withdraw
                    </Button>
                  )}
                  {offer.status === "accepted" && dealByOfferId.get(offer.id) && (
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(`/deals/${dealByOfferId.get(offer.id)}`)
                      }
                    >
                      Open Deal Room
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Deal rooms */}
          <TabsContent value="deals" className="mt-4 space-y-3">
            {deals?.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-10 text-center text-muted-foreground">
                  No deal rooms yet. They open automatically when an offer is
                  accepted.
                </CardContent>
              </Card>
            )}
            {deals?.map((d) => (
              <Card
                key={d.deal.id}
                className="cursor-pointer border-0 shadow-sm transition-shadow hover:shadow-md"
                onClick={() => navigate(`/deals/${d.deal.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <img
                    src={d.listingPhotos?.[0] || "/photos/house-1.jpg"}
                    alt=""
                    className="h-16 w-24 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/photos/house-1.jpg";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{d.listingTitle}</p>
                      <Badge
                        className={`border-0 ${DEAL_STATUS_STYLES[d.deal.status]}`}
                      >
                        {d.deal.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {d.listingCity}, {d.listingState} ·{" "}
                      {formatPrice(d.offerPrice)} · you are the{" "}
                      {d.mySide === "buyer" ? "buyer" : "seller"} · with{" "}
                      {d.otherUser?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">
                      {d.doneCount}/{d.taskCount} tasks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(d.deal.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Saved searches */}
          <TabsContent value="searches" className="mt-4">
            <SavedSearchesTab />
          </TabsContent>

          {/* Buy box */}
          <TabsContent value="buybox" className="mt-4">
            <BuyBoxTab />
          </TabsContent>

          {/* Admin verification */}
          {user?.role === "admin" && (
            <TabsContent value="verification" className="mt-4">
              <VerificationTab />
            </TabsContent>
          )}

          {/* API & Webhooks */}
          <TabsContent value="developer" className="mt-4">
            <DeveloperTab />
          </TabsContent>

          {/* AI Bot (BYOK translator) */}
          <TabsContent value="aibot" className="mt-4">
            <AiBotTab />
          </TabsContent>

          {/* Omnichannel integrations */}
          <TabsContent value="channels" className="mt-4">
            <ChannelsTab />
          </TabsContent>


        </Tabs>
      </div>

      {/* Respond dialog */}
      <Dialog open={!!respondDlg} onOpenChange={() => setRespondDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {respondDlg?.status === "accepted" && "Accept offer"}
              {respondDlg?.status === "countered" && "Counter offer"}
              {respondDlg?.status === "declined" && "Decline offer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {respondDlg?.status === "countered" && (
              <div className="space-y-1.5">
                <Label>Counter price, $</Label>
                <Input
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Message to the buyer (optional)</Label>
              <Textarea
                rows={3}
                value={responseMsg}
                onChange={(e) => setResponseMsg(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={respond.isPending}
              onClick={() =>
                respondDlg &&
                respond.mutate({
                  offerId: respondDlg.offerId,
                  status: respondDlg.status,
                  counterPrice: counterPrice ? Number(counterPrice) : undefined,
                  responseMessage: responseMsg || undefined,
                })
              }
            >
              Send response
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
