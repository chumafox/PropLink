import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes URLs to prevent Stored XSS via `javascript:` or `data:` URLs.
 * Allows safe web protocols (http, https, blob) and relative paths.
 */
export function safeUrl(url?: string | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("/") ||
    lower.startsWith("blob:")
  ) {
    return trimmed;
  }
  return "#";
}
