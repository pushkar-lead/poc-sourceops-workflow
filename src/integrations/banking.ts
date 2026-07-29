import { mockCall, ref } from "@/integrations/mock-client";
import type { PaymentDirection } from "@/types";

const SYS = "banking";
const LABEL = "Banking / T-T";

export interface TransferReq { payId: string; direction: PaymentDirection; amount: number; currency: string; beneficiary: string; }
export interface TransferAck { providerRef: string; status: "PENDING_CLEARING"; acceptedAt: string; }
export interface TransferStatus { providerRef: string; status: "CLEARED" | "RETURNED"; utr?: string; settledAmount?: number; }

const now = () => new Date().toISOString();

// Masking: a collection carries NO supplier identity; a payout carries NO client identity.
export function bankInitiateTransfer(req: TransferReq) {
  const endpoint = req.direction === "CLIENT_TO_1BUY" ? "POST /transfers/collection" : "POST /transfers/payout";
  return mockCall<TransferAck>(SYS, LABEL, endpoint, req,
    () => ({ providerRef: ref("TT"), status: "PENDING_CLEARING", acceptedAt: now() }),
    { latencyMs: [400, 1200], failError: { code: "INVALID_BENEFICIARY", message: "Beneficiary SWIFT/IBAN rejected", status: 422 } });
}

export function bankGetTransferStatus(providerRef: string, amount: number) {
  return mockCall<TransferStatus>(SYS, LABEL, `GET /transfers/${providerRef}`, { providerRef },
    () => ({ providerRef, status: "CLEARED", utr: ref("UTR"), settledAmount: amount }),
    { latencyMs: [600, 1600] });
}
