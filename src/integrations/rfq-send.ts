// RFQ send adapter — mock email sending for RFQ invites to suppliers

export interface RfqSendRequest {
  supplierEmail: string;
  supplierName: string;
  rfqBundleId: string;
  portalLink: string;
  deadline: string;
  lineCount: number;
}

export interface RfqSendResponse {
  sent: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export async function sendRfqInvite(req: RfqSendRequest): Promise<RfqSendResponse> {
  const latency = Math.random() * (900 - 300) + 300;
  const failureRate = 0.05; // 5% failure rate

  await new Promise((r) => setTimeout(r, latency));

  if (Math.random() < failureRate) {
    const errors = [
      "SMTP connection timeout",
      "Invalid email address",
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
    messageId: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  };
}
