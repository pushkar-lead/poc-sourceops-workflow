import { mockCall, ref, pickWeighted } from "@/integrations/mock-client";
import type { TestStatus } from "@/types";

const SYS = "whl";
const LABEL = "WHL Lab";

export interface WhlSubmitReq { clientRef: string; mpn: string; dateCode: string; lotCode: string; lotQty: number; sampleQty: number; testPlan: string; labSite: string; }
export interface WhlSubmitRes { workOrderNo: string; status: "RECEIVED"; labSite: string; estimatedTatDays: number; }
export type WhlVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";
export interface WhlReportRes { workOrderNo: string; status: "IN_PROGRESS" | "COMPLETED"; verdict: WhlVerdict | null; reportNo?: string; tatDays?: number; }

export const mapVerdict = (v: WhlVerdict): TestStatus => (v === "INCONCLUSIVE" ? "MAYBE" : v);

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
