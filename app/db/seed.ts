import "dotenv/config";
import { getDb } from "../api/queries/connection";
import { users, profiles, listings, offers } from "./schema";

const AGENT_UNION = "demo-agent-proplink";
const INVESTOR_UNION = "demo-investor-proplink";

async function main() {
  const db = getDb();

  // --- demo users ---
  await db
    .insert(users)
    .values({
      unionId: AGENT_UNION,
      name: "Sarah Mitchell",
      email: "sarah@sunsetrealty.example",
    })
    .onDuplicateKeyUpdate({ set: { name: "Sarah Mitchell" } });
  await db
    .insert(users)
    .values({
      unionId: INVESTOR_UNION,
      name: "Marcus Chen",
      email: "marcus@chencapital.example",
    })
    .onDuplicateKeyUpdate({ set: { name: "Marcus Chen" } });

  const agent = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.unionId, AGENT_UNION),
  });
  const investor = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.unionId, INVESTOR_UNION),
  });
  if (!agent || !investor) throw new Error("users not created");

  await db
    .insert(profiles)
    .values({
      userId: agent.id,
      proRole: "agent",
      company: "Sunset Realty Group",
      phone: "(512) 555-0142",
      licenseNumber: "TX-0789123",
      marketsServed: "Austin, TX · Phoenix, AZ",
      bio: "Top-producing agent in Central Texas. I answer every PropLink offer within 24 hours.",
      onboarded: 1,
    })
    .onDuplicateKeyUpdate({ set: { company: "Sunset Realty Group" } });

  await db
    .insert(profiles)
    .values({
      userId: investor.id,
      proRole: "investor",
      company: "Chen Capital Partners",
      marketsServed: "TX · AZ · FL",
      bio: "Buy-and-hold investor. Cash or hard money, close in 14 days.",
      onboarded: 1,
    })
    .onDuplicateKeyUpdate({ set: { company: "Chen Capital Partners" } });

  // --- demo listings ---
  const data = [
    {
      title: "Modern two-story with stone facade in Circle C Ranch",
      price: 685000,
      addressLine1: "1204 Silent Oak Dr",
      city: "Austin", state: "TX", zip: "78739",
      lat: 30.183, lng: -97.867,
      beds: 4, baths: 3, sqft: 2680, yearBuilt: 2019,
      propertyType: "house" as const,
      photos: ["/photos/house-1.jpg"],
      features: ["2-car garage", "Quartz counters", "Covered patio", "Sprinkler system"],
      description:
        "Light-filled modern home on a quiet cul-de-sac. Open floor plan, oversized island, primary suite down. Walk to top-rated schools.",
    },
    {
      title: "Charming craftsman bungalow near Zilker Park",
      price: 749000,
      addressLine1: "807 Bluebonnet Ln",
      city: "Austin", state: "TX", zip: "78704",
      lat: 30.248, lng: -97.769,
      beds: 3, baths: 2, sqft: 1740, yearBuilt: 1938,
      propertyType: "house" as const,
      photos: ["/photos/house-2.jpg"],
      features: ["Original hardwoods", "Front porch", "Updated kitchen", "Detached studio"],
      description:
        "Classic 78704 bungalow with soul. Walk to Barton Springs. Detached studio perfect for office or rental income.",
    },
    {
      title: "Contemporary villa with pool in Scottsdale",
      price: 1250000,
      addressLine1: "5520 E Desert Vista Trl",
      city: "Scottsdale", state: "AZ", zip: "85266",
      lat: 33.728, lng: -111.926,
      beds: 5, baths: 4.5, sqft: 3900, yearBuilt: 2022,
      propertyType: "house" as const,
      photos: ["/photos/house-3.jpg"],
      features: ["Pool & spa", "Floor-to-ceiling glass", "Casita", "3-car garage"],
      description:
        "Resort-style living with mountain views. Walls of glass open to the pool terrace. Separate casita for guests.",
    },
    {
      title: "Brick colonial on tree-lined street in Plano",
      price: 615000,
      addressLine1: "2216 Willow Bend Dr",
      city: "Plano", state: "TX", zip: "75093",
      lat: 33.030, lng: -96.789,
      beds: 5, baths: 4, sqft: 3150, yearBuilt: 1998,
      propertyType: "house" as const,
      photos: ["/photos/house-4.jpg"],
      features: ["Mature oaks", "Game room", "New roof 2024", "Plano ISD"],
      description:
        "Stately colonial in a top school district. Fresh paint, new roof, move-in ready. Sellers motivated — bring offers.",
    },
    {
      title: "New-build modern farmhouse in Phoenix",
      price: 529000,
      addressLine1: "4419 N 18th Pl",
      city: "Phoenix", state: "AZ", zip: "85016",
      lat: 33.500, lng: -112.043,
      beds: 4, baths: 3, sqft: 2350, yearBuilt: 2024,
      propertyType: "house" as const,
      photos: ["/photos/house-5.jpg"],
      features: ["Black-frame windows", "Butler pantry", "EV charger", "Owned solar"],
      description:
        "Just completed. White-oak floors, designer lighting, owned solar keeps bills near zero. Builder warranty transfers.",
    },
    {
      title: "Mediterranean with courtyard in Tampa Palms",
      price: 578000,
      addressLine1: "16320 Palmetto Grande Ct",
      city: "Tampa", state: "FL", zip: "33647",
      lat: 28.085, lng: -82.388,
      beds: 4, baths: 3, sqft: 2540, yearBuilt: 2005,
      propertyType: "house" as const,
      photos: ["/photos/house-6.jpg"],
      features: ["Courtyard entry", "Tile roof", "Community pool", "No flood zone"],
      description:
        "Gated community, courtyard floor plan, lush landscaping. NOT in a flood zone — insurance-friendly.",
    },
    {
      title: "Single-story ranch with huge backyard in Round Rock",
      price: 429000,
      addressLine1: "3309 Chisholm Valley Dr",
      city: "Round Rock", state: "TX", zip: "78681",
      lat: 30.508, lng: -97.724,
      beds: 3, baths: 2, sqft: 1890, yearBuilt: 1994,
      propertyType: "house" as const,
      photos: ["/photos/house-7.jpg"],
      features: ["Quarter-acre lot", "Deck", "Storage shed", "No HOA"],
      description:
        "Investor special or first home. Solid bones, big lot, no HOA. Priced under market for a fast close.",
    },
    {
      title: "Modern townhome steps from Midtown Atlanta",
      price: 465000,
      addressLine1: "955 Juniper St NE #4",
      city: "Atlanta", state: "GA", zip: "30309",
      lat: 33.779, lng: -84.383,
      beds: 3, baths: 2.5, sqft: 1720, yearBuilt: 2016,
      propertyType: "townhouse" as const,
      photos: ["/photos/house-8.jpg"],
      features: ["Rooftop terrace", "2-car garage", "Walk to MARTA"],
      description:
        "Lock-and-leave townhome with rooftop views. Walkable to Piedmont Park and Midtown dining.",
    },
    {
      title: "Updated condo near Lady Bird Lake",
      price: 349000,
      addressLine1: "1812 S Congress Ave #207",
      city: "Austin", state: "TX", zip: "78704",
      lat: 30.246, lng: -97.749,
      beds: 2, baths: 2, sqft: 1080, yearBuilt: 2008,
      propertyType: "condo" as const,
      photos: ["/photos/house-2.jpg"],
      features: ["Gated parking", "Pool", "Walk to SoCo"],
      description:
        "Turn-key condo in the heart of South Congress. Strong rental history — great for investors.",
    },
    {
      title: "Value-add fourplex in East Phoenix",
      price: 795000,
      addressLine1: "2735 E McDowell Rd",
      city: "Phoenix", state: "AZ", zip: "85008",
      lat: 33.465, lng: -112.021,
      beds: 8, baths: 4, sqft: 3600, yearBuilt: 1978,
      propertyType: "multi_family" as const,
      photos: ["/photos/house-8.jpg"],
      features: ["4 units", "Below-market rents", "Value-add", "6.2% pro-forma cap"],
      description:
        "Four 2/1 units, separately metered. Rents 20% under market — clear value-add path. Seller will consider hard-money buyers.",
    },
    {
      title: "Corner lot ready to build in Georgetown",
      price: 145000,
      addressLine1: "TBD Scenic Bluff Dr",
      city: "Georgetown", state: "TX", zip: "78626",
      lat: 30.664, lng: -97.655,
      beds: 0, baths: 0, sqft: 0,
      propertyType: "land" as const,
      photos: ["/photos/house-7.jpg"],
      features: ["0.31 acres", "Utilities at street", "No flood plain"],
      description:
        "Cleared corner lot in a growing subdivision. Bring your builder — utilities at the street.",
    },
    {
      title: "Historic bungalow flip opportunity in Ybor City",
      price: 265000,
      addressLine1: "1911 E 15th Ave",
      city: "Tampa", state: "FL", zip: "33605",
      lat: 27.961, lng: -82.435,
      beds: 3, baths: 1, sqft: 1250, yearBuilt: 1925,
      propertyType: "house" as const,
      photos: ["/photos/house-2.jpg"],
      features: ["Fixer", "Historic district", "Cash offers preferred"],
      description:
        "Pre-foreclosure opportunity. Needs full rehab — perfect for hard money. ARV $420k. Cash or hard-money offers only.",
    },
  ];

  for (const l of data) {
    await db
      .insert(listings)
      .values({ ...l, ownerId: agent.id, status: "active", views: Math.floor(Math.random() * 400) + 20 });
  }

  // --- a couple of demo offers so the dashboard isn't empty ---
  const firstListing = await db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.addressLine1, "3309 Chisholm Valley Dr"),
  });
  const secondListing = await db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.addressLine1, "1911 E 15th Ave"),
  });
  if (firstListing) {
    await db.insert(offers).values({
      listingId: firstListing.id,
      buyerId: investor.id,
      price: 405000,
      earnestMoney: 10000,
      financingType: "cash",
      closingDays: 14,
      contingencies: [],
      message: "Cash, close in 14 days, no contingencies. Proof of funds attached.",
      status: "submitted",
    });
  }
  if (secondListing) {
    await db.insert(offers).values({
      listingId: secondListing.id,
      buyerId: investor.id,
      price: 240000,
      earnestMoney: 5000,
      financingType: "hard_money",
      closingDays: 21,
      contingencies: ["inspection"],
      message: "Hard money pre-approved with Lima One. Quick close.",
      status: "submitted",
    });
  }

  console.log("Seed complete: 2 users, 12 listings, 2 offers");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
