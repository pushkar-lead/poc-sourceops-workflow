"use client";

import {
  ClipboardList, Truck, PackageCheck, FlaskConical, Activity, BadgeCheck, FileClock, FileText,
  Check, CircleDot, RefreshCw, Hourglass,
} from "lucide-react";
import type { Lot, TestingStage } from "@/types";
import { TESTING_STAGES, TESTING_STAGE_META, STAGE_OWNER_LABEL, stageIdx } from "@/data/enums";
import { lotStageProgress } from "@/store/selectors";
import { Button } from "@/components/ui/primitives";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

// The lifecycle chain for one lot. The per-test tracker answers "what was tested";
// this answers "where is the lot right now, and who are we waiting on" — the question
// that actually gets asked while a lot is sitting at the lab.

const STAGE_ICON: Record<TestingStage, React.ComponentType<{ className?: string }>> = {
  TEST_REQUESTED: ClipboardList,
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
  orderId, lot, canEdit, onRecordDispatch,
}: { orderId: string; lot: Lot; canEdit: boolean; onRecordDispatch: () => void }) {
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
          const isDone = i < idx || (complete && i === idx);
          const isCurrent = i === idx && !complete;
          const ev = eventFor(s);
          const node = isDone ? "border-primary bg-primary text-primary-foreground"
            : isCurrent ? "border-primary text-primary ring-2 ring-accent-soft"
            : "border-border text-faint";
          // the tooltip carries what the vertical list used to spell out
          const tip = [
            meta.description,
            ev ? `${ev.at} · ${ev.by}${ev.note ? ` — ${ev.note}` : ""}` : !isDone && !isCurrent ? `↳ ${meta.trigger}` : undefined,
          ].filter(Boolean).join("\n");

          return (
            <li key={s} className="flex min-w-[92px] flex-1 flex-col items-center" title={tip}>
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= idx ? "bg-primary" : "bg-border")} />
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold", node)}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : isCurrent ? <Icon className="h-3.5 w-3.5" /> : i + 1}
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
