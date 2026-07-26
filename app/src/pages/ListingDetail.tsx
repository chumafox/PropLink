import { useState } from "react";
import { useParams, Link } from "react-router";
import Navbar from "@/components/Navbar";
import OfferDialog from "@/components/OfferDialog";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  BedDouble,
  Bath,
  Ruler,
  MapPin,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
} from "lucide-react";
import {
  formatPrice,
  formatNumber,
  timeAgo,
  ROLE_LABELS,
  LISTING_STATUS_STYLES,
} from "@/lib/format";
import { PROPERTY_TYPES } from "@contracts/constants";
import { MessageSquare, Link2, Facebook, Twitter, Linkedin, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function ShareButtons({ title }: { title: string }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = encodeURIComponent(`${title} — on PropLink`);
  const u = encodeURIComponent(url);
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-primary hover:text-primary";
  return (
    <div className="flex items-center gap-1.5">
      <button
        className={btn}
        title="Copy link"
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast.success("Link copied");
        }}
      >
        <Link2 className="h-4 w-4" />
      </button>
      <a
        className={btn}
        title="Share on X"
        target="_blank"
        rel="noreferrer"
        href={`https://twitter.com/intent/tweet?text=${text}&url=${u}`}
      >
        <Twitter className="h-4 w-4" />
      </a>
      <a
        className={btn}
        title="Share on Facebook"
        target="_blank"
        rel="noreferrer"
        href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}
      >
        <Facebook className="h-4 w-4" />
      </a>
      <a
        className={btn}
        title="Share on LinkedIn"
        target="_blank"
        rel="noreferrer"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}
      >
        <Linkedin className="h-4 w-4" />
      </a>
    </div>
  );
}

function MessageAgentButton({ listingId }: { listingId: number }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const start = trpc.messages.startWithOwner.useMutation({
    onSuccess: (conv) => {
      utils.messages.conversations.invalidate();
      navigate(`/messages/${conv.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button
      variant="outline"
      className="mt-2 w-full"
      size="lg"
      disabled={start.isPending}
      onClick={() => {
        if (!isAuthenticated) {
          navigate("/login");
          return;
        }
        start.mutate({ listingId });
      }}
    >
      <MessageSquare className="mr-2 h-4 w-4" />
      {start.isPending ? "Opening…" : "Message the agent"}
    </Button>
  );
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = trpc.listings.byId.useQuery(
    { id: Number(id) },
    { enabled: !!id },
  );
  const [photoIdx, setPhotoIdx] = useState(0);

  if (isLoading)
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="aspect-[2/1] animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );

  if (error || !data)
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Listing not found.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/listings">Back to browse</Link>
          </Button>
        </div>
      </div>
    );

  const { listing } = data;
  const photos = listing.photos?.length ? listing.photos : ["/photos/house-1.jpg"];
  const typeLabel =
    PROPERTY_TYPES.find((t) => t.value === listing.propertyType)?.label ??
    listing.propertyType;

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Link
          to="/listings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to results
        </Link>

        {/* Gallery */}
        <div className="relative overflow-hidden rounded-2xl bg-muted">
          <img
            src={photos[photoIdx]}
            alt={listing.title}
            className="aspect-[2/1] w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/photos/house-1.jpg";
            }}
          />
          {photos.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full"
                onClick={() =>
                  setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full"
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                {photoIdx + 1} / {photos.length}
              </div>
            </>
          )}
          <Badge
            className={`absolute left-3 top-3 border-0 ${LISTING_STATUS_STYLES[listing.status] ?? ""}`}
          >
            {listing.status}
          </Badge>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {formatPrice(listing.price)}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {listing.addressLine1}, {listing.city}, {listing.state}{" "}
                  {listing.zip}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" /> {formatNumber(listing.views)} views
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-6 rounded-xl border bg-white p-4">
              {listing.beds > 0 && (
                <div className="flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{listing.beds}</p>
                    <p className="text-xs text-muted-foreground">beds</p>
                  </div>
                </div>
              )}
              {listing.baths > 0 && (
                <div className="flex items-center gap-2">
                  <Bath className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{listing.baths}</p>
                    <p className="text-xs text-muted-foreground">baths</p>
                  </div>
                </div>
              )}
              {listing.sqft > 0 && (
                <div className="flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{formatNumber(listing.sqft)}</p>
                    <p className="text-xs text-muted-foreground">sqft</p>
                  </div>
                </div>
              )}
              {listing.yearBuilt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{listing.yearBuilt}</p>
                    <p className="text-xs text-muted-foreground">built</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">{typeLabel}</p>
                  <p className="text-xs text-muted-foreground">type</p>
                </div>
              </div>
            </div>

            <h2 className="mt-8 text-xl font-semibold">About this home</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
              {listing.description || listing.title}
            </p>

            {!!listing.features?.length && (
              <>
                <h2 className="mt-8 text-xl font-semibold">Features</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.features.map((f) => (
                    <Badge key={f} variant="secondary" className="px-3 py-1">
                      {f}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sidebar: agent card + offer */}
          <div className="space-y-4">
            <Card className="sticky top-20 border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={data.ownerAvatar ?? undefined} />
                    <AvatarFallback>
                      {data.ownerName?.slice(0, 2).toUpperCase() ?? "AG"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold">
                      {data.ownerName ?? "Listing agent"}
                      {data.ownerVerified === "verified" && (
                        <Badge className="border-0 bg-green-100 px-1.5 py-0 text-[10px] text-green-700">
                          <ShieldCheck className="mr-0.5 h-3 w-3" /> Verified
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[data.ownerRole ?? "agent"] ?? "Agent"}
                      {data.ownerCompany ? ` · ${data.ownerCompany}` : ""}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <OfferDialog
                  listingId={listing.id}
                  listPrice={listing.price}
                  trigger={
                    <Button className="w-full" size="lg">
                      <Send className="mr-2 h-4 w-4" /> Make an offer
                    </Button>
                  }
                />
                <MessageAgentButton listingId={listing.id} />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Delivered directly to the decision maker. Response status
                  guaranteed.
                </p>

                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Listed {timeAgo(listing.createdAt)} · posted directly
                  </p>
                  <ShareButtons title={listing.title} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
