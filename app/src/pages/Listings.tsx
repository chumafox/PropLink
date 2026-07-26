import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import Navbar from "@/components/Navbar";
import ListingCard from "@/components/ListingCard";
import { trpc } from "@/providers/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_TYPES } from "@contracts/constants";
import { Search, SlidersHorizontal } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "react-router";
import { formatPrice } from "@/lib/format";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { Bookmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function SaveSearchButton({
  filters,
}: {
  filters: Record<string, string | number | undefined>;
}) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const save = trpc.notifications.createSavedSearch.useMutation({
    onSuccess: () => {
      toast.success("Search saved — you'll be alerted on new matches");
      setOpen(false);
      setName("");
      utils.notifications.savedSearches.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

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
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Save this search">
          <Bookmark className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We'll notify you when a new listing matches these filters.
          </p>
          <Input
            placeholder='Name, e.g. "Austin 3+bd under 600k"'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!name.trim() || save.isPending}
            onClick={() =>
              save.mutate({
                name: name.trim(),
                filters: Object.fromEntries(
                  Object.entries(filters).filter(([, v]) => v !== undefined),
                ) as any,
              })
            }
          >
            Save & enable alerts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Listings() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("any");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [showFilters, setShowFilters] = useState(false);

  const input = useMemo(
    () => ({
      q: params.get("q") || undefined,
      propertyType:
        propertyType !== "all" ? (propertyType as any) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minBeds: minBeds !== "any" ? Number(minBeds) : undefined,
      sort,
      limit: 60,
    }),
    [params, propertyType, minPrice, maxPrice, minBeds, sort],
  );

  const { data, isLoading } = trpc.listings.search.useQuery(input);

  const applySearch = () => {
    setParams(q.trim() ? { q: q.trim() } : {});
  };

  const mapped = (data?.items ?? []).filter((l) => l.lat != null && l.lng != null);
  const center: [number, number] =
    mapped.length > 0
      ? [
          mapped.reduce((s, l) => s + (l.lat ?? 0), 0) / mapped.length,
          mapped.reduce((s, l) => s + (l.lng ?? 0), 0) / mapped.length,
        ]
      : [39.5, -98.35];

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />

      {/* Search bar */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
          <div className="flex flex-1 items-center gap-2 rounded-full border px-3 py-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder="City, ZIP or address…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <Button onClick={applySearch}>Search</Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <SaveSearchButton
            filters={{
              q: params.get("q") || undefined,
              propertyType: propertyType !== "all" ? propertyType : undefined,
              minPrice: minPrice ? Number(minPrice) : undefined,
              maxPrice: maxPrice ? Number(maxPrice) : undefined,
              minBeds: minBeds !== "any" ? Number(minBeds) : undefined,
            }}
          />
        </div>

        {showFilters && (
          <div className="border-t bg-white">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-5 sm:px-6">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any type</SelectItem>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min price</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max price</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Beds</Label>
                <Select value={minBeds} onValueChange={setMinBeds}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}+
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sort</Label>
                <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price_asc">Price ↑</SelectItem>
                    <SelectItem value="price_desc">Price ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <p className="mb-4 text-sm text-muted-foreground">
          {data ? `${data.total} homes` : "Loading…"}
        </p>
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid content-start gap-6 sm:grid-cols-2">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/2] animate-pulse rounded-xl bg-muted"
                />
              ))}
            {data?.items.map((l) => <ListingCard key={l.id} listing={l} />)}
            {data && data.items.length === 0 && (
              <div className="col-span-2 rounded-xl border bg-white p-12 text-center text-muted-foreground">
                No homes match your filters yet.
              </div>
            )}
          </div>

          <div className="sticky top-20 hidden h-[calc(100vh-7rem)] overflow-hidden rounded-xl border shadow-sm lg:block">
            <MapContainer
              center={center}
              zoom={mapped.length ? 11 : 4}
              className="h-full w-full"
              key={`${center[0].toFixed(2)}-${center[1].toFixed(2)}-${mapped.length}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapped.map((l) => (
                <CircleMarker
                  key={l.id}
                  center={[l.lat!, l.lng!]}
                  radius={9}
                  pathOptions={{
                    color: "#fff",
                    weight: 2,
                    fillColor: "#e8395a",
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup>
                    <Link
                      to={`/listings/${l.id}`}
                      className="block text-sm font-medium"
                    >
                      {formatPrice(l.price)} — {l.title}
                    </Link>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
