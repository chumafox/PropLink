import { z } from "zod";

// Shared validation schema for a listing (create form + CSV/JSON import rows)
export const listingInputSchema = z.object({
  description: z.string().max(20000).optional(),
  propertyType: z
    .enum(["house", "condo", "townhouse", "multi_family", "land", "apartment"])
    .default("house"),
  status: z
    .enum(["draft", "active", "pending", "sold", "archived"])
    .default("active"),
  price: z.number().int().positive(),
  addressLine1: z.string().min(3).max(255),
  city: z.string().min(1).max(128),
  state: z.string().min(1).max(64),
  zip: z.string().min(3).max(16),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  beds: z.number().int().min(0).default(0),
  baths: z.number().min(0).default(0),
  sqft: z.number().int().min(0).default(0),
  lotSqft: z.number().int().min(0).optional(),
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  photos: z.array(z.string().url()).max(40).default([]),
  features: z.array(z.string().max(120)).max(60).default([]),
  batchData: z.object({
    estimatedEquity: z.number().optional(),
    taxAmount: z.number().optional(),
    mortgageBalance: z.number().optional(),
    arv: z.number().optional(),
    ownerName: z.string().optional(),
    hash: z.string().optional(),
  }).optional(),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

// A looser row schema for CSV/JSON import: everything arrives as unknown,
// we coerce numbers and split delimited strings before strict validation.
export function coerceImportRow(raw: Record<string, unknown>): unknown {
  const num = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v: unknown): string | undefined =>
    v == null || v === "" ? undefined : String(v).trim();
  const list = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === "string")
      return v
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    return [];
  };

  return {
    description: str(raw.description),
    propertyType: str(raw.propertyType ?? raw.property_type) ?? "house",
    status: str(raw.status) ?? "active",
    price: num(raw.price),
    addressLine1: str(raw.addressLine1 ?? raw.address ?? raw.address_line1),
    city: str(raw.city),
    state: str(raw.state),
    zip: str(raw.zip ?? raw.zipcode ?? raw.zip_code),
    lat: num(raw.lat ?? raw.latitude),
    lng: num(raw.lng ?? raw.lon ?? raw.longitude),
    beds: num(raw.beds ?? raw.bedrooms) ?? 0,
    baths: num(raw.baths ?? raw.bathrooms) ?? 0,
    sqft: num(raw.sqft ?? raw.living_area) ?? 0,
    lotSqft: num(raw.lotSqft ?? raw.lot_sqft ?? raw.lot_size),
    yearBuilt: num(raw.yearBuilt ?? raw.year_built),
    photos: list(raw.photos ?? raw.photo ?? raw.images),
    features: list(raw.features ?? raw.amenities),
  };
}
