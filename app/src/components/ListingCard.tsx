import { Link } from "react-router";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatNumber, LISTING_STATUS_STYLES } from "@/lib/format";
import type { Listing } from "@contracts/types";

const FALLBACK_IMG = "/photos/house-1.jpg";

export default function ListingCard({ listing }: { listing: Listing }) {
  const photo = listing.photos?.[0] || FALLBACK_IMG;
  return (
    <Link to={`/listings/${listing.id}`} className="group">
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          <img
            src={photo}
            alt={listing.addressLine1}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMG;
            }}
          />
          {listing.status !== "active" && (
            <Badge
              className={`absolute left-3 top-3 border-0 ${LISTING_STATUS_STYLES[listing.status] ?? ""}`}
            >
              {listing.status}
            </Badge>
          )}
          <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-sm font-semibold text-white backdrop-blur-sm">
            {formatPrice(listing.price)}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {listing.beds > 0 && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-4 w-4" /> {listing.beds} bd
              </span>
            )}
            {listing.baths > 0 && (
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" /> {listing.baths} ba
              </span>
            )}
            {listing.sqft > 0 && (
              <span className="flex items-center gap-1">
                <Ruler className="h-4 w-4" /> {formatNumber(listing.sqft)} sqft
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-1 font-semibold">{listing.addressLine1}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">
              {listing.addressLine1}, {listing.city}, {listing.state} {listing.zip}
            </span>
          </p>
        </div>
      </Card>
    </Link>
  );
}
