import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WEBHOOK_EVENTS_LIST } from "@/lib/api-docs";

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/listings",
    desc: "Search listings",
    params: "q, city, state, propertyType, minPrice, maxPrice, minBeds, sort (newest|price_asc|price_desc), limit, offset, status",
  },
  { method: "GET", path: "/api/v1/listings/:id", desc: "Get one listing with owner info", params: "" },
  { method: "POST", path: "/api/v1/listings", desc: "Create a listing (same validation as the web form)", params: "JSON body" },
  { method: "PATCH", path: "/api/v1/listings/:id", desc: "Update your listing (partial)", params: "JSON body" },
  { method: "DELETE", path: "/api/v1/listings/:id", desc: "Delete your listing", params: "" },
  { method: "GET", path: "/api/v1/offers", desc: "List offers", params: "box=sent|received" },
  { method: "POST", path: "/api/v1/offers", desc: "Submit a structured offer", params: "listingId, price, earnestMoney, financingType, closingDays, contingencies[], proofOfFundsUrl, message" },
  { method: "GET", path: "/api/v1/deals", desc: "List your deal rooms", params: "" },
  { method: "GET", path: "/api/v1/foreclosures", desc: "Search foreclosure records", params: "county, state, recordType (lis_pendens|notice_of_default|notice_of_sale|auction|reo), limit, offset" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
      {children}
    </pre>
  );
}

export default function Developers() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold">PropLink API</h1>
        <p className="mt-2 text-muted-foreground">
          Everything the web app can do, the API can do. Create a key in{" "}
          <a href="/dashboard" className="text-primary hover:underline">
            Dashboard → API & Webhooks
          </a>
          .
        </p>

        <Card className="mt-8 border-0 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Authentication</h2>
            <p className="text-sm text-muted-foreground">
              Send your key as a Bearer token. Keys start with{" "}
              <code className="rounded bg-muted px-1">plk_</code>. Rate limit:
              120 requests/minute per key.
            </p>
            <Code>{`curl -H "Authorization: Bearer plk_YOUR_KEY" \\
  ${origin}/api/v1/listings?city=Austin&limit=5`}</Code>
          </CardContent>
        </Card>

        <Card className="mt-6 border-0 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Endpoints</h2>
            <div className="mt-4 space-y-3">
              {endpoints.map((e) => (
                <div key={e.method + e.path} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border-0 font-mono ${METHOD_COLORS[e.method]}`}>
                      {e.method}
                    </Badge>
                    <code className="text-sm font-semibold">{e.path}</code>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{e.desc}</p>
                  {e.params && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">Params:</span> {e.params}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Machine-readable spec:{" "}
              <a
                href="/api/v1/openapi.json"
                target="_blank"
                className="text-primary hover:underline"
              >
                /api/v1/openapi.json
              </a>
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6 border-0 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Create a listing via API</h2>
            <Code>{`curl -X POST -H "Authorization: Bearer plk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Renovated ranch near downtown",
    "price": 425000,
    "addressLine1": "100 Main St",
    "city": "Austin", "state": "TX", "zip": "78701",
    "beds": 3, "baths": 2, "sqft": 1800,
    "lat": 30.2672, "lng": -97.7431,
    "photos": ["https://example.com/photo1.jpg"]
  }' \\
  ${origin}/api/v1/listings`}</Code>
          </CardContent>
        </Card>

        <Card className="mt-6 border-0 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Webhooks</h2>
            <p className="text-sm text-muted-foreground">
              Subscribe to events and we POST them to your URL with an
              HMAC-SHA256 signature in{" "}
              <code className="rounded bg-muted px-1">X-PropLink-Signature</code>{" "}
              (verify with your webhook secret).
            </p>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS_LIST.map((e) => (
                <Badge key={e} variant="secondary" className="font-mono text-xs">
                  {e}
                </Badge>
              ))}
            </div>
            <Code>{`// verify in your handler (Node.js)
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");
if (req.headers["x-proplink-signature"] !== expected) {
  throw new Error("bad signature");
}`}</Code>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
