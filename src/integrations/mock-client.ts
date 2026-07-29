import { useIntegrationLog } from "@/store/integration-log-store";

// Shared mock transport. Every adapter routes through mockCall so that:
//  - each call is logged to the integration console (pending → ok/error),
//  - latency is simulated (scaled by DEMO_SPEED),
//  - failures can be injected (per-call failRate OR the console "chaos" toggle),
//  - the seam is identical in shape to a real fetch()/axios call — swap `produce`
//    for a real request in production and delete this file.

export class IntegrationError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.status = status;
  }
}

export interface MockOpts {
  latencyMs?: [number, number];
  failRate?: number; // 0..1, on top of the global chaos rate
  failError?: { code: string; message: string; status?: number };
}

// DEMO_SPEED compresses real-world minutes/days into seconds for a demo.
const DEMO_SPEED = Number(process.env.NEXT_PUBLIC_DEMO_SPEED ?? 1) || 1;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockCall<TRes>(
  system: string,
  systemLabel: string,
  endpoint: string,
  request: unknown,
  produce: () => TRes,
  opts: MockOpts = {},
): Promise<TRes> {
  const log = useIntegrationLog.getState();
  const id = log.begin(system, systemLabel, endpoint, request);
  const [lo, hi] = opts.latencyMs ?? [300, 1200];
  const latency = Math.max(60, Math.round(rand(lo, hi) / DEMO_SPEED));
  const t0 = Date.now();
  await sleep(latency);

  const chaos = useIntegrationLog.getState().chaosRate;
  const failRate = Math.max(opts.failRate ?? 0, chaos);
  if (failRate > 0 && Math.random() < failRate) {
    const err = opts.failError ?? { code: "PROVIDER_ERROR", message: "Mock provider error", status: 502 };
    useIntegrationLog.getState().end(id, { status: "error", latencyMs: Date.now() - t0, error: `${err.code}: ${err.message}` });
    throw new IntegrationError(err.code, err.message, err.status ?? 502);
  }

  const res = produce();
  useIntegrationLog.getState().end(id, { status: "ok", latencyMs: Date.now() - t0, response: res });
  return res;
}

// small helpers shared by adapters
let _ref = 0;
export const ref = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${(_ref++).toString(36).toUpperCase()}`;
export const pickWeighted = <T>(items: [T, number][]): T => {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) { if ((r -= w) <= 0) return v; }
  return items[items.length - 1][0];
};
