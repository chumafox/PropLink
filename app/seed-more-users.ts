import { getDb } from "./api/queries/connection";
import { users, profiles, type ProRole } from "./db/schema";
import crypto from "crypto";

const rolesToUse: ProRole[] = [
  "buyer",
  "private_lender",
  "hard_money_lender",
  "transaction_coordinator",
  "gator_lender",
  "contractor",
  "title_company",
  "attorney",
  "deal_participant"
];

const languages = [
  { name: "English", code: "en" },
  { name: "Español", code: "es" },
  { name: "Français", code: "fr" },
  { name: "Deutsch", code: "de" },
  { name: "Русский", code: "ru" },
];

async function run() {
  const db = getDb();
  
  console.log("| Email | Role | Name | Selected Language | Auto-translate |");
  
  for (let i = 0; i < 10; i++) {
    const randomHex = crypto.randomBytes(4).toString("hex");
    const email = `test_${randomHex}@testdomain.local`;
    const role = rolesToUse[i % rolesToUse.length];
    const name = `Test ${role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ")} ${randomHex}`;
    const lang = languages[i % languages.length];

    // Insert user
    const [insertResult] = await db.insert(users).values({
      unionId: `local-${randomHex}`,
      email,
      name,
    });

    // Insert profile
    await db.insert(profiles).values({
      userId: insertResult.insertId,
      proRole: role,
      verificationStatus: "verified",
      onboarded: 1,
    });

    console.log(`| ${email} | ${role} | ${name} | ${lang.name} | ON |`);
  }
  
  console.log("Done");
  process.exit(0);
}

run().catch(console.error);
