import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_TYPES, LISTING_STATUSES } from "@contracts/constants";
import { uploadFileWithClient } from "@/lib/upload";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

const SAMPLE_PHOTOS = Array.from(
  { length: 8 },
  (_, i) => `/photos/house-${i + 1}.jpg`,
);

export default function NewListing() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit") ? Number(params.get("edit")) : null;

  const [form, setForm] = useState({
    title: "",
    description: "",
    propertyType: "house",
    status: "active",
    price: "",
    addressLine1: "",
    city: "",
    state: "",
    zip: "",
    lat: "",
    lng: "",
    beds: "3",
    baths: "2",
    sqft: "",
    lotSqft: "",
    yearBuilt: "",
    photos: "",
    features: "",
  });

  const { data: existing } = trpc.listings.byId.useQuery(
    { id: editId! },
    { enabled: !!editId && !!user },
  );
  const utils = trpc.useUtils();
  const { data: uploadInfo } = trpc.uploads.available.useQuery(undefined, {
    enabled: !!user,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existing?.listing) {
      const l = existing.listing;
      setForm({
        title: l.title,
        description: l.description ?? "",
        propertyType: l.propertyType,
        status: l.status,
        price: String(l.price),
        addressLine1: l.addressLine1,
        city: l.city,
        state: l.state,
        zip: l.zip,
        lat: l.lat != null ? String(l.lat) : "",
        lng: l.lng != null ? String(l.lng) : "",
        beds: String(l.beds),
        baths: String(l.baths),
        sqft: l.sqft ? String(l.sqft) : "",
        lotSqft: l.lotSqft ? String(l.lotSqft) : "",
        yearBuilt: l.yearBuilt ? String(l.yearBuilt) : "",
        photos: (l.photos ?? []).join("\n"),
        features: (l.features ?? []).join(", "),
      });
    }
  }, [existing]);

  const create = trpc.listings.create.useMutation({
    onSuccess: (l) => {
      toast.success("Listing published");
      navigate(`/listings/${l.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.listings.update.useMutation({
    onSuccess: (l) => {
      toast.success("Listing updated");
      navigate(`/listings/${l.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      propertyType: form.propertyType as any,
      status: form.status as any,
      price: Number(form.price),
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      zip: form.zip,
      lat: form.lat ? Number(form.lat) : undefined,
      lng: form.lng ? Number(form.lng) : undefined,
      beds: Number(form.beds) || 0,
      baths: Number(form.baths) || 0,
      sqft: Number(form.sqft) || 0,
      lotSqft: form.lotSqft ? Number(form.lotSqft) : undefined,
      yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : undefined,
      photos: form.photos
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      features: form.features
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (editId) update.mutate({ id: editId, data: payload });
    else create.mutate(payload);
  };

  const pending = create.isPending || update.isPending;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {editId ? "Edit listing" : "List a property — free"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Have many properties? Use the{" "}
          <Link to="/import" className="text-primary hover:underline">
            bulk CSV/JSON import
          </Link>{" "}
          instead.
        </p>

        <Card className="mt-6 border-0 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="Beautiful 4-bed craftsman near downtown"
                value={form.title}
                onChange={(e) => set("title")(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Price, $ *</Label>
                <Input
                  type="number"
                  placeholder="450000"
                  value={form.price}
                  onChange={(e) => set("price")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.propertyType}
                  onValueChange={set("propertyType")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LISTING_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address *</Label>
              <Input
                placeholder="123 Main St"
                value={form.addressLine1}
                onChange={(e) => set("addressLine1")(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input
                  value={form.city}
                  onChange={(e) => set("city")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>State *</Label>
                <Input
                  placeholder="TX"
                  value={form.state}
                  onChange={(e) => set("state")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ZIP *</Label>
                <Input
                  value={form.zip}
                  onChange={(e) => set("zip")(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Latitude (for the map)</Label>
                <Input
                  placeholder="30.2672"
                  value={form.lat}
                  onChange={(e) => set("lat")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input
                  placeholder="-97.7431"
                  value={form.lng}
                  onChange={(e) => set("lng")(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Beds</Label>
                <Input
                  type="number"
                  value={form.beds}
                  onChange={(e) => set("beds")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Baths</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.baths}
                  onChange={(e) => set("baths")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sqft</Label>
                <Input
                  type="number"
                  value={form.sqft}
                  onChange={(e) => set("sqft")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Year built</Label>
                <Input
                  type="number"
                  value={form.yearBuilt}
                  onChange={(e) => set("yearBuilt")(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={4}
                placeholder="Tell buyers what makes this home special…"
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Photos</Label>
              {uploadInfo?.configured && (
                <div className="rounded-md border border-dashed p-3">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    disabled={uploading}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length) return;
                      setUploading(true);
                      try {
                        const urls: string[] = [];
                        for (const f of files) {
                          if (f.size > uploadInfo.maxBytes) {
                            toast.error(`${f.name}: too large (max 25 MB)`);
                            continue;
                          }
                          const { storedUrl } = await uploadFileWithClient(
                            utils.client,
                            f,
                            "public",
                          );
                          urls.push(storedUrl);
                        }
                        if (urls.length) {
                          set("photos")(
                            [form.photos, ...urls].filter(Boolean).join("\n"),
                          );
                          toast.success(`${urls.length} photo(s) uploaded`);
                        }
                      } catch (err: any) {
                        toast.error(err?.message ?? "Upload failed");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {uploading
                      ? "Uploading…"
                      : "Upload photos from your device (stored on R2 CDN)"}
                  </p>
                </div>
              )}
              <Textarea
                rows={3}
                placeholder={"https://…\nhttps://…"}
                value={form.photos}
                onChange={(e) => set("photos")(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {SAMPLE_PHOTOS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="overflow-hidden rounded-md border hover:ring-2 hover:ring-primary"
                    onClick={() =>
                      set("photos")(form.photos ? `${form.photos}\n${p}` : p)
                    }
                  >
                    <img src={p} alt="" className="h-12 w-20 object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Click a sample to add it, or paste your own URLs.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Features (comma-separated)</Label>
              <Input
                placeholder="Pool, Garage, Central AC, Fenced yard"
                value={form.features}
                onChange={(e) => set("features")(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={
                pending ||
                !form.title ||
                !form.price ||
                !form.addressLine1 ||
                !form.city ||
                !form.state ||
                !form.zip
              }
              onClick={submit}
            >
              {pending
                ? "Saving…"
                : editId
                  ? "Save changes"
                  : "Publish listing"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
