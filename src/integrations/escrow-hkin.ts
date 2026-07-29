import { mockCall, ref } from "@/integrations/mock-client";

const SYS = "escrow-hkin";
const LABEL = "HKIN Escrow";

export interface OpenAccountReq { orderRef: string; currency: string; materialAmount: number; chargesAmount: number; feeSeller: number; feeBuyer: number; buyerToken: string; sellerToken: string; releaseTrigger: string; }
export interface OpenAccountRes { escrowRef: string; status: "OPEN"; superInvoiceTotal: number; }
export interface FundRes { escrowRef: string; status: "FUNDED"; heldAmount: number; providerTxnId: string; }
export interface ReleaseRes { escrowRef: string; status: "PARTIALLY_RELEASED" | "RELEASED"; releasedNow: number; remaining: number; providerTxnId: string; }
export interface RefundRes { escrowRef: string; status: "REFUNDED"; amount: number; providerTxnId: string; }

// Masking: only opaque tokens + Sharpbuy merchantRef ever leave the app.
const shortHash = (name: string) => Math.abs([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).toUpperCase().slice(0, 6);
export const buyerToken = (name: string) => `BUYER-${shortHash(name)}`;
export const sellerToken = (name: string) => `SELLER-${shortHash(name)}`;

export function hkinOpenAccount(req: OpenAccountReq) {
  return mockCall<OpenAccountRes>(SYS, LABEL, "POST /accounts", req,
    () => ({ escrowRef: ref("ES"), status: "OPEN", superInvoiceTotal: req.materialAmount + req.chargesAmount + req.feeSeller + req.feeBuyer }),
    { latencyMs: [300, 800] });
}

export function hkinFundSuperInvoice(req: { escrowRef: string; amount: number; material: number }) {
  return mockCall<FundRes>(SYS, LABEL, `POST /accounts/${req.escrowRef}/fund`, req,
    () => ({ escrowRef: req.escrowRef, status: "FUNDED", heldAmount: req.material, providerTxnId: ref("TXN") }),
    { latencyMs: [800, 2500], failError: { code: "INSUFFICIENT_FUNDS", message: "Buyer wire declined", status: 402 } });
}

export function hkinReleaseTranche(req: { escrowRef: string; amount: number; remaining: number; trigger: string }) {
  return mockCall<ReleaseRes>(SYS, LABEL, `POST /accounts/${req.escrowRef}/release`, req,
    () => {
      const remainingAfter = Math.max(0, req.remaining - req.amount);
      return { escrowRef: req.escrowRef, status: remainingAfter <= 0 ? "RELEASED" : "PARTIALLY_RELEASED", releasedNow: req.amount, remaining: remainingAfter, providerTxnId: ref("TXN") };
    },
    { latencyMs: [600, 1500], failError: { code: "RELEASE_EXCEEDS_BALANCE", message: "Release exceeds held balance", status: 422 } });
}

export interface ExtensionRes { escrowRef: string; status: "APPROVED" | "DECLINED"; newExpiry: string; providerTxnId: string; }

// Escrow-window extension: emailed request to the counterparty; the mock replies APPROVED/DECLINED.
export function hkinRequestExtension(req: { escrowRef: string; reason: string; newDate: string }) {
  return mockCall<ExtensionRes>(SYS, LABEL, `POST /accounts/${req.escrowRef}/extension-request`, req,
    () => ({ escrowRef: req.escrowRef, status: "APPROVED", newExpiry: req.newDate, providerTxnId: ref("TXN") }),
    { latencyMs: [900, 2200] });
}

export function hkinRefund(req: { escrowRef: string; amount: number; reason: string }) {
  return mockCall<RefundRes>(SYS, LABEL, `POST /accounts/${req.escrowRef}/refund`, req,
    () => ({ escrowRef: req.escrowRef, status: "REFUNDED", amount: req.amount, providerTxnId: ref("TXN") }),
    { latencyMs: [800, 2000] });
}
