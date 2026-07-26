export function formatPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer",
  investor: "Investor",
  agent: "Real Estate Agent",
  title_company: "Title Company",
  private_lender: "Private Money Lender",
  hard_money_lender: "Hard Money Lender",
  transaction_coordinator: "Transaction Coordinator",
  attorney: "Real Estate Attorney",
  gator_lender: "Gator Lender",
};

export const OFFER_STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  countered: "bg-purple-100 text-purple-700",
  declined: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

export const LISTING_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  sold: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-600",
};
