export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

// ---- PropLink domain constants (shared frontend ↔ backend) ----

export const PRO_ROLES = [
  { value: "buyer", label: "Buyer / Homeowner", ru: "Покупатель" },
  { value: "investor", label: "Investor", ru: "Инвестор" },
  { value: "agent", label: "Real Estate Agent", ru: "Агент" },
  { value: "title_company", label: "Title Company", ru: "Тайтл-компания" },
  { value: "private_lender", label: "Private Money Lender", ru: "Частный кредитор" },
  { value: "hard_money_lender", label: "Hard Money Lender", ru: "Hard money кредитор" },
  { value: "transaction_coordinator", label: "Transaction Coordinator", ru: "Координатор сделки" },
  { value: "attorney", label: "Real Estate Attorney", ru: "Адвокат по недвижимости" },
  { value: "gator_lender", label: "Gator Lender", ru: "Gator-кредитор" },
  { value: "builder", label: "Home Builder / Developer", ru: "Застройщик / девелопер" },
  { value: "fix_flip", label: "Fix & Flip Company", ru: "Fix & Flip компания" },
  { value: "contractor", label: "General Contractor / Rehab Crew", ru: "Генподрядчик / бригада" },
  { value: "deal_participant", label: "Deal Participant (Novation / JV)", ru: "Участник сделки" },
] as const;

export const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
  { value: "apartment", label: "Apartment" },
] as const;

export const FINANCING_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "conventional", label: "Conventional" },
  { value: "fha", label: "FHA" },
  { value: "va", label: "VA" },
  { value: "hard_money", label: "Hard Money" },
  { value: "private_money", label: "Private Money" },
  { value: "other", label: "Other" },
] as const;

export const OFFER_STATUSES = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "accepted", label: "Accepted" },
  { value: "countered", label: "Countered" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

export const CONTINGENCY_OPTIONS = [
  { value: "inspection", label: "Inspection" },
  { value: "appraisal", label: "Appraisal" },
  { value: "financing", label: "Financing" },
  { value: "sale_of_home", label: "Sale of current home" },
  { value: "title_review", label: "Title review" },
] as const;

export const LISTING_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
] as const;
