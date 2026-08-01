// RFQ intake adapter — mock email/Excel parsing for client RFQ → DemandLine[]

export interface ParsedDemandLine {
  mpn: string;
  qty: number;
  targetPrice: number;
  currency: string;
  requiredByDate: string;
  confidence: number;
}

export interface RfqIntakeResponse {
  lines: ParsedDemandLine[];
  parseErrors: { lineNo: number; error: string }[];
  overallConfidence: number;
}

export async function extractRfqFromEmail(req: {
  subject: string;
  body: string;
  attachments?: string[];
  senderEmail?: string;
}): Promise<RfqIntakeResponse> {
  const latency = Math.random() * (2500 - 800) + 800;
  const failureRate = 0.1; // 10% failure rate
  const line2FailRate = 0.4; // 40% chance line 2 fails specifically

  await new Promise((r) => setTimeout(r, latency));

  if (Math.random() < failureRate) {
    throw new Error(`Email parsing failed: unable to extract RFQ structure from email`);
  }

  // Mock parse of RFQ email — typically 3-5 lines
  const lineCount = Math.floor(Math.random() * 3) + 2;
  const lines: ParsedDemandLine[] = [];
  const parseErrors: { lineNo: number; error: string }[] = [];

  const mpns = ["STM32F407VG", "LM2596SN", "NE555", "LT1366", "TL072"];
  const requiredDates = ["2026-08-15", "2026-08-22", "2026-08-30", "2026-09-10"];

  for (let i = 1; i <= lineCount; i++) {
    // Line 2 specific failure (40% chance)
    if (i === 2 && Math.random() < line2FailRate) {
      parseErrors.push({ lineNo: i, error: "Qty field ambiguous — manual review needed" });
      continue;
    }

    lines.push({
      mpn: mpns[i % mpns.length],
      qty: Math.floor(Math.random() * 1000) + 100,
      targetPrice: Math.random() * 50 + 2,
      currency: "USD",
      requiredByDate: requiredDates[i % requiredDates.length],
      confidence: Math.random() * 0.2 + 0.75, // 75-95% confidence
    });
  }

  const overallConfidence = lines.length > 0 ? lines.reduce((a, l) => a + l.confidence, 0) / lines.length : 0;

  return { lines, parseErrors, overallConfidence };
}
