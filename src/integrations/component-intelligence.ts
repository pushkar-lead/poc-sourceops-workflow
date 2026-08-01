// Component intelligence adapter — mock Octopart-like stock lookup
// Returns distributor stock info before floating RFQ

export interface ComponentStockResult {
  vendor: string;
  mpn: string;
  stockQty: number;
  leadTimeDays: number;
  unitPrice: number;
  currency: string;
  dateCode: string;
  stockSource: string;
  confidence: number;
  lastUpdated: string;
}

export interface ComponentIntelligenceResponse {
  results: ComponentStockResult[];
  timestamp: string;
}

export async function lookupComponentStock(req: {
  mpn: string;
  manufacturer?: string;
}): Promise<ComponentIntelligenceResponse> {
  const latency = Math.random() * (3500 - 1200) + 1200;
  const failureRate = 0.08; // 8% failure rate
  const ambiguityRate = 0.15; // 15% ambiguity (multiple distributor options)

  await new Promise((r) => setTimeout(r, latency));

  if (Math.random() < failureRate) {
    throw new Error(`Stock lookup failed for ${req.mpn}: timeout or API error`);
  }

  // Mock distributor results (varies by MPN)
  const distributors = ["Arrow Electronics", "TechData", "Heilind", "WPL", "Sensormatic"];
  const resultsCount = Math.random() < ambiguityRate ? Math.floor(Math.random() * 3) + 2 : 1;

  const results: ComponentStockResult[] = [];
  for (let i = 0; i < resultsCount; i++) {
    const basePrice = Math.random() * 50 + 5;
    results.push({
      vendor: distributors[Math.floor(Math.random() * distributors.length)],
      mpn: req.mpn,
      stockQty: Math.floor(Math.random() * 5000) + 100,
      leadTimeDays: Math.floor(Math.random() * 14) + 2,
      unitPrice: basePrice,
      currency: "USD",
      dateCode: `25+`,
      stockSource: "warehouse",
      confidence: 0.85 + Math.random() * 0.15,
      lastUpdated: new Date().toISOString(),
    });
  }

  return { results, timestamp: new Date().toISOString() };
}
