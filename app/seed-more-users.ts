/**
 * seed-more-users.ts — seed additional test users for PropLink development
 *
 * Fixes:
 *  - unionId is required (NOT NULL, no default) — always supply a unique value
 *  - proRole must be one of the proRoles enum (no "lender"; use "private_lender" or "hard_money_lender")
 *
 * Run: npx tsx seed-more-users.ts
 */
import "dotenv/config";
import { getDb } from "./api/queries/connection";
import { users, profiles } from "./db/schema";
import crypto from "crypto";

function uid() {
  return crypto.randomBytes(4).toString("hex");
}

const TEST_USERS: Array<{
  name: string;
  email: string;
  unionId: string;
  proRole:
    | "buyer"
    | "investor"
    | "agent"
    | "title_company"
    | "private_lender"
    | "hard_money_lender"
    | "transaction_coordinator"
    | "attorney"
    | "gator_lender"
    | "builder"
    | "fix_flip"
    | "contractor"
    | "deal_participant";
}> = [
  {
    name: "Test Investor",
    email: "test_investor@testdomain.local",
    unionId: `test-investor-${uid()}`,
    proRole: "investor",
  },
  {
    name: "Test Private Lender",
    email: "test_lender@testdomain.local",
    unionId: `test-lender-${uid()}`,
    proRole: "private_lender", // ← was incorrectly "lender" — enum value is "private_lender"
  },
  {
    name: "Test Agent",
    email: "test_agent@testdomain.local",
    unionId: `test-agent-${uid()}`,
    proRole: "agent",
  },
  {
    name: "Test Fix & Flip",
    email: "test_fixflip@testdomain.local",
    unionId: `test-fixflip-${uid()}`,
    proRole: "fix_flip",
  },
];

async function run() {
  const db = getDb();

  for (const u of TEST_USERS) {
    // Insert user — onDuplicateKeyUpdate on email prevents duplicates on re-run
    const [result] = await db
      .insert(users)
      .values({
        unionId: u.unionId, // required field — must be unique
        name: u.name,
        email: u.email,
      })
      .onDuplicateKeyUpdate({ set: { name: u.name } });

    // Get the inserted or existing user
    const user = await db.query.users.findFirst({
      where: (row, { eq }) => eq(row.email, u.email),
    });

    if (!user) {
      console.error(`Could not find user after insert: ${u.email}`);
      continue;
    }

    // Insert profile — skip if already exists
    try {
      await db
        .insert(profiles)
        .values({
          userId: user.id,
          proRole: u.proRole, // must match proRoles enum exactly
          verificationStatus: "verified",
          onboarded: 1,
        })
        .onDuplicateKeyUpdate({ set: { proRole: u.proRole } });
    } catch (e: any) {
      // Profile may already exist — non-fatal
      console.warn(`Profile insert skipped for ${u.email}: ${e.message}`);
    }

    console.log(`✅ ${u.name} (${u.email}) — role: ${u.proRole}`);
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
