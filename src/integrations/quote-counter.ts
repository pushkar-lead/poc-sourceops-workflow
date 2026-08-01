// Quote counter adapter — mock email sending for buyer counter-offers

export interface CounterOfferRequest {
  rfqBundleId: string;
  quoteLineId: string;
  supplierEmail: string;
  currentPrice: number;
  counterPrice: number;
  notes?: string;
  currency: string;
}

export interface CounterOfferResponse {
  sent: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export async function submitCounterOffer(req: CounterOfferRequest): Promise<CounterOfferResponse> {
  const latency = Math.random() * (1200 - 400) + 400;
  const failureRate = 0.05; // 5% failure rate

  // Validate price bounds: 0 ≤ counter ≤ original × 150%
  const upperBound = req.currentPrice * 1.5;
  if (req.counterPrice < 0 || req.counterPrice > upperBound) {
    return {
      sent: false,
      error: `Counter price out of bounds: must be 0–${upperBound.toFixed(2)} ${req.currency}`,
      timestamp: new Date().toISOString(),
    };
  }

  await new Promise((r) => setTimeout(r, latency));

  if (Math.random() < failureRate) {
    const errors = [
      "SMTP connection timeout",
      "Email address not found",
      "Mail server rejected message",
    ];
    return {
      sent: false,
      error: errors[Math.floor(Math.random() * errors.length)],
      timestamp: new Date().toISOString(),
    };
  }

  return {
    sent: true,
    messageId: `counter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  };
}
