import { mockCall, ref } from "@/integrations/mock-client";

const SYS = "einvoice";
const LABEL = "GST e-Invoice / IRP";

export interface IrpGenerateReq {
  supplyType: "B2B" | "EXPWOP";
  sellerGstin: string;   // ALWAYS the masking entity — never the supplier
  buyerGstin: string;    // client GSTIN, or "URP" for export
  docNo: string;         // idempotency key
  totalValue: number;
  igst: number;
}
export interface IrpGenerateRes {
  status: "ACT";
  irn: string;           // 64-char
  ackNo: string;
  ackDt: string;
  signedQRCode: string;
}

const now = () => new Date().toISOString();
const irn64 = () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 18)).join("").slice(0, 64).padEnd(64, "0");

export function generateIrn(req: IrpGenerateReq) {
  return mockCall<IrpGenerateRes>(SYS, LABEL, "POST /invoice", req,
    () => ({ status: "ACT", irn: irn64(), ackNo: `${Math.floor(1e11 + Math.random() * 8e11)}`, ackDt: now(), signedQRCode: `QR:${ref("QR")}` }),
    { latencyMs: [700, 2500], failError: { code: "2150", message: "Duplicate IRN for document", status: 409 } });
}

export function cancelIrn(irn: string, reason: string) {
  return mockCall<{ status: "CNL"; cancelledAt: string }>(SYS, LABEL, "POST /invoice/cancel", { irn, reason },
    () => ({ status: "CNL", cancelledAt: now() }),
    { latencyMs: [500, 1500] });
}
