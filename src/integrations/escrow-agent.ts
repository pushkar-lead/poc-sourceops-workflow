import { mockCall } from "@/integrations/mock-client";
import type { EscrowInvoice, EscrowAgentEmail, EscrowFeeBreakdown, EscrowConditions, EscrowBankAccount, EscrowPaymentClosure } from "@/types";

const SYS = "escrow-agent";
const LABEL = "Escrow Agent (invoice inbox)";

// The gap this simulates: someone has to open the provider's invoice email and retype the
// numbers by hand. Real fix = IMAP/Graph webhook + template-parse the PDF, matched to the
// order by invoice/order reference (see Escrow spec §8). Fees scale off THIS order's actual PO
// amount (roughly the $60/$40 on $7,013 ratio from the reference invoice) — the second fetch is
// a "revised" invoice bumping the buyer fee +25%, used to demonstrate the §7 reconciliation
// check catching a provider fee change after PO time.
function computeSampleFees(poAmount: number, revised: boolean): EscrowFeeBreakdown {
  const baseFeeToBuyer = Math.round(poAmount * 0.00856); // ≈ $60 on a $7,013 PO
  return {
    poTotal: poAmount,
    feeToBuyer: revised ? Math.round(baseFeeToBuyer * 1.25) : baseFeeToBuyer,
    wiringFeeToBuyer: Math.round(poAmount * 0.0057), // ≈ $40 on a $7,013 PO
    feeToSeller: 0,
    wiringFeeToSeller: 0,
  };
}

// Fallback only for escrow records with no agreedConditions on file (legacy/edge case) — real
// conditions should come from what was actually agreed at PO time (see escrowAgentFetchInvoice).
const SAMPLE_CONDITIONS: EscrowConditions = {
  forwarder: "DHL", forwarderAccountNo: "DHL-ACC-88213 (demo)", shipWithinDays: "7 business days",
  inspectionPeriod: "5 business days", feeSharingLabel: "100% Buyer / 0% Seller", returnCondition: "7 business days, shipping fees to Seller",
  releaseMilestones: [
    { percent: 30, trigger: "On shipment to WHL for testing" },
    { percent: 70, trigger: "On WHL PASS report" },
  ],
};

// Fictional demo bank details — never the escrow provider's real account. Every simulated/uploaded
// invoice quotes the same provider account (wire instructions are the provider's, not per-order).
export const DEMO_ESCROW_BANK_ACCOUNT: EscrowBankAccount = {
  bankName: "Global Escrow Trust Bank (demo)",
  bankAddress: "1 Demo Plaza, Central, Hong Kong",
  beneficiaryName: "Escrow Agent Holdings Ltd (demo)",
  accountNumber: "888-123456-888",
  swiftCode: "DEMOHKHX",
};

export interface FetchInvoiceRes { email: EscrowAgentEmail; invoice: EscrowInvoice; }

export function escrowAgentFetchInvoice(req: { orderRef: string; invoiceNo: string; sequence: number; poAmount: number; agreedConditions?: EscrowConditions }) {
  return mockCall<FetchInvoiceRes>(SYS, LABEL, "GET /inbox/latest", req,
    () => {
      const revised = req.sequence > 0;
      const fees = computeSampleFees(req.poAmount, revised);
      const invoiceNo = revised ? `${req.invoiceNo}-R${req.sequence}` : req.invoiceNo;
      const receivedAt = new Date().toISOString().slice(0, 10);
      // The invoice quotes whatever was actually agreed at PO time — not a one-size-fits-all default.
      const conditions = req.agreedConditions ?? SAMPLE_CONDITIONS;
      return {
        email: {
          id: `ea-${req.orderRef}-${req.sequence}`, direction: "RECEIVED",
          subject: revised ? `[Revised] Escrow invoice ${invoiceNo} — ${req.orderRef}` : `Escrow invoice ${invoiceNo} — ${req.orderRef}`,
          from: "billing@hkin-escrow.example",
          snippet: revised
            ? `Please note the escrow fee to buyer has been revised to US$${fees.feeToBuyer}.00 on this invoice.`
            : `Please find attached the escrow invoice for order ${req.orderRef}.`,
          receivedAt,
          attachmentFileName: `${invoiceNo}.pdf`,
        },
        invoice: { invoiceNo, fees, conditions, bankAccount: DEMO_ESCROW_BANK_ACCOUNT, receivedAt },
      };
    },
    { latencyMs: [500, 1400] });
}

export interface FetchPoPiRes { email: EscrowAgentEmail; poFileName: string; piNo: string; piFileName: string; receivedAt: string; }

// Fetches the buyer PO + supplier PI as evidence documents (the escrow order references them, but
// doesn't itself carry a piNo — the real PI is confirmed upstream and just attached here).
export function escrowAgentFetchPoPi(req: { orderRef: string }) {
  return mockCall<FetchPoPiRes>(SYS, LABEL, "GET /inbox/po-pi", req,
    () => {
      const receivedAt = new Date().toISOString().slice(0, 10);
      const piNo = `PI-${req.orderRef.replace(/\D/g, "").slice(-6)}`;
      return {
        email: { id: `ea-popi-${req.orderRef}`, direction: "RECEIVED", subject: `PO + PI documents — ${req.orderRef}`, from: "billing@hkin-escrow.example",
          snippet: "Please find attached the purchase order and proforma invoice for this escrow order.", receivedAt, attachmentFileName: `${piNo}.pdf` },
        poFileName: `buyer-po-${req.orderRef}.pdf`, piNo, piFileName: `supplier-pi-${req.orderRef}.pdf`, receivedAt,
      };
    },
    { latencyMs: [400, 1000] });
}

export interface FetchEmailRes { email: EscrowAgentEmail; }

// HKin's confirmation that the seller has accepted the order (terms + WHL ship-to + inspection
// period) — the counterpart to the "send order to seller" email SC sends out.
export function escrowAgentFetchHkinConfirmation(req: { orderRef: string; orderId: string; poAmount: number; currency: string; inspectionPeriod: string; feeSharingLabel: string; whlShipTo: string }) {
  return mockCall<FetchEmailRes>(SYS, LABEL, "GET /inbox/order-confirmation", req,
    () => ({
      email: {
        id: `ea-conf-${req.orderRef}`, direction: "RECEIVED",
        subject: `Seller accepted the order — ${req.orderRef}`, from: "billing@hkin-escrow.example",
        snippet: `Seller has accepted order ${req.orderId} — PO ${req.poAmount} ${req.currency}, inspection period ${req.inspectionPeriod}, fee sharing ${req.feeSharingLabel}, WHL ship-to ${req.whlShipTo}.`,
        receivedAt: new Date().toISOString().slice(0, 10),
      },
    }),
    { latencyMs: [400, 900] });
}

export interface FetchWhlVerdictRes { email: EscrowAgentEmail; reportRef: string; }

// WHL's test-report email — the one WHL signal escrow actually needs (booking + test execution
// itself is tracked on the Testing tab, not here). PASS is what unlocks the release milestone.
export function escrowAgentFetchWhlVerdict(req: { orderRef: string; verdict: "PASS" | "FAIL" }) {
  return mockCall<FetchWhlVerdictRes>(SYS, LABEL, "GET /inbox/whl-verdict", req,
    () => {
      const reportRef = `WHL-RPT-${req.orderRef.replace(/\D/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const receivedAt = new Date().toISOString().slice(0, 10);
      return {
        email: {
          id: `ea-verdict-${req.orderRef}-${Date.now()}`, direction: "RECEIVED",
          subject: `WHL verdict: ${req.verdict} — ${req.orderRef}`, from: "reports@whl-labs.example",
          snippet: req.verdict === "PASS" ? `WHL confirms PASS — detailed report ${reportRef} attached.` : `WHL flags FAIL — detailed report ${reportRef} attached. Decide retest or return.`,
          receivedAt, attachmentFileName: `${reportRef}.pdf`,
        },
        reportRef,
      };
    },
    { latencyMs: [400, 1000] });
}

export interface FetchPaymentClosureRes { email: EscrowAgentEmail; closure: EscrowPaymentClosure; }

// Final settlement confirmation once funds reach the seller.
export function escrowAgentFetchPaymentClosure(req: { orderRef: string; documentNo: string; releasedAmount: number }) {
  return mockCall<FetchPaymentClosureRes>(SYS, LABEL, "GET /inbox/payment-closure", req,
    () => {
      const receivedAt = new Date().toISOString().slice(0, 10);
      return {
        email: { id: `ea-pc-${req.orderRef}`, direction: "RECEIVED", subject: `Payment closure ${req.documentNo} — ${req.orderRef}`, from: "billing@hkin-escrow.example",
          snippet: `Escrow closed — US$${req.releasedAmount} released to the seller.`, receivedAt, attachmentFileName: `${req.documentNo}.pdf` },
        closure: { documentNo: req.documentNo, releasedAmount: req.releasedAmount, receivedAt },
      };
    },
    { latencyMs: [400, 1000] });
}
