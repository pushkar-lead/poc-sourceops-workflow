// Quote clarify adapter — mock agent clarification requests to suppliers

export interface ClarificationRequest {
  rfqBundleId: string;
  quoteLineId: string;
  supplierEmail: string;
  ambiguityType: "AMBIGUITY" | "MOQ_ISSUE" | "LEAD_TIME" | "PRICE";
  details: string;
}

export interface ClarificationResponse {
  sent: boolean;
  messageId?: string;
  error?: string;
  agentResponse?: string; // mock response from supplier (async)
  timestamp: string;
}

export async function recordAgentClarification(req: ClarificationRequest): Promise<ClarificationResponse> {
  const latency = Math.random() * (2400 - 1200) + 1200;
  const failureRate = 0.08; // 8% failure rate

  await new Promise((r) => setTimeout(r, latency));

  if (Math.random() < failureRate) {
    const errors = [
      "Email address not found",
      "Mail server rejected message",
      "Supplier did not respond",
    ];
    return {
      sent: false,
      error: errors[Math.floor(Math.random() * errors.length)],
      timestamp: new Date().toISOString(),
    };
  }

  // Mock agent auto-response (supplier clarification received)
  const agentResponses = {
    AMBIGUITY: "Supplier clarified: MOQ is 100 units, not 500.",
    MOQ_ISSUE: "Supplier confirmed MOQ of 250 units. SPQ is 50 units.",
    LEAD_TIME: "Supplier confirmed lead time is 5 weeks, not days.",
    PRICE: "Supplier re-quoted at $5.25 per unit (previously $6.50).",
  };

  return {
    sent: true,
    messageId: `clarify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    agentResponse: agentResponses[req.ambiguityType] || "Clarification received from supplier.",
    timestamp: new Date().toISOString(),
  };
}
