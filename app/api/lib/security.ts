import { TRPCError } from "@trpc/server";
import dns from "node:dns/promises";

export async function checkUrlSSRF(urlString: string): Promise<string> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed");
    }

    const host = url.hostname;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

    // Initial check for obvious local hostnames
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "169.254.169.254"
    ) {
      throw new Error("Local hostnames are forbidden");
    }

    const checkIp = (ip: string) => {
      if (
        ip === "127.0.0.1" ||
        ip === "0.0.0.0" ||
        ip === "::1" ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
        ip.startsWith("169.254.") ||
        ip.startsWith("fd") || 
        ip.startsWith("fe80:")
      ) {
        throw new Error("Local and private IPs are forbidden");
      }
    };

    if (isIp) {
      checkIp(host);
    } else {
      // Resolve DNS and check IPs to prevent DNS rebinding or A record pointing to localhost
      const addresses = await dns.resolve(host).catch(() => []);
      for (const address of addresses) {
        checkIp(address);
      }
    }

    return urlString;
  } catch (err: any) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid or forbidden URL: ${err.message}`,
    });
  }
}
