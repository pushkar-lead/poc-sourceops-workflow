import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(n?: number | null, ccy = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
  }).format(n);
}

export function qtyfmt(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function fdate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtAddress(a?: { name?: string; line1?: string; city?: string; state?: string; pincode?: string; country?: string }) {
  if (!a) return "";
  return [a.name, a.line1, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
