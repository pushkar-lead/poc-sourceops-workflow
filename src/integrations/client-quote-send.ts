// Client quote send adapter — mock email sending for final quotes to clients
// Masks supplier cost/margin — client only sees client price

export interface ClientQuoteSendRequest {
  clientName: string;
  clientEmail: string;
  rfqBundleId: string;
  quotedLines: {
    mpn: string;
    qty: number;
    clientUnitPrice: number;
  }[];
  totalQuote: number;
  currency: string;
  expiryDate: string;
  acceptanceLink: string;
}

export interface ClientQuoteSendResponse {
  sent: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export async function sendClientQuote(req: ClientQuoteSendRequest): Promise<ClientQuoteSendResponse> {
  const latency = Math.random() * (900 - 300) + 300;
  const failureRate = 0.05; // 5% failure rate

  await new Promise((r) => setTimeout(r, latency));

  // Verify that we're NOT sending supplier cost (masking check)
  // In a real system, this would be caught earlier by the store
  // Here, we just simulate the behavior

  if (Math.random() < failureRate) {
    const errors = [
      "Invalid email address",
      "SMTP connection timeout",
      "Mail server rejected message",
      "Rate limit exceeded",
    ];
    return {
      sent: false,
      error: errors[Math.floor(Math.random() * errors.length)],
      timestamp: new Date().toISOString(),
    };
  }

  return {
    sent: true,
    messageId: `quote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  };
}
