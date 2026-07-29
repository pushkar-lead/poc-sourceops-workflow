import { create } from "zustand";

// In-memory (non-persisted) log of every mock external-API call the app makes.
// The Integrations console subscribes to this to show the live call feed.

export type CallStatus = "pending" | "ok" | "error";

export interface IntegrationCall {
  id: string;
  system: string;       // registry key, e.g. "icegate"
  systemLabel: string;  // human label
  endpoint: string;     // e.g. "POST /bill-of-entry"
  request: unknown;
  response?: unknown;
  status: CallStatus;
  latencyMs?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

interface LogState {
  calls: IntegrationCall[];
  chaosRate: number; // 0..1 — injected failure rate for demoing error handling
  begin: (system: string, systemLabel: string, endpoint: string, request: unknown) => string;
  end: (id: string, patch: { status: CallStatus; response?: unknown; latencyMs?: number; error?: string }) => void;
  setChaos: (rate: number) => void;
  clear: () => void;
}

let _seq = 0;
const cid = () => `call-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

export const useIntegrationLog = create<LogState>((set) => ({
  calls: [],
  chaosRate: 0,
  begin: (system, systemLabel, endpoint, request) => {
    const id = cid();
    const call: IntegrationCall = { id, system, systemLabel, endpoint, request, status: "pending", startedAt: Date.now() };
    set((s) => ({ calls: [call, ...s.calls].slice(0, 250) }));
    return id;
  },
  end: (id, patch) => set((s) => ({ calls: s.calls.map((c) => (c.id === id ? { ...c, ...patch, finishedAt: Date.now() } : c)) })),
  setChaos: (rate) => set({ chaosRate: Math.max(0, Math.min(1, rate)) }),
  clear: () => set({ calls: [] }),
}));
