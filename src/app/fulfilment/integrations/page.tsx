"use client";

import { useState } from "react";
import { Activity, Zap, Trash2, Radio } from "lucide-react";
import { INTEGRATIONS, type IntegrationSystem } from "@/integrations/registry";
import { mockCall } from "@/integrations/mock-client";
import { useIntegrationLog, type IntegrationCall } from "@/store/integration-log-store";
import { Panel, Pill, Button, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const toneFor = (s: IntegrationCall["status"]) => (s === "ok" ? "ok" : s === "error" ? "bad" : "warn");
const prioTone = (p: IntegrationSystem["priority"]) => (p === "must" ? "bad" : p === "should" ? "warn" : "neutral");

function ping(sys: IntegrationSystem) {
  return mockCall(sys.key, sys.label, "GET /health", { ping: true }, () => ({ ok: true, mock: true }), { latencyMs: [150, 600] }).catch(() => {});
}

export default function IntegrationsConsolePage() {
  const calls = useIntegrationLog((s) => s.calls);
  const chaosRate = useIntegrationLog((s) => s.chaosRate);
  const setChaos = useIntegrationLog((s) => s.setChaos);
  const clear = useIntegrationLog((s) => s.clear);
  const [open, setOpen] = useState<string | null>(null);

  const ok = calls.filter((c) => c.status === "ok").length;
  const err = calls.filter((c) => c.status === "error").length;
  const pending = calls.filter((c) => c.status === "pending").length;
  const done = calls.filter((c) => c.latencyMs != null);
  const avg = done.length ? Math.round(done.reduce((a, c) => a + (c.latencyMs ?? 0), 0) / done.length) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations"
        description={
          <>
            Every external system the real project wires in, running as <b className="text-foreground">in-process mocks</b> (simulated latency + failures). All flow actions route through these adapters, so the console shows a live feed of the API calls the app makes.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setChaos(chaosRate > 0 ? 0 : 0.3)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition", chaosRate > 0 ? "border-bad bg-bad-bg text-bad" : "text-muted-foreground hover:text-foreground")}
              title="Inject ~30% random API failures to demo error handling">
              <Zap className="h-3.5 w-3.5" /> Chaos {chaosRate > 0 ? "on" : "off"}
            </button>
            <Button variant="outline" onClick={clear}><Trash2 className="h-4 w-4" /> Clear log</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Calls" value={String(calls.length)} />
        <Stat label="OK" value={String(ok)} tone="ok" />
        <Stat label="Errors" value={String(err)} tone={err ? "bad" : "neutral"} />
        <Stat label="Avg latency" value={`${avg} ms`} sub={pending ? `${pending} in flight` : undefined} />
      </div>

      {/* Systems catalogue */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {INTEGRATIONS.map((sys) => (
          <Panel key={sys.key}
            title={<span className="flex items-center gap-2">{sys.label}<Pill tone={prioTone(sys.priority)}>{sys.priority}</Pill>{sys.criticalPath && <Pill tone="info">critical path</Pill>}</span>}
            actions={<Button variant="outline" onClick={() => ping(sys)}><Radio className="h-4 w-4" /> Ping</Button>}>
            <p className="text-sm text-muted-foreground">{sys.description}</p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div><span className="text-faint">env</span> <span className="font-mono text-foreground">{sys.envVar}</span></div>
              <div><span className="text-faint">base</span> <span className="font-mono text-muted-foreground">{sys.baseUrl}</span></div>
              <div><span className="text-faint">wired into</span> {sys.wiredInto.map((w) => <span key={w} className="mr-1 font-mono text-primary">{w}</span>)}</div>
            </div>
            <div className="mt-3 space-y-1 border-t pt-2">
              {sys.endpoints.map((e) => (
                <div key={e.path} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-12 shrink-0 font-mono font-semibold text-muted-foreground">{e.method}</span>
                  <span className="font-mono text-foreground">{e.path}</span>
                  <span className="text-faint">· {e.purpose}</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      {/* Live call log */}
      <Panel title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Live API call log</span>}>
        {calls.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No calls yet — drive the flow (file a BOE, create a shipment, fetch an escrow invoice, fetch a lab result…) or hit <b>Ping</b>.</div>
        ) : (
          <div className="space-y-1.5">
            {calls.map((c) => (
              <div key={c.id} className="rounded-lg border">
                <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-muted/50">
                  <Pill tone={toneFor(c.status)}>{c.status}</Pill>
                  <span className="font-medium">{c.systemLabel}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.endpoint}</span>
                  <span className="ml-auto text-xs tabular-nums text-faint">{c.latencyMs != null ? `${c.latencyMs} ms` : "…"}</span>
                </button>
                {open === c.id && (
                  <div className="grid grid-cols-1 gap-2 border-t bg-muted/30 p-3 text-xs md:grid-cols-2">
                    <div>
                      <div className="mb-1 font-medium uppercase tracking-wide text-faint">Request</div>
                      <pre className="overflow-x-auto rounded bg-card p-2 font-mono text-[11px]">{JSON.stringify(c.request, null, 2)}</pre>
                    </div>
                    <div>
                      <div className="mb-1 font-medium uppercase tracking-wide text-faint">{c.status === "error" ? "Error" : "Response"}</div>
                      <pre className="overflow-x-auto rounded bg-card p-2 font-mono text-[11px]">{c.status === "error" ? c.error : JSON.stringify(c.response, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" | "neutral" }) {
  return (
    <div className="rounded-[var(--radius)] border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tnum", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
