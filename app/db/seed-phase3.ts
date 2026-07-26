import "dotenv/config";
import { connectors } from "../api/foreclosure/connectors";
import { insertForeclosureRecord } from "../api/queries/foreclosures";

async function main() {
  let total = 0;
  for (const c of connectors) {
    const records = await c.fetch();
    for (const r of records) {
      const res = await insertForeclosureRecord({
        ...r,
        caseNumber: r.caseNumber ?? null,
        sourceUrl: r.sourceUrl ?? null,
        zip: r.zip ?? null,
        ownerName: r.ownerName ?? null,
        estimatedValue: r.estimatedValue ?? null,
        openingBid: r.openingBid ?? null,
        auctionDate: r.auctionDate ?? null,
        filingDate: r.filingDate ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        raw: r.raw ?? null,
      });
      if (res.inserted) total++;
    }
    console.log(`${c.county}, ${c.state}: ${records.length} fetched`);
  }
  console.log(`Inserted ${total} new foreclosure records`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
