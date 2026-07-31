import { mockCall, ref } from "@/integrations/mock-client";
import type { NotifyParty } from "@/types";

const SYS = "notify";
const LABEL = "Notification Mail";

export interface NotifyReq {
  party: NotifyParty;
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
  orderNo: string;
  lotCode: string;
  reportNo?: string;
}
export interface NotifyRes { messageId: string; to: string; queuedAt: string; attachments: number }

/**
 * Outbound notification to a counterparty (supplier / buyer / escrow / lab).
 * Mock transport — same seam as the other adapters, so every send shows up in the
 * integration console. Swap `produce` for the real mail/API call later.
 */
export function sendPartyNotification(req: NotifyReq) {
  return mockCall<NotifyRes>(SYS, LABEL, `POST /notifications/${req.party.toLowerCase()}`, req,
    () => ({
      messageId: ref("NTF"), to: req.to,
      queuedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      attachments: req.attachments?.length ?? 0,
    }),
    { latencyMs: [350, 1100], failError: { code: "MAIL_RELAY_DOWN", message: "Mail relay unavailable — retry", status: 503 } });
}
