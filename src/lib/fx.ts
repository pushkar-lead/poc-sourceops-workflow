// Demo FX — USD is canonical (assumption A28). Frozen illustrative rates.
export const FX_TO_USD: Record<string, number> = {
  USD: 1, INR: 0.012, EUR: 1.08, GBP: 1.27, JPY: 0.0064, SGD: 0.74, TWD: 0.031, CNY: 0.14,
};

export function toUSD(amount: number, ccy: string): number {
  return amount * (FX_TO_USD[ccy] ?? 1);
}

export function usd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

// Demo import-duty composite (BCD + SWS + IGST). Illustrative only.
export const DUTY_RATE = 0.2568;
export function computeDuty(assessableValue: number, rate: number = DUTY_RATE): number {
  return Math.round(assessableValue * rate);
}

// Demo GST on the sell side (India domestic). Illustrative.
export const GST_RATE = 0.18;
export function computeGst(taxableValue: number, rate: number = GST_RATE): number {
  return Math.round(taxableValue * rate);
}
