import { env } from "../../env";

export async function fetchZillowPropertyByAddress(address: string) {
  const apiKey = process.env.ZILLOW_RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("ZILLOW_RAPIDAPI_KEY is not set in environment variables");
  }

  const url = new URL("https://zllw-working-api.p.rapidapi.com/pro/byaddress");
  url.searchParams.set("propertyaddress", address);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Host": "zllw-working-api.p.rapidapi.com",
      "X-RapidAPI-Key": apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zillow API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data?.propertyDetails || Object.keys(data.propertyDetails).length === 0) {
    throw new Error("Property not found on Zillow for this address");
  }

  return data.propertyDetails;
}
