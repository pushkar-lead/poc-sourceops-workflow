"use client";

import {
  ClipboardList, Truck, PackageCheck, FlaskConical, Activity, BadgeCheck, FileClock, FileText,
  Check, CircleDot, RefreshCw, Hourglass, Receipt, Mail, Download, Landmark,
} from "lucide-react";
import type { Lot, TestingStage } from "@/types";
import {
  TESTING_STAGES, TESTING_STAGE_META, STAGE_OWNER_LABEL, stageIdx,
  LAB_PAYMENT_LABEL, LAB_PAYMENT_TONE,
} from "@/data/enums";
import { lotStageProgress, labPaymentOf, labFeeUnpaid } from "@/store/selectors";
import { Button, Pill } from "@/components/ui/primitives";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

// The lifecycle chain for one lot. The per-test tracker answers "what was tested";
// this answers "where is the lot right now, and who are we waiting on" — the question
// that actually gets asked while a lot is sitting at the lab.

const STAGE_ICON: Record<TestingStage, React.ComponentType<{ className?: string }>> = {
  TEST_REQUESTED: ClipboardList,
  WHL_PAYMENT: Receipt,
  SUPPLIER_DISPATCHING: Truck,
  COMPONENTS_RECEIVED: PackageCheck,
  TESTING_STARTED: FlaskConical,
  TESTING_IN_PROGRESS: Activity,
  TESTING_COMPLETED: BadgeCheck,
  REPORT_PREPARATION: FileClock,
  REPORT_SHARED: FileText,
};

/** Compact one-line indicator — used on lot lists and the cross-order testing board. */
export function TestingStageBar({ lot, className }: { lot: Lot; className?: string }) {
  const { stage, idx, total, done, complete, waitingOn } = lotStageProgress(lot);
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1" title={stage ? TESTING_STAGE_META[stage].description : "Testing not requested yet"}>
        {TESTING_STAGES.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < idx ? "bg-ok" : i === idx ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{stage ? TESTING_STAGE_META[stage].label : "Not started"}</span>
        <span className="text-faint tnum">{Math.max(0, done)}/{total}</span>
        {waitingOn && !complete && <span className="text-faint">waiting on {STAGE_OWNER_LABEL[waitingOn]}</span>}
      </div>
    </div>
  );
}

/**
 * Horizontal stepper, deliberately the same shape as the order's Journey stepper so the
 * two read as one idea at different scales. Stages before the current one show as done
 * even without a history row — a lot can arrive mid-chain (report fetched before anyone
 * recorded the dispatch), and pretending those steps never happened would mislead more
 * than showing them done without a timestamp.
 */
export function TestingStageChain({
  orderId, lot, canEdit, onRecordDispatch, onSendToFinance, onMarkPaid,
}: {
  orderId: string; lot: Lot; canEdit: boolean;
  onRecordDispatch: () => void;
  onSendToFinance: () => void;
  onMarkPaid: () => void;
}) {
  const syncWhlInbox = useStore((s) => s.syncWhlInbox);
  const setLotStage = useStore((s) => s.setLotStage);
  const { stage, idx, total, done, complete, waitingOn, eventFor } = lotStageProgress(lot);

  const needsDispatch = idx < stageIdx("SUPPLIER_DISPATCHING");
  const currentEvent = stage ? eventFor(stage) : undefined;
  const nextStage = idx + 1 < total ? TESTING_STAGES[idx + 1] : null;

  return (
    <div className="rounded-[var(--radius)] border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          Testing lifecycle <span className="text-faint">· {Math.max(0, done)}/{total} stages</span>
        </div>
        {complete ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok">
            <Check className="h-3.5 w-3.5" /> Report received
          </span>
        ) : stage ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-primary">
            <CircleDot className="h-3.5 w-3.5" /> At: {TESTING_STAGE_META[stage].label}
            {waitingOn && <span className="font-normal text-muted-foreground">· waiting on {STAGE_OWNER_LABEL[waitingOn]}</span>}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Hourglass className="h-3.5 w-3.5" /> Not requested yet
          </span>
        )}
      </div>

      <ol className="flex items-start gap-0 overflow-x-auto pb-1">
        {TESTING_STAGES.map((s, i) => {
          const meta = TESTING_STAGE_META[s];
          const Icon = STAGE_ICON[s];
          // The lab works on account, so testing can run past the payment stage with the
          // fee still owed. Index alone would then paint this node "done" — a lie. Read
          // the payment record instead: it's the one node whose truth isn't positional.
          const unpaid = s === "WHL_PAYMENT" && labFeeUnpaid(lot);
          const isDone = !unpaid && (i < idx || (complete && i === idx));
          const isCurrent = !unpaid && i === idx && !complete;
          const ev = eventFor(s);
          const node = unpaid ? "border-warn bg-warn-bg text-warn"
            : isDone ? "border-primary bg-primary text-primary-foreground"
            : isCurrent ? "border-primary text-primary ring-2 ring-accent-soft"
            : "border-border text-faint";
          // the tooltip carries what the vertical list used to spell out
          const tip = [
            meta.description,
            unpaid ? `⚠ ${LAB_PAYMENT_LABEL[labPaymentOf(lot).status]} — the lab is testing on account; settle the fee.` : undefined,
            ev ? `${ev.at} · ${ev.by}${ev.note ? ` — ${ev.note}` : ""}` : !isDone && !isCurrent && !unpaid ? `↳ ${meta.trigger}` : undefined,
          ].filter(Boolean).join("\n");

          return (
            <li key={s} className="flex min-w-[92px] flex-1 flex-col items-center" title={tip}>
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= idx ? "bg-primary" : "bg-border")} />
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold", node)}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : (isCurrent || unpaid) ? <Icon className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("h-0.5 flex-1", i === total - 1 ? "opacity-0" : i < idx ? "bg-primary" : "bg-border")} />
              </div>
              <span className={cn("mt-1 px-1 text-center text-[10px] leading-tight", isCurrent ? "font-medium text-foreground" : "text-muted-foreground")}>
                {meta.owner !== "1BUY" && (
                  meta.owner === "SUPPLIER"
                    ? <Truck className="mr-0.5 inline h-2.5 w-2.5 text-warn" />
                    : <FlaskConical className="mr-0.5 inline h-2.5 w-2.5 text-faint" />
                )}
                {meta.label}
              </span>
              {ev && <span className="mt-0.5 text-[9px] tnum text-faint">{ev.at.slice(5, 10)}</span>}
            </li>
          );
        })}
      </ol>

      {/* the current step in words, then what moves it on */}
      <div className="mt-3 border-t pt-3 text-xs">
        {stage && (
          <p className="text-muted-foreground">
            <b className="text-foreground">{TESTING_STAGE_META[stage].label}</b> — {TESTING_STAGE_META[stage].description}
            {currentEvent && <span className="text-faint"> · {currentEvent.at} · {currentEvent.by}{currentEvent.manual ? " (recorded manually)" : ""}</span>}
          </p>
        )}
        {currentEvent?.note && <p className="mt-0.5 text-faint">{currentEvent.note}</p>}
        {!complete && nextStage && (
          <p className="mt-1 text-faint">
            Next: <b className="text-muted-foreground">{TESTING_STAGE_META[nextStage].label}</b> — {TESTING_STAGE_META[nextStage].trigger}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {needsDispatch && (
            <Button variant="outline" onClick={onRecordDispatch} disabled={!canEdit}
              title={canEdit ? "Record the supplier's dispatch of the samples to WHL" : "Only SC / Mgmt may record dispatch"}>
              <Truck className="h-4 w-4" /> Record supplier dispatch
            </Button>
          )}
          {!complete && (
            <Button variant="outline" onClick={() => syncWhlInbox(orderId)}
              title="Poll the WHL mailbox — receipt confirmations, start notices, progress updates and the report all move this chain">
              <RefreshCw className="h-4 w-4" /> Check WHL for updates
            </Button>
          )}
          {!complete && nextStage && canEdit && (
            <button onClick={() => setLotStage(orderId, lot.id, nextStage)}
              className="text-[11px] text-muted-foreground underline hover:text-primary"
              title={`Record "${TESTING_STAGE_META[nextStage].label}" by hand (e.g. WHL confirmed by phone)`}>
              mark {TESTING_STAGE_META[nextStage].label.toLowerCase()} done
            </button>
          )}
        </div>
      </div>

      {/* the lab's own bill — a different document from the report, on its own track */}
      <LabFeePanel orderId={orderId} lot={lot} canEdit={canEdit}
        onSendToFinance={onSendToFinance} onMarkPaid={onMarkPaid} />

      {lot.dispatch && (
        <div className="mt-3 rounded-lg border bg-card-2 p-3 text-xs">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
              <Truck className="h-3.5 w-3.5" /> Supplier → {lot.lab ?? "WHL"}
            </span>
            <span className="text-faint">recorded by {lot.dispatch.recordedBy} · {lot.dispatch.recordedAt}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {lot.dispatch.courier && <span>{lot.dispatch.courier}</span>}
            {lot.dispatch.awb && <span>AWB <span className="font-mono text-foreground">{lot.dispatch.awb}</span></span>}
            {lot.dispatch.dispatchedOn && <span>dispatched {lot.dispatch.dispatchedOn}</span>}
            {lot.dispatch.expectedArrival && <span>ETA {lot.dispatch.expectedArrival}</span>}
          </div>
          {lot.dispatch.note && <p className="mt-1 text-faint">{lot.dispatch.note}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * WHL's invoice for the testing service and its settlement. Deliberately its own block:
 * the invoice is a different document from the test report, arrives on its own schedule
 * (the lab bills on booking, reports weeks later), and is paid by a different team.
 */
export function LabFeePanel({
  orderId, lot, canEdit, onSendToFinance, onMarkPaid,
}: {
  orderId: string; lot: Lot; canEdit: boolean;
  onSendToFinance: () => void;
  onMarkPaid: () => void;
}) {
  const requestWhlInvoice = useStore((s) => s.requestWhlInvoice);
  const logInvoiceAccess = useStore((s) => s.logInvoiceAccess);
  const pay = labPaymentOf(lot);
  const inv = pay.invoice;
  const unpaid = labFeeUnpaid(lot);
  const gross = inv ? inv.amount + (inv.taxAmount ?? 0) : 0;

  // nothing to bill before a work order exists
  if (!lot.workOrderNo) return null;

  return (
    <div className={cn("mt-3 rounded-lg border p-3 text-xs", unpaid ? "bg-warn-bg/30" : "bg-card-2")}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" /> WHL invoice &amp; payment
        </span>
        <Pill tone={LAB_PAYMENT_TONE[pay.status]}>{LAB_PAYMENT_LABEL[pay.status]}</Pill>
        {inv && <span className="font-mono text-foreground">{inv.invoiceNo}</span>}
        {inv && <span className="tnum text-muted-foreground">{inv.currency} {gross.toLocaleString()}</span>}
        {inv?.dueDate && unpaid && <span className="text-faint">due {inv.dueDate}</span>}
      </div>

      {!inv ? (
        <p className="text-muted-foreground">
          {pay.status === "REQUESTED"
            ? <>Invoice requested{pay.requestedAt ? <> <span className="tnum text-faint">{pay.requestedAt}</span></> : null} — it arrives on the WHL thread, so <b className="text-foreground">Check WHL for updates</b> pulls it in.</>
            : <>No invoice on file yet. The lab bills on booking, so it normally arrives with the first inbox sync.</>}
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>{inv.currency} {inv.amount.toLocaleString()} net{inv.taxAmount ? ` + tax ${inv.taxAmount.toLocaleString()}` : ""}</span>
          <span>received {inv.receivedAt}</span>
          {pay.sentToFinanceAt && <span>to finance {pay.sentToFinanceAt}{pay.sentToFinanceBy ? ` · ${pay.sentToFinanceBy}` : ""}</span>}
          {pay.paidAt && <span className="text-ok">paid {pay.paidAt}{pay.paidRef ? ` · ref ${pay.paidRef}` : ""}</span>}
          {inv.note && <span className="text-faint">{inv.note}</span>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!inv && (
          <Button variant="outline" disabled={!canEdit} onClick={() => requestWhlInvoice(orderId, lot.id)}
            title={canEdit ? "Email WHL for the testing invoice" : "Only SC / Mgmt may email WHL"}>
            <Mail className="h-4 w-4" /> Request invoice
          </Button>
        )}
        {inv && (
          <Button variant="outline" onClick={() => logInvoiceAccess(orderId, lot.id, "DOWNLOAD")}
            title={`Download ${inv.fileName} — access is logged`}>
            <Download className="h-4 w-4" /> Download invoice
          </Button>
        )}
        {inv && unpaid && (
          <Button variant="outline" disabled={!canEdit} onClick={onSendToFinance}
            title={canEdit ? "Email finance with the invoice attached to initiate payment" : "Only SC / Mgmt may send this"}>
            <Landmark className="h-4 w-4" /> {pay.status === "SENT_TO_FINANCE" ? "Re-send to finance" : "Send to finance"}
          </Button>
        )}
        {inv && unpaid && (
          <Button variant="ghost" disabled={!canEdit} onClick={onMarkPaid}
            title="Record the transfer finance released — this closes the Payment to WHL stage">
            <Check className="h-4 w-4" /> Mark paid
          </Button>
        )}
        {inv && (inv.accessLog ?? []).length > 0 && (
          <span className="text-faint" title={inv.accessLog.map((a) => `${a.at} · ${a.by} · ${a.action}`).join("\n")}>
            {inv.accessLog.length} access {inv.accessLog.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>
    </div>
  );
}
