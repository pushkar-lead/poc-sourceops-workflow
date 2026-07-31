import { mockCall, ref, pickWeighted } from "@/integrations/mock-client";
import { WHL_PROCESSES, WHL_CONTACT, WHL_CONFIDENTIALITY } from "@/data/enums";
import type { TestStatus, WhlConclusion, WhlProcessResult, TestProcessStatus } from "@/types";

const SYS = "whl";
const LABEL = "WHL Lab";

export interface WhlSubmitReq { clientRef: string; mpn: string; dateCode: string; lotCode: string; lotQty: number; sampleQty: number; testPlan: string; labSite: string; }
export interface WhlSubmitRes { workOrderNo: string; status: "RECEIVED"; labSite: string; estimatedTatDays: number; }
export type WhlVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";
export interface WhlReportRes { workOrderNo: string; status: "IN_PROGRESS" | "COMPLETED"; verdict: WhlVerdict | null; reportNo?: string; tatDays?: number; }

export const mapVerdict = (v: WhlVerdict): TestStatus => (v === "INCONCLUSIVE" ? "MAYBE" : v);

/** Report conclusion → the lot-level TestStatus the escrow/journey gates already run on. */
export const conclusionToLotStatus = (c: WhlConclusion, anyFar: boolean): TestStatus =>
  c === "ACCEPTABLE" ? (anyFar ? "MAYBE" : "PASS") : "FAIL";

/** Per-process report result → the per-test status shown in the tracker. */
export const processToTestStatus = (r: WhlProcessResult): TestProcessStatus =>
  r === "ACCEPTABLE" ? "PASSED" : r === "NOT_ACCEPTABLE" ? "FAILED" : r === "FAR" ? "FAR" : "NOT_CONDUCTED";

export function whlSubmitTestJob(req: WhlSubmitReq) {
  return mockCall<WhlSubmitRes>(SYS, LABEL, "POST /work-orders", req,
    () => ({ workOrderNo: ref("WO"), status: "RECEIVED", labSite: req.labSite, estimatedTatDays: 5 + Math.floor(Math.random() * 3) }),
    { latencyMs: [400, 1200], failError: { code: "LAB_QUEUE_FULL", message: "Lab intake queue full", status: 503 } });
}

// Weighted verdict (~70% PASS / 20% MAYBE / 10% FAIL) — the demo can also force via the console chaos toggle.
export function whlPollTestReport(workOrderNo: string) {
  return mockCall<WhlReportRes>(SYS, LABEL, `GET /work-orders/${workOrderNo}/report`, { workOrderNo },
    () => {
      const verdict = pickWeighted<WhlVerdict>([["PASS", 70], ["INCONCLUSIVE", 20], ["FAIL", 10]]);
      return { workOrderNo, status: "COMPLETED", verdict, reportNo: `${workOrderNo}.1`, tatDays: 5 + Math.floor(Math.random() * 3) };
    },
    { latencyMs: [400, 1400] });
}

// ---- report fetch + parse (stands in for "PDF arrived by email, OCR + extract") ----

export interface WhlParsedProcess { name: string; result: WhlProcessResult; acceptQty?: number; rejectQty?: number; note?: string }
export interface WhlParsedReport {
  reportNo: string; revision: number; reportDate: string; workOrderNo: string; fileName: string;
  partNumber: string; manufacturer: string; lotQty: number; client: string; clientPo: string;
  conclusion: WhlConclusion; anyFar: boolean; processes: WhlParsedProcess[];
  approvedBy: string; approverTitle: string; standards: string[]; riskClass: string; msl: string; packageType: string;
  confidentialityNote: string; revisionNote?: string; parseFlags: string[];
}

export interface WhlFetchReportReq {
  workOrderNo: string; mpn: string; manufacturer: string; lotQty: number;
  client: string; clientPo?: string; revision: number; testNames: string[];
}

/**
 * Fetch + parse the WHL report for a work order. The mock builds a realistic
 * process-level matrix (so a report can be ACCEPTABLE overall with one process
 * F.A.R.) and occasionally returns WHL's "PO Unknown" placeholder, which the
 * platform must flag for reconciliation rather than accept as-is.
 */
export function whlFetchReport(req: WhlFetchReportReq) {
  return mockCall<WhlParsedReport>(SYS, LABEL, `GET /work-orders/${req.workOrderNo}/report/pdf+parse`, req,
    () => {
      const names = req.testNames.length ? req.testNames : [...WHL_PROCESSES].slice(0, 5);
      const conclusion = pickWeighted<WhlConclusion>([["ACCEPTABLE", 72], ["NOT_ACCEPTABLE", 18], ["SUSPECT_COUNTERFEIT", 10]]);
      const sample = Math.max(1, Math.min(req.lotQty, 20));
      const processes: WhlParsedProcess[] = names.map((name, i) => {
        // one process is deliberately allowed to come back F.A.R. / not conducted even on an Acceptable report
        const result: WhlProcessResult = conclusion === "ACCEPTABLE"
          ? pickWeighted<WhlProcessResult>([["ACCEPTABLE", 80], ["FAR", 12], ["NOT_CONDUCTED", 8]])
          : i === 0
          ? "ACCEPTABLE"
          : pickWeighted<WhlProcessResult>([["NOT_ACCEPTABLE", 55], ["FAR", 25], ["ACCEPTABLE", 20]]);
        const rejectQty = result === "NOT_ACCEPTABLE" ? Math.max(1, Math.round(sample * 0.15)) : result === "FAR" ? 1 : 0;
        return {
          name,
          result,
          acceptQty: result === "NOT_CONDUCTED" ? undefined : sample - rejectQty,
          rejectQty: result === "NOT_CONDUCTED" ? undefined : rejectQty,
          note: result === "FAR" ? "Further analysis recommended — anomaly on sampled unit." : undefined,
        };
      });
      const anyFar = processes.some((p) => p.result === "FAR");
      // WHL sometimes issues the report without a resolvable client P/O
      const poUnknown = !req.clientPo || Math.random() < 0.25;
      const parseFlags: string[] = [];
      if (poUnknown) parseFlags.push("Client P/O came back as “PO Unknown” — reconcile against the PO on file.");
      if (processes.some((p) => p.result === "NOT_CONDUCTED")) parseFlags.push("One or more processes were Not Conducted — confirm the agreed test plan was run in full.");
      return {
        reportNo: `${req.workOrderNo}.${req.revision}`, revision: req.revision,
        reportDate: new Date().toISOString().slice(0, 10), workOrderNo: req.workOrderNo,
        fileName: `WHL-${req.workOrderNo}.${req.revision}.pdf`,
        partNumber: req.mpn, manufacturer: req.manufacturer || "—", lotQty: req.lotQty,
        client: "Sharpbuy Global Solutions", clientPo: poUnknown ? "PO Unknown" : req.clientPo!,
        conclusion, anyFar, processes,
        approvedBy: "K. Ng", approverTitle: "Laboratory Manager",
        standards: ["AS6081", "AS6171"], riskClass: "ERAI Low Risk", msl: "MSL 3", packageType: "LQFP-100",
        confidentialityNote: WHL_CONFIDENTIALITY,
        revisionNote: req.revision > 1 ? `Revision ${req.revision} — supersedes ${req.workOrderNo}.${req.revision - 1} (electrical re-test on the flagged units).` : undefined,
        parseFlags,
      };
    },
    { latencyMs: [600, 1800], failError: { code: "REPORT_NOT_READY", message: "Report not yet issued for this work order", status: 404 } });
}

// ---- outbound mail ----

export interface WhlSendMailReq { to: string; subject: string; body: string; workOrderNo?: string; lotCode?: string; mpn?: string; poNo?: string }
export interface WhlSendMailRes { messageId: string; to: string; queuedAt: string }

/** In-app send (so the message stays attached to the lot instead of living in someone's Sent items). */
export function whlSendMail(req: WhlSendMailReq) {
  return mockCall<WhlSendMailRes>(SYS, LABEL, "POST /messages", req,
    () => ({ messageId: ref("MSG"), to: req.to || WHL_CONTACT, queuedAt: new Date().toISOString().slice(0, 16).replace("T", " ") }),
    { latencyMs: [300, 900], failError: { code: "MAIL_RELAY_DOWN", message: "Mail relay unavailable — retry", status: 503 } });
}

// ---- inbound mail (status updates, delay notices, revised reports) ----

export type WhlInboundKind = "STATUS_UPDATE" | "REPORT" | "DELAY" | "AMBIGUOUS";
export interface WhlInboundMail {
  messageId: string;
  kind: WhlInboundKind;
  subject: string;
  body: string;
  receivedAt: string;
  from: string;
  // matching keys the platform uses to route the mail; AMBIGUOUS mails carry none
  workOrderNo?: string;
  lotCode?: string;
  reportNo?: string;
  // per-test status updates carried by the mail
  testUpdates?: { name: string; status: TestProcessStatus; note?: string }[];
  attachments?: string[];
}

export interface WhlPollInboxReq { workOrders: { workOrderNo: string; lotCode: string; mpn: string; testNames: string[] }[] }

/**
 * Poll the WHL mailbox. Returns interim status notes, delay notices and report
 * notifications. ~15% of the time a mail comes back with an unusable subject line
 * (no work order / lot) — the platform routes those to a manual-match queue.
 */
export function whlPollInbox(req: WhlPollInboxReq) {
  return mockCall<{ messages: WhlInboundMail[] }>(SYS, LABEL, "GET /messages?unread=1", req,
    () => {
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
      if (req.workOrders.length === 0) return { messages: [] };
      const messages: WhlInboundMail[] = [];
      for (const wo of req.workOrders) {
        const kind = pickWeighted<WhlInboundKind>([["STATUS_UPDATE", 45], ["REPORT", 25], ["DELAY", 15], ["AMBIGUOUS", 15]]);
        if (kind === "AMBIGUOUS") {
          messages.push({
            messageId: ref("IN"), kind, from: WHL_CONTACT, receivedAt: now,
            subject: "RE: Testing update", // no WO / lot / report no → cannot be routed
            body: "Hi, quick update on the parts you sent through — one of the lots needs another day on the electrical bench. Will revert with the report. Regards, WHL",
          });
          continue;
        }
        if (kind === "REPORT") {
          messages.push({
            messageId: ref("IN"), kind, from: WHL_CONTACT, receivedAt: now,
            subject: `WHL Report ${wo.workOrderNo} — ${wo.mpn} (Lot ${wo.lotCode})`,
            body: `Please find attached our report for work order ${wo.workOrderNo}. Conclusion and process breakdown are in the attached PDF.`,
            workOrderNo: wo.workOrderNo, lotCode: wo.lotCode, reportNo: `${wo.workOrderNo}.1`,
            attachments: [`WHL-${wo.workOrderNo}.1.pdf`],
          });
          continue;
        }
        const picks = wo.testNames.length ? wo.testNames.slice(0, 2) : ["Electrical Test"];
        messages.push({
          messageId: ref("IN"), kind, from: WHL_CONTACT, receivedAt: now,
          subject: kind === "DELAY"
            ? `Delay notice — WO ${wo.workOrderNo} / Lot ${wo.lotCode}`
            : `Interim status — WO ${wo.workOrderNo} / Lot ${wo.lotCode}`,
          body: kind === "DELAY"
            ? `Decapsulation bench is backed up; expect ${wo.mpn} (Lot ${wo.lotCode}) to run 2 days past the quoted TAT.`
            : `${picks.join(" and ")} now underway for ${wo.mpn} (Lot ${wo.lotCode}).`,
          workOrderNo: wo.workOrderNo, lotCode: wo.lotCode,
          testUpdates: picks.map((name) => ({
            name,
            status: (kind === "DELAY" ? "PENDING" : "IN_PROGRESS") as TestProcessStatus,
            note: kind === "DELAY" ? "Delayed — bench backlog at WHL" : "Test in progress at WHL",
          })),
        });
      }
      return { messages };
    },
    { latencyMs: [500, 1500] });
}
