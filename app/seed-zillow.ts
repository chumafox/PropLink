import { eq, inArray } from "drizzle-orm";
import { getDb } from "./api/queries/connection";
import { listings, users } from "./db/schema";
import { fetchZillowPropertyByAddress } from "./api/lib/zillow";

const addresses = [
  "18 LEWISTON Court, Palm Coast, FL 32137",
  "3 Eastgate Ln, Palm Coast, FL 32164",
  "4 Westglen Pl, Palm Coast, FL 32164",
  "38 New Leatherwood Dr, Palm Coast, FL 32137",
  "10 Fenwick Ln, Palm Coast, FL 32137",
  "2 Rainrock Pl, Palm Coast, FL 32164",
  "127 S Riverwalk Dr, Palm Coast, FL 32137",
  "4 Lake Charles Pl, Palm Coast, FL 32137",
  "15 Zelda Ct, Palm Coast, FL 32164",
  "121 WHIPPOORWILL Drive, Palm Coast, FL 32164",
  "114 New Leatherwood Dr, Palm Coast, FL 32137",
  "501 GRANADA Drive, Palm Coast, FL 32137",
  "17 OLD OAK Drive N, Palm Coast, FL 32137",
  "118 Blare Dr, Palm Coast, FL 32137",
  "34 Coconut Ct, Palm Coast, FL 32137",
  "42 Blairsville Dr, Palm Coast, FL 32137",
  "92 Wheatfield Dr, Palm Coast, FL 32164",
  "63 FRONT Street, Palm Coast, FL 32137",
  "18 Burning Bush Pl, Palm Coast, FL 32137",
  "60 Surfview Dr APT 214, Palm Coast, FL 32137"
];

const targetEmails = [
  "test_37d09a5b@testdomain.local",
  "test_394a8b2e@testdomain.local",
  "test_f4c2d85a@testdomain.local",
  "test_7b501cd7@testdomain.local",
  "test_0d895a98@testdomain.local",
  "test_ff37fb55@testdomain.local",
  "test_7badfe0a@testdomain.local",
  "test_0f734f00@testdomain.local",
  "test_987ac26e@testdomain.local",
  "test_8c4d67c5@testdomain.local"
];

async function run() {
  const db = getDb();
  console.log("Fetching users...");
  const userRecords = await db.select().from(users).where(inArray(users.email, targetEmails));
  if (userRecords.length === 0) {
    console.error("No target users found!");
    process.exit(1);
  }

  let userIndex = 0;
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const user = userRecords[userIndex % userRecords.length];
    if (i % 2 !== 0) userIndex++; // every user gets 2

    console.log(`[${i+1}/${addresses.length}] Fetching ${address} for ${user.email}...`);
    try {
      const details = await fetchZillowPropertyByAddress(address);
      
      const photos = [];
      const extractUrl = (p: any) => {
        if (typeof p === "string") return p;
        if (p?.url) return p.url;
        if (p?.mixedSources?.jpeg?.length) {
          return p.mixedSources.jpeg[p.mixedSources.jpeg.length - 1].url;
        }
        return null;
      };

      if (details.originalPhotos && Array.isArray(details.originalPhotos)) {
        photos.push(...details.originalPhotos.map(extractUrl).filter(Boolean));
      } else if (details.responsivePhotos && Array.isArray(details.responsivePhotos)) {
        photos.push(...details.responsivePhotos.map(extractUrl).filter(Boolean));
      }

      await db.insert(listings).values({
        ownerId: user.id,
        description: details.description || "",
        price: details.price || details.zestimate || 0,
        addressLine1: details.streetAddress || details.address?.streetAddress || address.split(",")[0],
        city: details.city || details.address?.city || "Palm Coast",
        state: details.state || details.address?.state || "FL",
        zip: details.zipcode || details.address?.zipcode || "32137",
        lat: details.latitude,
        lng: details.longitude,
        beds: details.bedrooms || 0,
        baths: details.bathrooms || 0,
        sqft: details.livingArea || 0,
        lotSqft: details.lotSize || undefined,
        yearBuilt: details.yearBuilt || undefined,
        photos: photos.slice(0, 40),
        status: "active",
        propertyType: "house"
      });
      console.log(`  -> Inserted successfully!`);
    } catch (err: any) {
      console.error(`  -> Failed: ${err.message}`);
    }
  }
  console.log("Done seeding!");
  process.exit(0);
}

run();
