import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { businessProfile, products } from "../src/db/schema";

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.toLowerCase();
  if (!ownerEmail) {
    throw new Error(
      "Set SEED_OWNER_EMAIL in .env.local to your Google email before running.",
    );
  }

  console.log(`Seeding owner: ${ownerEmail}`);
  const existingProfile = await db.query.businessProfile.findFirst();
  if (existingProfile) {
    const current = (existingProfile.allowedEmails ?? []) as Array<{
      email: string;
      role: "owner" | "sales" | "production";
    }>;
    if (!current.some((e) => e.email === ownerEmail)) {
      await db
        .update(businessProfile)
        .set({
          allowedEmails: [
            ...current,
            { email: ownerEmail, role: "owner" as const },
          ],
        })
        .where(eq(businessProfile.id, existingProfile.id));
      console.log("  added to allowed_emails");
    } else {
      console.log("  already in allowed_emails");
    }
  }

  console.log("Seeding business profile…");
  const profile = await db.query.businessProfile.findFirst();
  if (!profile) {
    await db.insert(businessProfile).values({
      companyName: "White Pops",
      defaultTone: "warm-professional",
      defaultCurrency: "INR",
      pitchOneLiner:
        "White Pops — premium Makhana (fox nut) processor. Bulk, retail, and export-grade supply.",
      inboxKeywords: ["makhana", "white pops", "fox nut"],
      allowedEmails: [{ email: ownerEmail, role: "owner" as const }],
      followUpInfoSentDays: 4,
      followUpNegotiationDays: 3,
    });
  }

  console.log("Seeding sample products…");
  const samples = [
    {
      sku: "MKH-4S-1KG",
      name: "Premium Makhana 4-Suta",
      grade: "4-suta",
      packSize: "1 kg",
      moq: 100,
      priceRetail: "650.00",
      priceWholesale: "520.00",
      stockNote: "In stock",
    },
    {
      sku: "MKH-5S-1KG",
      name: "Makhana 5-Suta",
      grade: "5-suta",
      packSize: "1 kg",
      moq: 100,
      priceRetail: "780.00",
      priceWholesale: "620.00",
      stockNote: "In stock",
    },
    {
      sku: "MKH-RTE-100G",
      name: "Roasted Makhana (Plain) — 100g pouch",
      grade: "value-added",
      packSize: "100 g",
      moq: 500,
      priceRetail: "90.00",
      priceWholesale: "65.00",
      stockNote: "2-week lead time on large orders",
    },
  ];
  for (const p of samples) {
    await db.insert(products).values(p).onConflictDoNothing();
  }

  console.log("✓ Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
