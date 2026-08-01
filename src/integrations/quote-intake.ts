// Quote intake adapter — mock email parsing for supplier quote → QuoteLine[]

export interface ParsedQuoteLine {
  quotedMpn: string;
  stockQty: number;
  unitPrice: number;
  currency: string;
  leadTimeDays: number;
  leadTimeUnit: "days" | "weeks" | "months";
  incoterm: string;
  location: string;
  packaging: string;
  validityDays: number;
  moq: number;
  spq: number;
  dateCode: string;
  paymentTerms: string;
  confidence: number;
}

export interface QuoteIntakeResponse {
  lines: ParsedQuoteLine[];
  parseErrors: { lineNo: number; error: string }[];
  overallConfidence: number;
}

export async function extractQuoteFromEmail(req: {
  rfqBundleId: string;
  supplierEmail: string;
  subject: string;
  body: string;
  attachments?: string[];
}): Promise<QuoteIntakeResponse> {
  const latency = Math.random() * (2000 - 600) + 600;
  const failureRate = 0.1; // 10% failure rate
  const ambiguityRate = 0.3; // 30% ambiguity (partial parse, multiple issues)

  await new Promise((r) => setTimeout(r, latency));

  if (Math.random() < failureRate) {
    throw new Error(`Quote email parsing failed: unable to extract quote structure`);
  }

  // Mock parse of supplier quote email — typically 2-4 lines
  const lineCount = Math.floor(Math.random() * 3) + 1;
  const lines: ParsedQuoteLine[] = [];
  const parseErrors: { lineNo: number; error: string }[] = [];

  const incoterms = ["EXW", "FOB", "CIF", "DDP"];
  const locations = ["Shanghai", "Shenzhen", "Hong Kong", "Singapore"];
  const packagings = ["Tape & Reel", "Bulk", "Cut Tape"];
  const paymentTerms = ["Advance", "30% Advance / 70% Balance", "Net 30"];

  for (let i = 1; i <= lineCount; i++) {
    // Ambiguity: some lines might have issues
    if (Math.random() < ambiguityRate * 0.3) {
      parseErrors.push({ lineNo: i, error: "MOQ field ambiguous or missing" });
      continue;
    }

    const basePrice = Math.random() * 40 + 3;
    lines.push({
      quotedMpn: `STM32F${400 + i}VG`,
      stockQty: Math.floor(Math.random() * 2000) + 500,
      unitPrice: basePrice,
      currency: "USD",
      leadTimeDays: Math.floor(Math.random() * 10) + 3,
      leadTimeUnit: "days",
      incoterm: incoterms[Math.floor(Math.random() * incoterms.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      packaging: packagings[Math.floor(Math.random() * packagings.length)],
      validityDays: Math.floor(Math.random() * 15) + 15,
      moq: Math.floor(Math.random() * 500) + 100,
      spq: Math.floor(Math.random() * 100) + 1,
      dateCode: "25+",
      paymentTerms: paymentTerms[Math.floor(Math.random() * paymentTerms.length)],
      confidence: Math.random() * 0.25 + 0.65, // 65-90% confidence
    });
  }

  const overallConfidence = lines.length > 0 ? lines.reduce((a, l) => a + l.confidence, 0) / lines.length : 0;

  return { lines, parseErrors, overallConfidence };
}
