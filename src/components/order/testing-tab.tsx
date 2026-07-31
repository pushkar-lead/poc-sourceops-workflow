"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Pencil, History, Wand2, RefreshCw, Mail, MailQuestion, FileText, Download, Eye,
  AlertTriangle, ShieldAlert, Lock, ChevronRight, ChevronDown, Check, FlaskConical, Clock,
  Zap, Truck, Factory, Users, Landmark, Layers,
} from "lucide-react";
import type { OrderBundle, Lot, LotTest, WhlReport, LabEmail, TestProcessStatus, NotifyParty } from "@/types";
import {
  TEST_STANDARDS, WHL_PROCESSES, TEST_PROCESS_STATUSES, WHL_CONTACT, WHL_SLA_BUSINESS_DAYS,
  WHL_EMAIL_TEMPLATES, statusTone, stageLabel,
} from "@/data/enums";
import { Panel, Pill, StatusPill, Button, Progress, Field } from "@/components/ui/primitives";
import { Select } from "@/components/ui/form";
import { useStore } from "@/store/store";
import { useRole } from "@/lib/role";
import {
  escrowRemaining, specForMpn, lotTestProgress, currentReport, lotEmails, unmatchedEmails,
  testAutofillGaps, overdueUpdateRequests, reconciliationAlerts, testingSummary, lotResults, lotStageProgress,
} from "@/store/selectors";
import { qtyfmt, cn } from "@/lib/utils";
import { ComposeWhlEmailModal, MatchLabEmailModal, NotifyLotResultModal, BulkNotifyModal, RecordDispatchModal } from "@/components/order/modals";
import { TestingStageChain, TestingStageBar } from "@/components/order/testing-stages";

type Sub = "mpns" | "lots" | "mail";

const SUBS: { id: Sub; label: string }[] = [
  { id: "mpns", label: "MPNs & tests" },
  { id: "lots", label: "Lots · status · reports" },
  { id: "mail", label: "WHL correspondence" },
];

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

/** Small inline notice — used for the reconciliation / SLA / autofill alerts. */
function Notice({ tone, icon, children, action }: { tone: "warn" | "bad" | "info"; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  const bg = tone === "bad" ? "border-[color-mix(in_srgb,var(--bad)_40%,transparent)] bg-bad-bg text-bad"
    : tone === "warn" ? "border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-warn-bg text-warn"
    : "border-primary/40 bg-accent-soft text-primary";
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs", bg)}>
      <span className="inline-flex items-start gap-1.5">{icon}<span>{children}</span></span>
      {action}
    </div>
  );
}

/** Current (or newest) report for a lot — used in the scope banner. */
const report0 = (lot: Lot) => currentReport(lot);

/**
 * Card that starts collapsed. An order can carry 100 lots; rendering every card open
 * makes the tab unscrollable and the 100th lot unreachable. The summary row stays
 * visible while collapsed so you can still scan for the one you want, and the bulky
 * actions only appear once it's open.
 */
function CollapsibleCard({
  open, onToggle, title, summary, actions, children,
}: {
  open: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border bg-card shadow-sm">
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", open && "border-b")}>
        <button onClick={onToggle} aria-expanded={open}
          title={open ? "Minimize" : "Expand"}
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-primary">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <h3 className="min-w-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        </button>
        {summary && <div className="flex flex-wrap items-center gap-2 text-xs">{summary}</div>}
        {open && actions}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

/** "3 of 12 expanded · collapse all" strip above a list of collapsible cards. */
function ExpandBar({
  total, openCount, noun, onCollapseAll, onExpandAll,
}: { total: number; openCount: number; noun: string; onCollapseAll: () => void; onExpandAll?: () => void }) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>{total} {noun}{total === 1 ? "" : "s"} · {openCount} expanded</span>
      {openCount > 0 && <button onClick={onCollapseAll} className="font-medium text-primary hover:underline">collapse all</button>}
      {onExpandAll && openCount < total && total <= 12 && (
        <button onClick={onExpandAll} className="font-medium text-primary hover:underline">expand all</button>
      )}
      <span className="text-faint">click a row to open it</span>
    </div>
  );
}

function Denied({ what }: { what: string }) {
  return <span className="inline-flex items-center gap-1 text-[11px] text-faint"><Lock className="h-3 w-3" /> {what} needs the SC or Mgmt persona</span>;
}

export function TestingTab({
  b, id, onAdd, onRelease, onRefund, onExtend,
}: { b: OrderBundle; id: string; onAdd: () => void; onRelease: () => void; onRefund: () => void; onExtend: () => void }) {
  const [sub, setSub] = useState<Sub>("lots");
  const [compose, setCompose] = useState<{ lotId?: string; templateId?: string } | null>(null);
  const [notify, setNotify] = useState<{ lotId: string; party: NotifyParty } | null>(null);
  const [bulk, setBulk] = useState<NotifyParty | null>(null);
  const [sel, setSel] = useState<string[]>([]);   // lot ids ticked for a combined action
  const [match, setMatch] = useState<LabEmail | null>(null);
  const [dispatch, setDispatch] = useState<string | null>(null); // lot id whose dispatch is being recorded
  const [track, setTrack] = useState<string | null>(null);       // lot id whose lifecycle is expanded in the roll-up
  const { canEditTests, canEmailLab } = useRole();

  const autofillMpnTests = useStore((s) => s.autofillMpnTests);
  const syncWhlInbox = useStore((s) => s.syncWhlInbox);
  const requestWhlUpdate = useStore((s) => s.requestWhlUpdate);
  const escalateLabEmail = useStore((s) => s.escalateLabEmail);
  const reconcileReportPo = useStore((s) => s.reconcileReportPo);

  // ALL = order-wide total; a lot id scopes every number, alert and section below to that lot
  const [scope, setScope] = useState<string>("ALL");
  const scoped = b.lots.find((l) => l.id === scope);  // undefined for "ALL" (or a stale id after a reset)
  const lotId = scoped?.id;

  const sum = testingSummary(b, lotId);
  const rows = lotResults(b);
  const gaps = testAutofillGaps(b).filter((g) => !scoped || g.mpn === scoped.orderLineMpn);
  const overdue = overdueUpdateRequests(b).filter((o) => !lotId || o.lot.id === lotId);
  const alerts = reconciliationAlerts(b).filter((a) => !lotId || a.lotId === lotId);
  const unmatched = unmatchedEmails(b); // never lot-scoped — that's the point of the queue
  const hasFail = b.lots.some((l) => l.testStatus === "FAIL");
  const hasPass = b.lots.some((l) => l.testStatus === "PASS");
  const canRelease = !!b.escrow && escrowRemaining(b) > 0;
  const pendingExt = b.escrow?.extensions?.some((x) => x.status === "REQUESTED");
  const testedPct = sum.tests ? Math.round((sum.passed / sum.tests) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ---- roll-up + the two automated actions ---- */}
      <Panel title="WHL testing — MPN × lot × test"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* lot scope — totals for the order, or drill into one lot's result */}
            <Select className="w-56 py-1 text-xs" value={scope} onChange={(e) => setScope(e.target.value)}
              title="Scope the results below to one lot">
              <option value="ALL">All lots — order total ({b.lots.length})</option>
              {b.lots.map((l) => (
                <option key={l.id} value={l.id}>{l.lotCode} · {l.orderLineMpn} · {l.testStatus}</option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => syncWhlInbox(id)} title="Poll the WHL mailbox and apply interim statuses / reports">
              <RefreshCw className="h-4 w-4" /> Sync WHL inbox
            </Button>
            <Button variant="outline" disabled={!canEditTests} onClick={() => autofillMpnTests(id)}
              title={canEditTests ? "Re-parse the PO's test table" : "Only SC / Mgmt may change test requirements"}>
              <Wand2 className="h-4 w-4" /> Auto-fill tests from PO
            </Button>
            <Button variant="outline" onClick={onAdd}><Plus className="h-4 w-4" /> Add lot</Button>
          </div>
        }>
        {/* scope banner — makes it obvious whether you're looking at the total or one lot */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          {scoped ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Pill tone="info">viewing {scoped.lotCode}</Pill>
              <span className="font-mono text-muted-foreground">{scoped.orderLineMpn}</span>
              <span className="text-faint">{scoped.lab ?? "—"} · WO {scoped.workOrderNo ?? "—"} · qty {qtyfmt(scoped.qty)} / sample {scoped.sampleQty}</span>
              <StatusPill status={scoped.testStatus} />
              <TestingStageBar lot={scoped} className="w-48" />
              {report0(scoped) && <span className="text-muted-foreground">report <b className="text-foreground">{report0(scoped)!.reportNo}</b> — {report0(scoped)!.conclusion.replace(/_/g, " ").toLowerCase()}</span>}
              <button onClick={() => setScope("ALL")} className="font-medium text-primary underline">show order total</button>
            </span>
          ) : (
            <span className="text-muted-foreground">Order total across <b className="text-foreground">{b.lots.length}</b> lot(s) — pick a lot above (or click a row below) to see just that lot&apos;s result.</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={scoped ? "Lot" : "Lots"} value={scoped ? scoped.lotCode : String(sum.lots)} />
          <Stat label="Tests tracked" value={String(sum.tests)} />
          <Stat label="Passed" value={`${sum.passed}/${sum.tests}`} tone={sum.tests && sum.passed === sum.tests ? "ok" : undefined} />
          <Stat label="F.A.R." value={String(sum.far)} tone={sum.far ? "warn" : undefined} />
          <Stat label="Not acceptable" value={String(sum.failed)} tone={sum.failed ? "bad" : undefined} />
          <Stat label="Reports on file" value={String(sum.reports)} />
        </div>
        <div className="mt-3"><Progress value={testedPct} /></div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {sum.passed}/{sum.tests} required tests passed {scoped ? `on ${scoped.lotCode}` : `across ${sum.lots} lot(s)`}.
          {sum.open > 0 && ` ${sum.open} still open.`}
          {(sum.far > 0 || sum.notConducted > 0) && " F.A.R. and Not-Conducted results still need follow-up before release."}
        </p>

        {/* ---- bulk actions: tick lots, act once (at 50 lots you don't mail one by one) ---- */}
        {b.lots.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card-2 px-3 py-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Select lots</span>
            <button onClick={() => setSel(b.lots.map((l) => l.id))} className="font-medium text-primary hover:underline">all ({b.lots.length})</button>
            <button onClick={() => setSel(rows.filter((r) => r.report).map((r) => r.lot.id))} className="font-medium text-primary hover:underline">with report ({rows.filter((r) => r.report).length})</button>
            <button onClick={() => setSel(rows.filter((r) => r.report?.conclusion === "ACCEPTABLE").map((r) => r.lot.id))} className="font-medium text-primary hover:underline">acceptable ({rows.filter((r) => r.report?.conclusion === "ACCEPTABLE").length})</button>
            <button onClick={() => setSel(rows.filter((r) => r.report && r.report.conclusion !== "ACCEPTABLE").map((r) => r.lot.id))} className="font-medium text-primary hover:underline">not acceptable ({rows.filter((r) => r.report && r.report.conclusion !== "ACCEPTABLE").length})</button>
            <button onClick={() => setSel(rows.filter((r) => r.progress.far > 0).map((r) => r.lot.id))} className="font-medium text-primary hover:underline">F.A.R. ({rows.filter((r) => r.progress.far > 0).length})</button>
            {sel.length > 0 && <button onClick={() => setSel([])} className="text-muted-foreground hover:underline">clear</button>}
            <span className="ml-auto inline-flex flex-wrap items-center gap-2">
              <span className={cn("font-medium", sel.length ? "text-foreground" : "text-faint")}>{sel.length} selected</span>
              <BulkActionsMenu b={b} id={id} selected={sel} canEmail={canEmailLab} onBulk={setBulk} />
            </span>
          </div>
        )}

        {/* lot-wise results — the total above, the breakdown here; click a row to scope */}
        {b.lots.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[780px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-card-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 px-3 py-2 text-left">
                    <input type="checkbox" aria-label="Select all lots"
                      checked={sel.length > 0 && sel.length === b.lots.length}
                      onChange={(e) => setSel(e.target.checked ? b.lots.map((l) => l.id) : [])} />
                  </th>
                  <th className="px-3 py-2 text-left">Lot</th>
                  <th className="px-3 py-2 text-left">MPN</th>
                  <th className="px-3 py-2 text-left">Verdict</th>
                  <th className="px-3 py-2 text-left">Tests</th>
                  <th className="px-3 py-2 text-center">F.A.R.</th>
                  <th className="px-3 py-2 text-center">Not acc.</th>
                  <th className="px-3 py-2 text-left">Current report</th>
                  <th className="px-3 py-2 text-left">Outstanding</th>
                  <th className="px-3 py-2 text-left">Progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.lot.id}>
                  <tr onClick={() => setScope(r.lot.id === scope ? "ALL" : r.lot.id)}
                    className={cn("cursor-pointer border-b last:border-0 hover:bg-muted/60", r.lot.id === scope && "bg-accent-soft/60")}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${r.lot.lotCode}`} checked={sel.includes(r.lot.id)}
                        onChange={(e) => setSel((p) => (e.target.checked ? [...p, r.lot.id] : p.filter((x) => x !== r.lot.id)))} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.lot.lotCode}</div>
                      <div className="text-[11px] text-faint">{r.lot.lab ?? "—"} · WO {r.lot.workOrderNo ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.lot.orderLineMpn}</td>
                    <td className="px-3 py-2"><StatusPill status={r.lot.testStatus} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="tnum text-xs">{r.progress.settled}/{r.progress.total}</span>
                        <span className="w-20"><Progress value={r.pct} /></span>
                      </div>
                    </td>
                    <td className={cn("px-3 py-2 text-center tnum", r.progress.far && "font-semibold text-warn")}>{r.progress.far || "—"}</td>
                    <td className={cn("px-3 py-2 text-center tnum", r.progress.failed && "font-semibold text-bad")}>{r.progress.failed || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.report ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <span className="font-mono">{r.report.reportNo}</span>
                          <Pill tone={r.report.conclusion === "ACCEPTABLE" ? "ok" : "bad"}>{r.report.conclusion.replace(/_/g, " ")}</Pill>
                          {r.revisions > 1 && <span className="text-faint">{r.revisions} rev.</span>}
                        </span>
                      ) : <span className="text-warn">not available</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={r.blocker ? "text-warn" : "text-ok"}>{r.blocker ?? "clear"}</span>
                      {r.overdueDays > 0 && <span className="ml-1 text-bad">· chase {r.overdueDays}d overdue</span>}
                      {r.awaiting > 0 && r.overdueDays === 0 && <span className="ml-1 text-muted-foreground">· awaiting reply</span>}
                    </td>
                    {/* track progress without leaving the roll-up — expands the lifecycle in place */}
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <LotProgressToggle lot={r.lot} open={track === r.lot.id}
                        onToggle={() => setTrack(track === r.lot.id ? null : r.lot.id)} />
                    </td>
                  </tr>
                  {track === r.lot.id && (
                    <tr className="border-b last:border-0 bg-card-2/60">
                      <td colSpan={10} className="px-3 py-3">
                        <TestingStageChain orderId={id} lot={r.lot} canEdit={canEditTests}
                          onRecordDispatch={() => setDispatch(r.lot.id)} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- automatic alerts: reconciliation · SLA · autofill gaps · unmatched mail ---- */}
        {(alerts.length > 0 || overdue.length > 0 || gaps.length > 0 || unmatched.length > 0) && (
          <div className="mt-3 space-y-1.5">
            {alerts.map((a, i) => (
              <Notice key={`al-${i}`} tone={a.kind === "MPN" ? "bad" : "warn"} icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                action={a.kind === "PO" ? (
                  <button className="font-medium underline" onClick={() => reconcileReportPo(id, a.lotId, a.reportId)}>Reconcile to PO on file</button>
                ) : undefined}>
                <b>{a.lotCode} · {a.reportNo}</b> — {a.message}
              </Notice>
            ))}
            {overdue.map((o) => (
              <Notice key={`sla-${o.lot.id}`} tone="warn" icon={<Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                action={
                  <span className="flex gap-3">
                    <button className="font-medium underline disabled:opacity-50" disabled={!canEmailLab} onClick={() => requestWhlUpdate(id, o.lot.id)}>Chase again</button>
                    <button className="font-medium underline" onClick={() => {
                      const em = lotEmails(b, o.lot.id).find((m) => m.direction === "OUT" && m.status === "AWAITING_RESPONSE");
                      if (em) escalateLabEmail(id, em.id);
                    }}>Escalate</button>
                  </span>
                }>
                <b>{o.lot.lotCode}</b> — update requested {o.lot.lastUpdateRequestAt}, unanswered for {o.days} business day(s) (SLA {WHL_SLA_BUSINESS_DAYS}).
              </Notice>
            ))}
            {gaps.length > 0 && (
              <Notice tone="warn" icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                action={<button className="font-medium underline" onClick={() => setSub("mpns")}>Review MPNs</button>}>
                Auto-fill failed / incomplete for <b>{gaps.map((g) => g.mpn).join(", ")}</b> — needs manual review.
              </Notice>
            )}
            {unmatched.length > 0 && (
              <Notice tone="info" icon={<MailQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                action={<button className="font-medium underline" onClick={() => setSub("mail")}>Open match queue</button>}>
                {unmatched.length} inbound WHL email(s) couldn&apos;t be matched to a lot — held for manual matching.
              </Notice>
            )}
          </div>
        )}

        {/* ---- escrow hooks kept exactly as before: a PASS releases, a FAIL refunds ---- */}
        {hasPass && canRelease && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--ok)_40%,transparent)] bg-ok-bg p-2.5 text-sm">
            <span className="text-ok">A lot PASSED — release the escrow tranche to the seller.</span>
            <div className="flex gap-2">
              {b.escrow && <Button variant="outline" onClick={onExtend} disabled={pendingExt}>{pendingExt ? "Extension pending…" : "Extend window"}</Button>}
              <Button onClick={onRelease}>Release escrow</Button>
            </div>
          </div>
        )}
        {b.paymentMode === "ESCROW" && (
          <p className="mt-3 text-xs text-muted-foreground">
            A <b className="text-ok">PASS</b> releases the escrow tranche; a <b className="text-bad">FAIL</b> starts the return/refund path.
            {hasFail && <> <button onClick={onRefund} className="text-primary hover:underline">Refund escrow →</button></>}
          </p>
        )}
      </Panel>

      <div className="flex gap-1.5 overflow-x-auto border-b">
        {SUBS.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={cn("-mb-px whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm transition",
              sub === t.id ? "border-primary bg-accent-soft font-semibold text-primary"
                : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {t.label}
            {t.id === "mail" && sum.unmatched > 0 && <span className="ml-1.5 rounded-full bg-warn-bg px-1.5 text-[10px] font-semibold text-warn">{sum.unmatched}</span>}
            {t.id === "mpns" && sum.gaps > 0 && <span className="ml-1.5 rounded-full bg-warn-bg px-1.5 text-[10px] font-semibold text-warn">{sum.gaps}</span>}
          </button>
        ))}
      </div>

      {sub === "mpns" && <MpnTestsSection b={b} id={id} canEdit={canEditTests} onlyMpn={scoped?.orderLineMpn} />}
      {sub === "lots" && <LotsSection b={b} id={id} onlyLotId={lotId} canEdit={canEditTests} canEmail={canEmailLab}
        onCompose={(l, t) => setCompose({ lotId: l, templateId: t })} onNotify={(l, p) => setNotify({ lotId: l, party: p })}
        onDispatch={setDispatch} />}
      {sub === "mail" && <MailSection key={lotId ?? "ALL"} b={b} id={id} defaultLotId={lotId} canEmail={canEmailLab} onCompose={(l, t) => setCompose({ lotId: l, templateId: t })} onMatch={setMatch} />}

      {compose && <ComposeWhlEmailModal orderId={id} lotId={compose.lotId} templateId={compose.templateId} onClose={() => setCompose(null)} />}
      {notify && <NotifyLotResultModal orderId={id} lotId={notify.lotId} party={notify.party} onClose={() => setNotify(null)} />}
      {bulk && <BulkNotifyModal orderId={id} lotIds={sel} party={bulk} onClose={() => setBulk(null)} />}
      {match && <MatchLabEmailModal orderId={id} email={match} onClose={() => setMatch(null)} />}
      {dispatch && <RecordDispatchModal orderId={id} lotId={dispatch} onClose={() => setDispatch(null)} />}
    </div>
  );
}

/**
 * "Track progress" control on a roll-up row: shows where the lot is at a glance and
 * expands the full lifecycle stepper underneath without navigating away.
 */
function LotProgressToggle({ lot, open, onToggle }: { lot: Lot; open: boolean; onToggle: () => void }) {
  const { stage, done, total, complete } = lotStageProgress(lot);
  return (
    <button onClick={onToggle}
      title={open ? "Hide the testing lifecycle" : "Track progress — show the testing lifecycle for this lot"}
      className={cn("inline-flex max-w-[13rem] items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition hover:border-primary hover:text-primary",
        open && "border-primary bg-accent-soft text-primary")}>
      {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
      <span className="truncate">{stage ? stageLabel(stage) : "Not started"}</span>
      <span className={cn("shrink-0 tnum", complete ? "text-ok" : "text-faint")}>{Math.max(0, done)}/{total}</span>
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tnum", color)}>{value}</div>
    </div>
  );
}

// ============================ 1 · MPN & test auto-fill ============================

function MpnTestsSection({ b, id, canEdit, onlyMpn }: { b: OrderBundle; id: string; canEdit: boolean; onlyMpn?: string }) {
  const autofillMpnTests = useStore((s) => s.autofillMpnTests);
  const addMpnTest = useStore((s) => s.addMpnTest);
  const removeMpnTest = useStore((s) => s.removeMpnTest);
  const [editing, setEditing] = useState<string | null>(null);
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const [name, setName] = useState<string>(WHL_PROCESSES[0]);
  const [standard, setStandard] = useState<string>("AS6081");
  const [openMpns, setOpenMpns] = useState<Set<string>>(new Set());

  const shown = b.lines.filter((l) => !onlyMpn || l.mpn === onlyMpn);
  // filtering to one MPN is already a request to see it — don't make them click twice
  const isOpen = (mpn: string) => openMpns.has(mpn) || shown.length === 1;
  const toggle = (mpn: string) => setOpenMpns((p) => {
    const n = new Set(p);
    if (n.has(mpn)) n.delete(mpn); else n.add(mpn);
    return n;
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Test requirements are <b className="text-foreground">parsed off the PO</b>, never typed — the PO already carries the test table.
        Manual edits are allowed as an override and every one is logged (who · when · before → after).
      </p>
      {onlyMpn && <p className="text-xs text-muted-foreground">Filtered to <span className="font-mono text-foreground">{onlyMpn}</span> — the MPN of the lot selected above.</p>}
      {shown.length > 1 && (
        <ExpandBar total={shown.length} openCount={shown.filter((l) => openMpns.has(l.mpn)).length} noun="MPN"
          onCollapseAll={() => setOpenMpns(new Set())}
          onExpandAll={() => setOpenMpns(new Set(shown.map((l) => l.mpn)))} />
      )}
      {b.lines.length === 0 ? <Empty text="No order lines." /> : shown.map((line) => {
        const spec = specForMpn(b, line.mpn);
        const failed = spec?.autofill === "FAILED";
        const none = line.testingMode === "NONE";
        const isEditing = editing === line.mpn;
        const lotsOfMpn = b.lots.filter((l) => l.orderLineMpn === line.mpn);
        const open = isOpen(line.mpn);
        return (
          <CollapsibleCard key={line.id} open={open} onToggle={() => toggle(line.mpn)}
            title={<span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs normal-case text-foreground">{line.mpn}</span>
              <Pill tone={none ? "neutral" : "info"}>{line.testingMode}</Pill>
              <span className="font-normal normal-case tracking-normal text-faint">{line.make} · qty {qtyfmt(line.quantity)} · {lotsOfMpn.length} lot(s)</span>
            </span>}
            summary={<>
              {!spec ? <Pill tone="warn">not parsed</Pill>
                : failed ? <Pill tone="bad">auto-fill failed</Pill>
                : <Pill tone="ok">auto-filled</Pill>}
              {/* enough to triage while collapsed: how many tests, and whether a human touched them */}
              <span className="text-muted-foreground tnum">{spec?.tests.length ?? 0} test{(spec?.tests.length ?? 0) === 1 ? "" : "s"}</span>
              {(spec?.tests.filter((t) => t.source === "MANUAL").length ?? 0) > 0 && (
                <span className="text-faint">{spec!.tests.filter((t) => t.source === "MANUAL").length} manual</span>
              )}
            </>}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setOpenAudit(openAudit === line.mpn ? null : line.mpn)} title="Audit trail">
                  <History className="h-4 w-4" /> {spec?.audit.length ?? 0}
                </Button>
                <Button variant="outline" disabled={!canEdit} onClick={() => setEditing(isEditing ? null : line.mpn)}
                  title={canEdit ? "Manually add / delete tests" : "Only SC / Mgmt may edit tests"}>
                  <Pencil className="h-4 w-4" /> {isEditing ? "Done" : "Edit tests"}
                </Button>
              </div>
            }>
            {failed && (
              <div className="mb-3">
                <Notice tone="bad" icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  action={<button className="font-medium underline disabled:opacity-50" disabled={!canEdit} onClick={() => autofillMpnTests(id, line.mpn)}>Retry parse</button>}>
                  <b>Auto-fill failed — needs manual review.</b> {spec?.autofillNote}
                </Notice>
              </div>
            )}
            {!spec && !none && (
              <div className="mb-3">
                <Notice tone="warn" icon={<Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  action={<button className="font-medium underline disabled:opacity-50" disabled={!canEdit} onClick={() => autofillMpnTests(id, line.mpn)}>Auto-fill now</button>}>
                  No test list yet for this MPN — parse it off {b.supplierPoNo ? `Supplier PO ${b.supplierPoNo}` : "the PO"}.
                </Notice>
              </div>
            )}

            {spec && (
              <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <span>source: <b className="text-foreground">{spec.sourceDoc ?? "—"}</b></span>
                <span>parsed: {spec.parsedAt ?? "—"}</span>
                {spec.confidence !== undefined && <span>confidence: {Math.round(spec.confidence * 100)}%</span>}
                <span>{spec.tests.filter((t) => t.source === "AUTO_PO").length} auto · {spec.tests.filter((t) => t.source === "MANUAL").length} manual</span>
              </div>
            )}

            {spec && spec.tests.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {spec.tests.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">{t.name}</span>
                    {t.standard && <Pill tone="neutral">{t.standard}</Pill>}
                    <Pill tone={t.source === "AUTO_PO" ? "info" : "warn"}>{t.source === "AUTO_PO" ? "from PO" : "manual"}</Pill>
                    {t.source === "MANUAL" && t.addedBy && <span className="text-[11px] text-faint">{t.addedBy} · {t.addedAt}</span>}
                    {isEditing && (
                      <button onClick={() => removeMpnTest(id, line.mpn, t.id)} className="text-bad hover:opacity-70" title="Delete test (logged)">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text={none ? "This MPN needs no incoming test per the PO." : "No tests on file for this MPN."} />
            )}

            {isEditing && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
                <label className="min-w-[220px] flex-1 space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Add test</span>
                  <Select value={name} onChange={(e) => setName(e.target.value)}>
                    {WHL_PROCESSES.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </label>
                <label className="w-32 space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Standard</span>
                  <Select value={standard} onChange={(e) => setStandard(e.target.value)}>
                    <option value="">—</option>
                    {TEST_STANDARDS.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </label>
                <Button onClick={() => addMpnTest(id, line.mpn, { name, standard: standard || undefined })}><Plus className="h-4 w-4" /> Add</Button>
                <p className="w-full text-[11px] text-faint">Adds to this MPN&apos;s list and to every lot of it. Logged as a manual override.</p>
              </div>
            )}
            {!canEdit && <p className="mt-2"><Denied what="Editing tests" /></p>}

            {openAudit === line.mpn && (
              <div className="mt-3 rounded-lg border bg-card-2 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Audit trail — test requirement changes</div>
                {(spec?.audit.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">Nothing logged yet.</p> : (
                  <ol className="space-y-2">
                    {spec!.audit.slice().reverse().map((a) => (
                      <li key={a.id} className="flex gap-2 text-xs">
                        <Pill tone={a.action === "DELETE" ? "bad" : a.action === "ADD" ? "warn" : "neutral"}>{a.action}</Pill>
                        <div className="min-w-0">
                          <div className="text-foreground">{a.target} <span className="text-faint">·</span> {a.before ?? "—"} → {a.after ?? "—"}</div>
                          <div className="text-muted-foreground">{a.by} · {a.at}{a.note ? ` · ${a.note}` : ""}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </CollapsibleCard>
        );
      })}
    </div>
  );
}

// ==================== 2 · lots: status tracker + report repository ====================

function LotsSection({
  b, id, onlyLotId, canEdit, canEmail, onCompose, onNotify, onDispatch,
}: { b: OrderBundle; id: string; onlyLotId?: string; canEdit: boolean; canEmail: boolean; onCompose: (lotId: string, templateId?: string) => void; onNotify: (lotId: string, party: NotifyParty) => void; onDispatch: (lotId: string) => void }) {
  const [openLots, setOpenLots] = useState<Set<string>>(new Set());
  if (b.lots.length === 0) return <Empty text="No lots yet — add one to start a WHL / self-test record." />;
  const lots = onlyLotId ? b.lots.filter((l) => l.id === onlyLotId) : b.lots;
  // scoping to a single lot is already a request to see it — don't make them click twice
  const isOpen = (lotId: string) => openLots.has(lotId) || lots.length === 1;
  const toggle = (lotId: string) => setOpenLots((p) => {
    const n = new Set(p);
    if (n.has(lotId)) n.delete(lotId); else n.add(lotId);
    return n;
  });

  return (
    <div className="space-y-3">
      {onlyLotId && <p className="text-xs text-muted-foreground">Filtered to one lot — switch the lot selector above to <b className="text-foreground">All lots</b> to see the rest.</p>}
      {lots.length > 1 && (
        <ExpandBar total={lots.length} openCount={lots.filter((l) => openLots.has(l.id)).length} noun="lot"
          onCollapseAll={() => setOpenLots(new Set())}
          onExpandAll={() => setOpenLots(new Set(lots.map((l) => l.id)))} />
      )}
      {lots.map((lot) => (
        <LotCard key={lot.id} b={b} id={id} lot={lot} canEdit={canEdit} canEmail={canEmail}
          open={isOpen(lot.id)} onToggle={() => toggle(lot.id)}
          onCompose={onCompose} onNotify={onNotify} onDispatch={onDispatch} />
      ))}
    </div>
  );
}

/** Same actions as the per-lot menu, applied once to every ticked lot. */
function BulkActionsMenu({
  b, id, selected, canEmail, onBulk,
}: { b: OrderBundle; id: string; selected: string[]; canEmail: boolean; onBulk: (party: NotifyParty) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const lots = b.lots.filter((l) => selected.includes(l.id));
  const withReport = lots.filter((l) => (l.reports ?? []).length > 0).length;
  const clientPos = new Set(lots.map((l) => l.clientPoNo ?? "—"));
  const none = lots.length === 0;

  const item = (label: string, sub: string, icon: React.ReactNode, onClick: () => void, disabled?: boolean) => (
    <button type="button" disabled={disabled} onClick={() => { setOpen(false); onClick(); }}
      className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0"><span className="font-medium">{label}</span><span className="block text-[11px] text-muted-foreground">{sub}</span></span>
    </button>
  );

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} disabled={none}
        title={none ? "Tick one or more lots first" : `Act on ${lots.length} selected lot(s)`}>
        <Layers className="h-4 w-4" /> Next actions ({lots.length}) <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-[22rem] rounded-lg border bg-card p-1 shadow-xl">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              {lots.length} lot(s) · {withReport} with a report
              {withReport < lots.length && <span className="text-warn"> · {lots.length - withReport} listed as pending</span>}
            </div>
            {item("Notify supplier", `One digest covering ${lots.length} lot(s); buyer stays masked`, <Factory className="h-4 w-4" />,
              () => onBulk("SUPPLIER"), !canEmail)}
            {item("Notify buyer / client", clientPos.size > 1
              ? `Split into ${clientPos.size} mails — one per client PO`
              : `One digest covering ${lots.length} lot(s); supplier stays masked`, <Users className="h-4 w-4" />,
              () => onBulk("BUYER"), !canEmail)}
            {item("Notify escrow provider", b.escrow ? `Release-trigger evidence for ${lots.length} lot(s)` : "No escrow on this order", <Landmark className="h-4 w-4" />,
              () => onBulk("ESCROW"), !canEmail || !b.escrow)}
            {item("Acknowledge to WHL", `Confirm ${withReport} report(s) received`, <FlaskConical className="h-4 w-4" />,
              () => onBulk("WHL"), !canEmail || withReport === 0)}
            <div className="my-1 border-t" />
            {item("Arrange logistics for these lots", "Opens Logistics with one shipment covering the selection", <Truck className="h-4 w-4" />,
              () => router.push(`/fulfilment/logistics?order=${id}&lots=${selected.join(",")}`))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Report is in — what next?" One menu with the follow-through actions: tell the
 * supplier, tell the buyer, evidence the escrow, acknowledge the lab, or move the
 * goods (which hands off to Logistics pre-filled for this lot).
 */
function NextActionsMenu({
  b, id, lot, canEmail, onNotify,
}: { b: OrderBundle; id: string; lot: Lot; canEmail: boolean; onNotify: (lotId: string, party: NotifyParty) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const report = currentReport(lot);
  const sentTo = (p: NotifyParty) => (lot.notifications ?? []).find((n) => n.party === p && n.status === "SENT");
  const ready = !!report;

  const item = (label: string, sub: string, icon: React.ReactNode, onClick: () => void, o: { disabled?: boolean; done?: string } = {}) => (
    <button type="button" disabled={o.disabled} onClick={() => { setOpen(false); onClick(); }}
      className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium">{label}{o.done && <Check className="h-3 w-3 text-ok" />}</span>
        <span className="block text-[11px] text-muted-foreground">{o.done ? `already sent ${o.done}` : sub}</span>
      </span>
    </button>
  );

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} disabled={!ready}
        title={ready ? "Follow-through actions for this result" : "Available once a test report is received"}>
        <Zap className="h-4 w-4" /> Next actions <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-80 rounded-lg border bg-card p-1 shadow-xl">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              {lot.lotCode} · {report?.reportNo} · {report?.conclusion.replace(/_/g, " ").toLowerCase()}
            </div>
            {item("Notify supplier", "Result + report; buyer stays masked", <Factory className="h-4 w-4" />,
              () => onNotify(lot.id, "SUPPLIER"), { disabled: !canEmail, done: sentTo("SUPPLIER")?.at })}
            {item("Notify buyer / client", "Result + report; supplier stays masked", <Users className="h-4 w-4" />,
              () => onNotify(lot.id, "BUYER"), { disabled: !canEmail, done: sentTo("BUYER")?.at })}
            {item("Notify escrow provider", b.escrow ? `Release-trigger evidence to HKIN (${b.escrow.externalRef})` : "No escrow on this order", <Landmark className="h-4 w-4" />,
              () => onNotify(lot.id, "ESCROW"), { disabled: !canEmail || !b.escrow, done: sentTo("ESCROW")?.at })}
            {item("Acknowledge to WHL", "Confirm the report is received and logged", <FlaskConical className="h-4 w-4" />,
              () => onNotify(lot.id, "WHL"), { disabled: !canEmail, done: sentTo("WHL")?.at })}
            <div className="my-1 border-t" />
            {item("Arrange logistics for this lot", "Opens Logistics with a shipment pre-filled for this lot", <Truck className="h-4 w-4" />,
              () => router.push(`/fulfilment/logistics?order=${id}&lot=${lot.id}`))}
          </div>
        </>
      )}
    </div>
  );
}

function LotCard({
  b, id, lot, canEdit, canEmail, open, onToggle, onCompose, onNotify, onDispatch,
}: { b: OrderBundle; id: string; lot: Lot; canEdit: boolean; canEmail: boolean; open: boolean; onToggle: () => void; onCompose: (lotId: string, templateId?: string) => void; onNotify: (lotId: string, party: NotifyParty) => void; onDispatch: (lotId: string) => void }) {
  const setLotStatus = useStore((s) => s.setLotStatus);
  const fetchWhlReport = useStore((s) => s.fetchWhlReport);
  const requestWhlUpdate = useStore((s) => s.requestWhlUpdate);
  const [showSent, setShowSent] = useState(false); // notification trail is collapsed by default
  const p = lotTestProgress(lot);
  const report = currentReport(lot);
  const emails = lotEmails(b, lot.id);
  const awaiting = emails.some((m) => m.direction === "OUT" && m.status === "AWAITING_RESPONSE");

  const stg = lotStageProgress(lot);
  const blocker = p.failed > 0 ? "not acceptable" : p.far > 0 ? "F.A.R." : p.notConducted > 0 ? "not conducted" : null;

  return (
    <CollapsibleCard
      open={open}
      onToggle={onToggle}
      title={<span className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <span className="text-foreground">{lot.lotCode}</span>
        <span className="font-mono text-xs normal-case text-muted-foreground">{lot.orderLineMpn}</span>
        <span className="font-normal normal-case tracking-normal text-faint">
          {lot.lab ?? "—"} · WO {lot.workOrderNo ?? "—"} · qty {qtyfmt(lot.qty)} / sample {lot.sampleQty} · DC {lot.dateCode}
        </span>
      </span>}
      // enough while collapsed to spot the lot that needs attention among a hundred
      summary={<>
        <StatusPill status={lot.testStatus} />
        <span className="text-muted-foreground tnum">{p.settled}/{p.total} tests</span>
        <span className={cn("tnum", stg.complete ? "text-ok" : "text-faint")} title={stg.stage ? stageLabel(stg.stage) : "Not started"}>
          {stg.stage ? stageLabel(stg.stage) : "not started"} {Math.max(0, stg.done)}/{stg.total}
        </span>
        {report ? <span className="font-mono text-faint">{report.reportNo}</span> : <span className="text-warn">no report</span>}
        {blocker && <Pill tone={p.failed > 0 ? "bad" : "warn"}>{blocker}</Pill>}
        {awaiting && <span title="Awaiting a WHL reply"><Clock className="h-3.5 w-3.5 text-warn" /></span>}
      </>}
      actions={<div className="flex flex-wrap items-center gap-2">
        <NextActionsMenu b={b} id={id} lot={lot} canEmail={canEmail} onNotify={onNotify} />
        <Button variant="outline" onClick={() => fetchWhlReport(id, lot.id)} title="Fetch & parse the WHL report for this work order">
          <FileText className="h-4 w-4" /> {report ? "Fetch revision" : "Fetch report"}
        </Button>
        <Button variant="outline" disabled={!canEmail} onClick={() => onCompose(lot.id)} title={canEmail ? "Email WHL about this lot" : "Only SC / Mgmt may email WHL"}>
          <Mail className="h-4 w-4" /> Email WHL
        </Button>
      </div>}>

      {/* ---- lifecycle chain: where the lot physically is, before what was tested ---- */}
      <div className="mb-4">
        <TestingStageChain orderId={id} lot={lot} canEdit={canEdit} onRecordDispatch={() => onDispatch(lot.id)} />
      </div>

      {/* ---- 3 · per-test status tracker ---- */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Test status tracker</span>
        <span>{p.settled}/{p.total} passed</span>
        {p.far > 0 && <span className="text-warn">{p.far} F.A.R.</span>}
        {p.failed > 0 && <span className="text-bad">{p.failed} not acceptable</span>}
        {p.notConducted > 0 && <span>{p.notConducted} not conducted</span>}
        {p.open > 0 && <span>{p.open} open</span>}
      </div>
      {p.total === 0 ? (
        <Empty text="No tests on this lot — the MPN's test list is empty or failed to auto-fill (see MPNs & tests)." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-card-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Test</th>
                <th className="px-3 py-2 text-left">Std</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Accept / Reject</th>
                <th className="px-3 py-2 text-left">Updated</th>
                <th className="px-3 py-2 text-right">Set</th>
              </tr>
            </thead>
            <tbody>
              {(lot.tests ?? []).map((t) => <TestRow key={t.id} orderId={id} lotId={lot.id} t={t} canEdit={canEdit} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- 4 + 5 · report repository & auto-parsed summary ---- */}
      <div className="mt-4">
        <ReportRepository b={b} orderId={id} lot={lot} canEmail={canEmail} />
      </div>

      {/* ---- who has been told, and what went with it ---- */}
      {report && (
        <div className="mt-3 rounded-lg border bg-card-2 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Result circulated</span>
            <span className="text-[11px] text-faint">use <b className="text-foreground">Next actions</b> above to send</span>
          </div>
          {/* the pills are the summary; the message-by-message trail is behind the toggle below */}
          <div className="flex flex-wrap gap-1.5">
            {(["SUPPLIER", "BUYER", "ESCROW", "WHL"] as NotifyParty[]).map((p) => {
              const n = (lot.notifications ?? []).find((x) => x.party === p);
              const label = p === "SUPPLIER" ? "Supplier" : p === "BUYER" ? "Buyer" : p === "ESCROW" ? "Escrow" : "WHL";
              return (
                <Pill key={p} tone={!n ? "neutral" : n.status === "FAILED" ? "bad" : "ok"}>
                  {n && n.status === "SENT" && <Check className="h-3 w-3" />}
                  {label}{n ? ` · ${n.at}${n.attachments?.length ? " · report attached" : ""}` : " · not notified"}
                </Pill>
              );
            })}
          </div>
          {(lot.notifications ?? []).length > 0 && (
            <div className="mt-2">
              <button onClick={() => setShowSent((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
                aria-expanded={showSent}>
                {showSent ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {showSent ? "Hide" : "Show"} history ({(lot.notifications ?? []).length})
              </button>
              {showSent && (
                <ol className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {(lot.notifications ?? []).map((n) => (
                    <li key={n.id}>
                      <span className="tnum text-faint">{n.at}</span> · {n.party.toLowerCase()} → <span className="font-mono">{n.to}</span> · {n.subject}
                      {n.attachments?.length ? ` · ${n.attachments.join(", ")}` : ""}
                      {n.status === "FAILED" && <span className="text-bad"> · {n.note}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- lot-level verdict override (unchanged lot logic) + thread peek ---- */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="uppercase tracking-wide text-faint">Lot verdict</span>
          {(["PASS", "MAYBE", "FAIL"] as const).map((st) => (
            <button key={st} onClick={() => setLotStatus(id, lot.id, st)}
              className={cn("rounded-md border px-2 py-1 font-medium hover:border-primary", lot.testStatus === st && "border-primary bg-accent-soft text-primary")}>{st}</button>
          ))}
          <span className="ml-1 text-faint">drives the escrow release / refund path</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {awaiting && <span className="inline-flex items-center gap-1 text-warn"><Clock className="h-3.5 w-3.5" /> awaiting WHL reply</span>}
          <span className="text-muted-foreground">{emails.length} message(s)</span>
          {/* one-click templated mails, picked by what this lot actually needs */}
          {!report && (
            <Button variant="outline" disabled={!canEmail} onClick={() => requestWhlUpdate(id, lot.id)}>
              <Mail className="h-4 w-4" /> Request update
            </Button>
          )}
          {report?.anyFar && (
            <Button variant="outline" disabled={!canEmail} onClick={() => onCompose(lot.id, "FAR_FOLLOWUP")}>
              <Mail className="h-4 w-4" /> F.A.R. follow-up
            </Button>
          )}
          {lot.testStatus === "FAIL" && (
            <Button variant="outline" disabled={!canEmail} onClick={() => onCompose(lot.id, "RETEST_REQUEST")}>
              <Mail className="h-4 w-4" /> Re-test request
            </Button>
          )}
          {awaiting && (
            <Button variant="ghost" disabled={!canEmail} onClick={() => onCompose(lot.id, "TAT_ESCALATION")}>
              <Mail className="h-4 w-4" /> Escalate TAT
            </Button>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}

function TestRow({ orderId, lotId, t, canEdit }: { orderId: string; lotId: string; t: LotTest; canEdit: boolean }) {
  const setLotTestStatus = useStore((s) => s.setLotTestStatus);
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-3 py-2">
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-start gap-1 text-left hover:text-primary">
            {open ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            {t.name}
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{t.standard ?? "—"}</td>
        <td className="px-3 py-2"><Pill tone={t.source === "AUTO_PO" ? "info" : "warn"}>{t.source === "AUTO_PO" ? "from PO" : "manual"}</Pill></td>
        <td className="px-3 py-2"><StatusPill status={t.status} /></td>
        <td className="px-3 py-2 text-right tnum text-xs">
          {t.acceptQty === undefined && t.rejectQty === undefined ? "—" : `${t.acceptQty ?? 0} / ${t.rejectQty ?? 0}`}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{t.updatedAt ?? "—"}</td>
        <td className="px-3 py-2 text-right">
          <Select className="w-36 py-1 text-xs" value={t.status} disabled={!canEdit}
            onChange={(e) => setLotTestStatus(orderId, lotId, t.id, e.target.value as TestProcessStatus, "Set manually on the tracker.")}>
            {TEST_PROCESS_STATUSES.map((s) => <option key={s} value={s}>{s === "FAR" ? "F.A.R." : s.replace(/_/g, " ")}</option>)}
          </Select>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-card-2 last:border-0">
          <td colSpan={7} className="px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status history</div>
            {t.history.length === 0 ? <p className="text-xs text-muted-foreground">No history yet.</p> : (
              <ol className="space-y-1.5">
                {t.history.slice().reverse().map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="tnum text-faint">{h.at}</span>
                    {h.before && <><StatusPill status={h.before} /><span className="text-faint">→</span></>}
                    <StatusPill status={h.after} />
                    <span className="text-muted-foreground">{h.by}{h.note ? ` · ${h.note}` : ""}{h.sourceEmailId ? " · from inbound email" : ""}</span>
                  </li>
                ))}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ---- report repository (per lot) + on-screen parsed summary ----

function ReportRepository({ b, orderId, lot, canEmail }: { b: OrderBundle; orderId: string; lot: Lot; canEmail: boolean }) {
  const requestWhlUpdate = useStore((s) => s.requestWhlUpdate);
  const logReportAccess = useStore((s) => s.logReportAccess);
  const reports = (lot.reports ?? []).slice().sort((a, c) => c.revision - a.revision);
  const [shown, setShown] = useState<string | null>(null);
  const current = currentReport(lot);
  const active = reports.find((r) => r.id === (shown ?? current?.id));

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">WHL report — <span className="text-warn">Not Available</span></div>
            <p className="text-xs text-muted-foreground">
              Nothing received by email for WO {lot.workOrderNo ?? "—"} yet.
              {lot.lastUpdateRequestAt && <> Update requested {lot.lastUpdateRequestAt}.</>}
            </p>
          </div>
          <Button variant="outline" disabled={!canEmail} onClick={() => requestWhlUpdate(orderId, lot.id)}
            title={canEmail ? `Pre-mapped chase to ${WHL_CONTACT}` : "Only SC / Mgmt may email WHL"}>
            <Mail className="h-4 w-4" /> Request Update
          </Button>
        </div>
        {!canEmail && <p className="mt-2"><Denied what="Emailing WHL" /></p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card-2 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">WHL report repository · {reports.length} version(s)</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {reports.map((r) => (
            <button key={r.id} onClick={() => { setShown(r.id); logReportAccess(orderId, lot.id, r.id, "VIEW"); }}
              className={cn("rounded-md border px-2 py-0.5 text-xs font-medium",
                active?.id === r.id ? "border-primary bg-accent-soft text-primary" : "hover:border-primary")}>
              {r.reportNo}{r.current && <Check className="ml-1 inline h-3 w-3 text-ok" />}
            </button>
          ))}
        </div>
      </div>
      {active && <ReportSummary b={b} orderId={orderId} lot={lot} r={active} />}
    </div>
  );
}

const CONCLUSION_TONE = (c: WhlReport["conclusion"]): "ok" | "bad" => (c === "ACCEPTABLE" ? "ok" : "bad");

/** Everything the operator needs without opening the PDF. */
function ReportSummary({ b, orderId, lot, r }: { b: OrderBundle; orderId: string; lot: Lot; r: WhlReport }) {
  const logReportAccess = useStore((s) => s.logReportAccess);
  const reconcileReportPo = useStore((s) => s.reconcileReportPo);
  const [showAccess, setShowAccess] = useState(false);
  const poOnFile = lot.clientPoNo ?? b.sourcingAllocations.find((a) => a.orderLineMpn === lot.orderLineMpn)?.clientPoNo;

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{r.reportNo}</span>
          {!r.current && <Pill tone="neutral">superseded</Pill>}
          {r.current && <Pill tone="info">current</Pill>}
          <Pill tone={CONCLUSION_TONE(r.conclusion)}>{r.conclusion.replace(/_/g, " ")}</Pill>
          {r.anyFar && <Pill tone="warn">F.A.R. on a process — follow up</Pill>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowAccess((s) => !s)} title="Access log (NDA)"><ShieldAlert className="h-4 w-4" /> {r.accessLog.length}</Button>
          <Button variant="outline" onClick={() => logReportAccess(orderId, lot.id, r.id, "VIEW")}><Eye className="h-4 w-4" /> Open PDF</Button>
          <Button variant="outline" onClick={() => logReportAccess(orderId, lot.id, r.id, "DOWNLOAD")}><Download className="h-4 w-4" /> Download</Button>
        </div>
      </div>

      {r.revisionNote && <p className="mb-3 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">{r.revisionNote}</p>}

      {r.parseFlags.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {r.parseFlags.map((f, i) => (
            <Notice key={i} tone="warn" icon={<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              action={f.toLowerCase().includes("client p/o") && poOnFile
                ? <button className="font-medium underline" onClick={() => reconcileReportPo(orderId, lot.id, r.id)}>Set to {poOnFile}</button>
                : undefined}>
              {f}
            </Notice>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <Field label="Report no · date">{r.reportNo} · {r.reportDate}</Field>
        <Field label="Work order">{r.workOrderNo}</Field>
        <Field label="Part number (MPN)">
          <span className={cn("font-mono", r.partNumber !== lot.orderLineMpn && "text-bad")}>{r.partNumber}</span>
        </Field>
        <Field label="Manufacturer">{r.manufacturer}</Field>
        <Field label="Lot qty">{qtyfmt(r.lotQty)}{r.lotQty !== lot.qty && <span className="ml-1 text-xs text-warn">(lot on file {qtyfmt(lot.qty)})</span>}</Field>
        <Field label="Client">{r.client}</Field>
        <Field label="Client P/O">
          <span className={cn(r.clientPo === "PO Unknown" && "text-warn")}>{r.clientPo}</span>
        </Field>
        <Field label="Approved by">{r.approvedBy} · {r.approverTitle}</Field>
        <Field label="Standards">{r.standards.join(", ")}</Field>
        <Field label="Risk classification">{r.riskClass ?? "—"}</Field>
        <Field label="MSL">{r.msl ?? "—"}</Field>
        <Field label="Package type">{r.packageType ?? "—"}</Field>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Process-level results</div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-card-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Process</th>
                <th className="px-3 py-2 text-left">Result</th>
                <th className="px-3 py-2 text-right">Acceptable qty</th>
                <th className="px-3 py-2 text-right">Not-acceptable qty</th>
                <th className="px-3 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {r.processes.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2"><Pill tone={statusTone(p.result)}>{p.result === "FAR" ? "F.A.R." : p.result.replace(/_/g, " ")}</Pill></td>
                  <td className="px-3 py-2 text-right tnum">{p.acceptQty ?? "—"}</td>
                  <td className="px-3 py-2 text-right tnum">{p.rejectQty ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          A report can be <b>Acceptable</b> overall while one process is <b>F.A.R.</b> — the matrix is the source of truth, not the headline conclusion.
        </p>
      </div>

      {showAccess && (
        <div className="mt-3 rounded-lg border bg-card-2 p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Access log</div>
          {r.accessLog.length === 0 ? <p className="text-xs text-muted-foreground">No views recorded.</p> : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {r.accessLog.map((a, i) => <li key={i}><span className="tnum text-faint">{a.at}</span> · {a.by} · {a.action.toLowerCase()}</li>)}
            </ul>
          )}
        </div>
      )}
      {r.confidentialityNote && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" /> {r.confidentialityNote}
        </p>
      )}
    </div>
  );
}

// ==================== 6 + 7 · inbox / compose / correspondence ====================

function MailSection({
  b, id, defaultLotId, canEmail, onCompose, onMatch,
}: { b: OrderBundle; id: string; defaultLotId?: string; canEmail: boolean; onCompose: (lotId?: string, templateId?: string) => void; onMatch: (m: LabEmail) => void }) {
  const syncWhlInbox = useStore((s) => s.syncWhlInbox);
  const escalateLabEmail = useStore((s) => s.escalateLabEmail);
  const unmatched = unmatchedEmails(b);
  // inherits the header's lot scope (remounted on change), still overridable here
  const [lotFilter, setLotFilter] = useState<string>(defaultLotId ?? "ALL");
  const thread = (b.labEmails ?? []).filter((m) => !!m.lotId && (lotFilter === "ALL" || m.lotId === lotFilter));

  // A long-running lot accumulates dozens of mails. Show the two most recent (the thread
  // is newest-first) and keep the rest one click away, with each body clamped until asked for.
  const RECENT_MAILS = 2;
  const [showAllMail, setShowAllMail] = useState(false);
  const [openMails, setOpenMails] = useState<Set<string>>(new Set());
  const visible = showAllMail ? thread : thread.slice(0, RECENT_MAILS);
  const hidden = Math.max(0, thread.length - RECENT_MAILS);
  const toggleMail = (mid: string) => setOpenMails((p) => {
    const n = new Set(p);
    if (n.has(mid)) n.delete(mid); else n.add(mid);
    return n;
  });

  return (
    <div className="space-y-4">
      <Panel title="Compose from a template — subject & body pre-filled">
        <div className="flex flex-wrap gap-1.5">
          {WHL_EMAIL_TEMPLATES.map((t) => (
            <button key={t.id} type="button" disabled={!canEmail} onClick={() => onCompose(b.lots[0]?.id, t.id)}
              title={t.hint}
              className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50">
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Each template fills the subject and the whole message from the lot&apos;s MPN, lot code, work order, report no and client PO — edit the wording and send.
          {!canEmail && <> <Denied what="Emailing WHL" /></>}
        </p>
      </Panel>

      <Panel title="WHL inbox — manual match queue"
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={() => syncWhlInbox(id)}><RefreshCw className="h-4 w-4" /> Sync inbox</Button>
          <Button disabled={!canEmail} onClick={() => onCompose(undefined)} title={canEmail ? "Compose to WHL" : "Only SC / Mgmt may email WHL"}>
            <Mail className="h-4 w-4" /> Compose
          </Button>
        </div>}>
        {unmatched.length === 0 ? <Empty text="Nothing waiting — every inbound WHL email is matched to a lot." /> : (
          <div className="space-y-2">
            {unmatched.map((m) => (
              <div key={m.id} className="rounded-lg border border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-warn-bg/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.subject}</div>
                    <div className="text-xs text-muted-foreground">{m.by} · {m.at}{m.attachments?.length ? ` · ${m.attachments.join(", ")}` : ""}</div>
                  </div>
                  <Button variant="outline" onClick={() => onMatch(m)}><MailQuestion className="h-4 w-4" /> Match to lot</Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{m.body}</p>
                {m.matchNote && <p className="mt-1 text-[11px] text-warn">{m.matchNote}</p>}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Unroutable mail is held here rather than dropped or applied to the wrong lot. Matching it applies its updates to that lot&apos;s tracker.
        </p>
      </Panel>

      <Panel title="Correspondence & tracking history"
        actions={
          <Select className="w-52 py-1 text-xs" value={lotFilter} onChange={(e) => setLotFilter(e.target.value)}>
            <option value="ALL">All lots</option>
            {b.lots.map((l) => <option key={l.id} value={l.id}>{l.lotCode} · {l.orderLineMpn}</option>)}
          </Select>
        }>
        {thread.length === 0 ? <Empty text="No correspondence with WHL yet." /> : (
          <>
            <ol className="space-y-3">
              {visible.map((m) => (
                <MailRow key={m.id} m={m} orderId={id} onEscalate={escalateLabEmail}
                  expanded={openMails.has(m.id)} onToggle={() => toggleMail(m.id)} />
              ))}
            </ol>
            {hidden > 0 && (
              <button onClick={() => setShowAllMail((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                {showAllMail ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {showAllMail ? `Hide the earlier ${hidden} message(s)` : `Show ${hidden} earlier message(s)`}
              </button>
            )}
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Every message to and from <b className="text-foreground">{WHL_CONTACT}</b> is logged against its lot — status requests, interim updates and report deliveries in one thread.
          {thread.length > RECENT_MAILS && ` Showing the ${RECENT_MAILS} most recent of ${thread.length}.`}
        </p>
      </Panel>
    </div>
  );
}

/**
 * One message in the WHL thread. The body is clamped to a couple of lines so a long
 * report mail can't push the rest of the thread off screen — "view full email" opens it
 * in place. Short mails are shown whole and get no toggle.
 */
function MailRow({
  m, orderId, expanded, onToggle, onEscalate,
}: { m: LabEmail; orderId: string; expanded: boolean; onToggle: () => void; onEscalate: (orderId: string, emailId: string) => void }) {
  const long = m.body.length > 160 || m.body.includes("\n");
  return (
    <li className="flex gap-3">
      <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.direction === "OUT" ? "bg-primary" : "bg-ok")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={m.direction === "OUT" ? "info" : "neutral"}>{m.direction === "OUT" ? "sent" : "received"}</Pill>
          <StatusPill status={m.status} />
          <span className="text-xs text-faint tnum">{m.at}</span>
          {m.lotCode && <span className="text-xs text-muted-foreground">{m.lotCode} · <span className="font-mono">{m.mpn}</span>{m.workOrderNo ? ` · WO ${m.workOrderNo}` : ""}</span>}
        </div>
        <button onClick={onToggle} className="block w-full text-left text-sm font-medium hover:text-primary" title={expanded ? "Collapse" : "View full email"}>
          {m.subject}
        </button>
        <p className={cn("whitespace-pre-wrap text-xs text-muted-foreground", !expanded && long && "line-clamp-2")}>{m.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-faint">
          {long && (
            <button onClick={onToggle} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "collapse" : "view full email"}
            </button>
          )}
          <span>{m.by}</span>
          {m.attachments?.length ? <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {m.attachments.join(", ")}</span> : null}
          {m.matchedBy && <span>matched by {m.matchedBy}</span>}
          {m.direction === "OUT" && m.status === "AWAITING_RESPONSE" && (
            <button className="underline" onClick={() => onEscalate(orderId, m.id)}>Mark escalated</button>
          )}
        </div>
      </div>
    </li>
  );
}
