import { useState } from "react";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gavel,
  RefreshCw,
  MapPin,
  ExternalLink,
  Database,
  Plus,
  Trash2,
  Globe,
} from "lucide-react";
import { formatPrice, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "react-router";

const TYPE_LABELS: Record<string, string> = {
  lis_pendens: "Lis Pendens",
  notice_of_default: "Notice of Default",
  notice_of_sale: "Notice of Sale",
  auction: "Auction",
  reo: "REO / Bank-owned",
};

const TYPE_STYLES: Record<string, string> = {
  lis_pendens: "bg-amber-100 text-amber-700",
  notice_of_default: "bg-orange-100 text-orange-700",
  notice_of_sale: "bg-red-100 text-red-700",
  auction: "bg-purple-100 text-purple-700",
  reo: "bg-blue-100 text-blue-700",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  demo: "demo",
  json_api: "JSON API",
  html: "HTML page",
  pdf: "PDF",
};

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export default function Distressed() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [county, setCounty] = useState("");
  const [recordType, setRecordType] = useState("all");

  // add-connector dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [fCounty, setFCounty] = useState("");
  const [fState, setFState] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fType, setFType] = useState<"json_api" | "html" | "pdf">("json_api");
  const [fNotes, setFNotes] = useState("");

  // NETR Crawl state
  const [netrOpen, setNetrOpen] = useState(false);
  const [netrState, setNetrState] = useState("");
  const [selectedCountyUrl, setSelectedCountyUrl] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: netrCounties, isLoading: countiesLoading } =
    trpc.foreclosures.getCountyDirectory.useQuery(
      { state: netrState },
      { enabled: netrState.length === 2 && netrOpen },
    );

  const { data, isLoading } = trpc.foreclosures.search.useQuery(
    {
      county: county || undefined,
      recordType: recordType !== "all" ? (recordType as any) : undefined,
      limit: 60,
    },
    { enabled: isAuthenticated },
  );
  const { data: connectorList } = trpc.foreclosures.connectors.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  const { data: stats } = trpc.foreclosures.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (authLoading) return null;

  const invalidate = () => {
    utils.foreclosures.connectors.invalidate();
    utils.foreclosures.search.invalidate();
    utils.foreclosures.stats.invalidate();
  };

  const sync = trpc.foreclosures.sync.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Fetched ${r.fetched}, ${r.valid} valid, ${r.inserted} new records`,
      );
      invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setSyncingId(null),
  });

  const addConnector = trpc.foreclosures.addConnector.useMutation({
    onSuccess: () => {
      toast.success("Connector added");
      setAddOpen(false);
      setFCounty("");
      setFState("");
      setFUrl("");
      setFNotes("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeConnector = trpc.foreclosures.removeConnector.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const crawlNetrCounty = trpc.foreclosures.crawlNetrCounty.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Imported ${res.portalInfo.county} County, ${res.portalInfo.state} portal links!`,
      );
      setNetrOpen(false);
      setSelectedCountyUrl("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <Gavel className="h-7 w-7 text-primary" /> Distressed & Foreclosure
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Pre-foreclosure and auction records pulled from county sources.
              Add any county — JSON APIs sync automatically, HTML/PDF sources
              get a custom adapter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={netrOpen} onOpenChange={setNetrOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Globe className="mr-2 h-4 w-4" /> Crawl NETR State
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Counties via NETR Directory</DialogTitle>
                  <DialogDescription>
                    Automatically crawl NETR Online for a US state to discover county portals, Assessor links, and Trustee Foreclosure sites.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>1. Select State</Label>
                    <Select
                      value={netrState}
                      onValueChange={(val) => {
                        setNetrState(val);
                        setSelectedCountyUrl("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a US State..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {US_STATES.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {netrState && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>2. Select County ({netrCounties?.length ?? 0} total)</Label>
                        {netrCounties && netrCounties.length > 10 && (
                          <Input
                            placeholder="Filter county name…"
                            className="h-7 w-44 text-xs"
                            value={countyFilter}
                            onChange={(e) => setCountyFilter(e.target.value)}
                          />
                        )}
                      </div>
                      <Select
                        value={selectedCountyUrl}
                        onValueChange={setSelectedCountyUrl}
                        disabled={countiesLoading}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              countiesLoading
                                ? "Loading counties..."
                                : "Choose a County..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {netrCounties
                            ?.filter((c: any) =>
                              !countyFilter ||
                              c.name.toLowerCase().includes(countyFilter.toLowerCase()),
                            )
                            .map((c: any) => (
                              <SelectItem key={c.slug} value={c.url}>
                                {c.name} County{" "}
                                {c.strategy && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">
                                    [{c.strategy.replace("_", " ").toUpperCase()}]
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={!selectedCountyUrl || crawlNetrCounty.isPending}
                    onClick={() =>
                      crawlNetrCounty.mutate({ countyUrl: selectedCountyUrl })
                    }
                  >
                    {crawlNetrCounty.isPending
                      ? "Crawling Portal via Firecrawl…"
                      : "Import Selected County Portal"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate("/login");
                      return;
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add county connector
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add county connector</DialogTitle>
                <DialogDescription>
                  Point PropLink at a county foreclosure/pre-foreclosure source.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>County *</Label>
                    <Input
                      placeholder="Maricopa"
                      value={fCounty}
                      onChange={(e) => setFCounty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State *</Label>
                    <Input
                      placeholder="AZ"
                      value={fState}
                      onChange={(e) => setFState(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Source type</Label>
                  <Select
                    value={fType}
                    onValueChange={(v) => setFType(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json_api">
                        JSON API — syncs automatically
                      </SelectItem>
                      <SelectItem value="html">
                        HTML page — needs custom adapter
                      </SelectItem>
                      <SelectItem value="pdf">
                        PDF — needs custom adapter
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Source URL {fType === "json_api" && "*"}</Label>
                  <Input
                    placeholder="https://county.gov/api/foreclosures"
                    value={fUrl}
                    onChange={(e) => setFUrl(e.target.value)}
                  />
                  {fType === "json_api" && (
                    <p className="text-xs text-muted-foreground">
                      We auto-map common fields: address, city, zip, owner,
                      case_number, auction_date, record_type…
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    rows={2}
                    placeholder="e.g. Updated weekly, requires no auth"
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !fCounty.trim() ||
                    !fState.trim() ||
                    (fType === "json_api" && !fUrl.trim()) ||
                    addConnector.isPending
                  }
                  onClick={() =>
                    addConnector.mutate({
                      county: fCounty.trim(),
                      state: fState.trim(),
                      sourceUrl: fUrl.trim() || undefined,
                      sourceType: fType,
                      notes: fNotes.trim() || undefined,
                    })
                  }
                >
                  {addConnector.isPending ? "Adding…" : "Add connector"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Connectors */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {connectorList?.map((c) => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    {c.county} County, {c.state}
                  </p>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Database className="h-3 w-3" />
                      {SOURCE_TYPE_LABELS[c.sourceType] ?? c.sourceType}
                    </Badge>
                    {c.isCustom && c.ownerId === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          removeConnector.mutate({
                            id: Number(c.id.replace("db-", "")),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {c.sourceDescription}
                </p>
                {c.lastSyncAt && (
                  <p className="text-[10px] text-muted-foreground">
                    last sync {timeAgo(c.lastSyncAt)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {stats?.find((s) => s.county === c.county)?.count ?? 0} records
                  </span>
                  {isAuthenticated ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncingId !== null}
                      onClick={() => {
                        setSyncingId(c.id);
                        sync.mutate({ connectorId: c.id });
                      }}
                    >
                      <RefreshCw
                        className={`mr-1.5 h-3.5 w-3.5 ${syncingId === c.id ? "animate-spin" : ""}`}
                      />
                      {syncingId === c.id ? "Syncing…" : "Sync"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      sign in to sync
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Filter by county…"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
          />
          <Select value={recordType} onValueChange={setRecordType}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All record types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="self-center text-sm text-muted-foreground">
            {data ? `${data.total} records` : ""}
          </p>
        </div>

        {/* Records */}
        <div className="mt-4 space-y-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          {data?.items.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-10 text-center text-muted-foreground">
                No records yet — hit Sync on a county connector above.
              </CardContent>
            </Card>
          )}
          {data?.items.map((r) => (
            <Card key={r.id} className="border-0 shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border-0 ${TYPE_STYLES[r.recordType]}`}>
                      {TYPE_LABELS[r.recordType] ?? r.recordType}
                    </Badge>
                    {r.caseNumber && (
                      <span className="text-xs text-muted-foreground">
                        #{r.caseNumber}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    {r.addressLine1}, {r.city}, {r.state} {r.zip}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {r.county} County
                    {r.ownerName && ` · owner: ${r.ownerName}`}
                    {r.filingDate && ` · filed ${r.filingDate}`}
                    {r.auctionDate && (
                      <span className="font-medium text-red-600">
                        {" "}
                        · auction {r.auctionDate}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {r.estimatedValue && (
                    <p className="text-sm">
                      est.{" "}
                      <span className="font-semibold">
                        {formatPrice(r.estimatedValue)}
                      </span>
                    </p>
                  )}
                  {r.openingBid && (
                    <p className="text-sm text-muted-foreground">
                      opening bid {formatPrice(r.openingBid)}
                    </p>
                  )}
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      county source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Records come from public county sources and may be delayed or
          incomplete. Always verify with the county recorder before acting.
          PropLink does not provide legal advice; some states restrict
          marketing to owners in foreclosure.
        </p>
      </div>
    </div>
  );
}
