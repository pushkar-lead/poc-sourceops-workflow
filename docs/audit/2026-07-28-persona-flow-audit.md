# 1Source Ops POC — Persona Flow & Usability Audit

**Date:** 2026-07-28
**Method:** 7-persona parallel expert panel (3 supply-chain experts + 4 sourcing specialists), each reading the actual code.
**Coverage note:** 5 of 7 audits completed (43 findings). **Two personas did not run — org monthly usage-credit cap was hit mid-run:** *Trade-finance/Escrow/Quality-risk* and *Supplier-PO issuance & fulfilment-execution*. Their areas are partly covered by overlap; re-run when credits are restored for full depth.

---

## Executive summary

The POC is a **genuinely strong fulfilment / quantity-routing engine**. Every persona praised the N:N allocation spine (consolidate/segregate, coverage caps, leg-aware remaining, map-later recompute), the policy-assembled journey with enforced gates, and the mock-integration layer. As an *order-execution* tool it is well past POC quality.

As a **real masked back-to-back international component-trading platform**, three structural gaps recur across every reviewer:

1. **The front of the funnel is missing.** The tool opens at the Client PO — it assumes sourcing already happened. There is no RFQ, no Quote, no side-by-side comparison, no Supplier master/onboarding, and the PI is a hollow manual gate. A sourcing desk can't actually source here.
2. **The cross-border trade is only half-modelled.** Inbound import (BOE → assess → clearance) exists, but the **export leg** for offshore clients (shipping bill / LEO / export invoice) does not — so the flagship international deal legally can't leave India. FEMA reconciliation (IDPMS/EDPMS/eBRC), export-control screening (SCOMET/ECCN/denied-party), country-of-origin preservation, real HSN→duty, and landed-cost-in-margin are all absent.
3. **The physical layer is bookkeeping without a warehouse.** "Received" is fabricated the moment an inbound AWB is booked (no GRN, no 3-way match); the **relabel-to-1Buy masking act — the one thing the whole model exists to do — is an ungated, evidence-free non-step**; and there is no lot/date-code/serial traceability.

Plus a cluster of **commercial-governance** gaps: the Client PO carries **no currency** (so margin can be silently wrong), margin approval is a blind rubber-stamp (no floor, negative allowed), the client's required-by date is captured then discarded (no OTIF), part identity is an **MPN string with no manufacturer binding and no alternates**, and MOQ/SPQ/price-breaks don't exist.

**Overall readiness:** *Excellent fulfilment demo; not yet a production sourcing-or-trade system.* The good news — the hard part (the allocation/journey engine) is done; most gaps are additive layers on top of a sound spine.

---

## Platform boundary (decided 2026-07-28)
**This console is fulfilment-only.** The sourcing front-of-funnel — RFQ → quote → award → PO issuance → **PO approval** → **sending the PO** → **supplier ACK + PI** — lives on the upstream **sourcing platform**. This console picks up an order that is **already approved with the PI in hand**; the operator simply **uploads the confirmed PI to the order**.

**Implemented (2026-07-28):** the journey no longer contains *"PO reviewed & approved / Send PO to supplier / Supplier ACK + PI"*; orders created from a Supplier PO land **ACTIVE** at the first fulfilment step (no PO-review gate here); a first-class **Supplier PI** (PI no + Upload-PI action) sits on the order Overview; and **date code moved to the line level** (client demand line → order line).

**Roadmap impact:** audit **Phase 1 (sourcing front-of-funnel)** — RFQ/quote/award, supplier master/onboarding, PI-as-data variance — is **OUT OF SCOPE (upstream)**. What remains for this console is the **fulfilment** half: customs (both legs) + FEMA reconciliation for the fulfilment money legs, GRN/relabel/lot traceability, currency/margin correctness, promise-date/OTIF, delivery/close + reconciliation, notifications, and the audit-event log. The Phase-0 correctness quick wins (currency, margin floor, OTIF, HSN/CoO capture, manufacturer+MPN key — several now underway) still apply.

---

## Readiness by area

| Area | Verdict | Note |
|---|---|---|
| N:N allocation / consolidate-segregate | 🟢 Strong | Well-built quantity engine; the backbone |
| Journey & gates | 🟢 Strong | Policy-assembled, enforced; auto-advance on approval |
| Mock integration layer | 🟢 Good | Realistic seams; swap-for-real ready |
| Inbound customs (import BOE) | 🟡 Partial | Works but skips IGM, duty-payment challan, RMS/exam |
| **Export customs (offshore clients)** | 🔴 Missing | No shipping bill / LEO / export invoice — deal can't leave India |
| **FEMA / remittance reconciliation** | 🔴 Missing | No IDPMS/EDPMS/eBRC, no purpose/AD code linkage |
| **Export-control / sanctions screening** | 🔴 Missing | Dual-use FPGAs/MCUs sourced & re-exported unscreened |
| **Sourcing front-of-funnel (RFQ→quote→award)** | 🔴 Missing | Starts at PO; no supplier master/onboarding |
| Part identity & alternates | 🔴 Weak | MPN-string only; no (make,MPN) key; no cross-refs |
| **Receiving / GRN / relabel evidence** | 🔴 Weak | "Received" faked at AWB; relabel ungated |
| Lot / date-code / serial traceability | 🔴 Missing | Delivery is MPN-only; PO date-code never checked |
| Pricing / margin / currency governance | 🟡 Partial | No client currency, no margin floor, approval blind |
| Promise date / OTIF | 🔴 Missing | requiredBy captured then ignored |
| Credit / amendments / sell-side ACK | 🔴 Missing | Buyer-side lifecycle absent |
| HSN & duty engine / landed cost | 🟡 Weak | Placeholder HSN, one flat rate, duty not costed |

---

## Prioritized gaps (deduped across personas)

Ranked by business impact. Effort = S/M/L/XL. "Raised by" = which lenses flagged it.

| # | Gap | Sev | Effort | Phase | Raised by |
|---|---|---|---|---|---|
| 1 | **Client PO has no currency** → sell/margin computed in supplier currency, silently wrong | 🔴 High | **S** | 0 | Client-PO |
| 2 | **Margin approval is a rubber-stamp** — no floor, no buy/sell shown, negative allowed, no re-approval on edit | 🔴 High | **S–M** | 0 | Client-PO, RFQ |
| 3 | **Required-by date discarded** — no promise date / OTIF / at-risk flag | 🔴 High | **S** | 0 | Logistics, RFQ, Client-PO |
| 4 | **HSN/CoO dropped to "—" on created orders** (fields exist, read downstream, left blank) | 🔴 High | **S** | 0 | BOM, Customs |
| 5 | **Part identity = MPN string, no manufacturer binding; no alternates/cross-ref** → passes wrong parts AND blocks valid substitutes | 🔴 Critical | **M** | 1 | BOM, RFQ |
| 6 | **No RFQ → Quote → Award funnel** — sourcing happens offline; PO committed blind | 🔴 Critical | **L** | 1 | RFQ |
| 7 | **No Supplier master / onboarding / KYC / vendor-approval gate** — suppliers are free-text strings | 🔴 Critical | **L** | 1 | RFQ, BOM |
| 8 | **PI is a hollow gate** — no PI data, no PO↔PI variance check before money commits | 🔴 High | **M** | 1 | RFQ |
| 9 | **Export leg unmodelled** — no shipping bill / LEO / export invoice for offshore clients | 🔴 Critical | **L** | 2 | Customs, Logistics |
| 10 | **No FEMA reconciliation** (IDPMS/EDPMS/eBRC, purpose/AD code, BOE↔remittance link) | 🔴 Critical | **L** | 2 | Customs |
| 11 | **No export-control / dual-use / denied-party screening** (SCOMET/ECCN/ITAR/OFAC) | 🔴 High | **M–L** | 2 | Customs |
| 12 | **Country-of-origin not preserved through relabel** (relabel changes brand, not origin) + no CoO cert | 🔴 High | **M** | 2 | Customs, BOM |
| 13 | **HSN→duty table + landed cost in margin** (flat 25.68% today; duty never paid/costed) | 🔴 High | **M** | 2 | Customs |
| 14 | **No GRN / 3-way match** — "received" = inbound-AWB-booked, not physically arrived | 🔴 Critical | **M** | 3 | Logistics |
| 15 | **Relabel/masking is ungated & evidence-free**; dispatch doesn't wait for it | 🔴 Critical | **M** | 3 | Logistics |
| 16 | **No lot/date-code/serial traceability**; PO date-code spec never enforced vs received lot | 🔴 High | **M** | 3 | Logistics, BOM |
| 17 | **Physical selectors ignore shipment status & clearance** — in-transit/uncleared goods can be delivered | 🔴 High | **M** | 3 | Logistics |
| 18 | **Shipment data is a stub** (1 box, 0 kg, no weight/dims/declared value/e-way bill) + no DG/ESD/MSL | 🟡 High | **M** | 3 | Logistics |
| 19 | **MOQ / SPQ / reel-UOM / price-breaks absent** — unit-granularity splits, flat prices | 🟡 High | **M** | 4 | BOM |
| 20 | **No PO amendment / change-order path** — amendments silently corrupt coverage | 🟡 High | **M** | 4 | Client-PO |
| 21 | **No sell-side ACK / PI to client**; buyer-confirmation loop absent | 🟡 High | **M** | 4 | Client-PO |
| 22 | **Credit terms have no limit/exposure**; CREDIT orders wrongly gated on advance collection | 🟡 High | **M** | 4 | Client-PO |
| 23 | **No lifecycle / RoHS-REACH / obsolescence**, no sourcing-channel/provenance (broker→WHL) | 🟡 High | **M** | 4 | BOM |
| 24 | **Multi-line BOM ingest is a single hardcoded mock line** | 🟡 Med | **M** | 4 | BOM |
| 25 | **Close doesn't reconcile delivered-vs-ordered**; no backorder record | 🟡 Med | **S–M** | 4 | Client-PO |
| 26 | **A19 = single full-duty BOE**, not two-leg re-import under exemption (45/2017-Cus) | 🟡 Med | **M** | 2 | Customs |
| 27 | **Domestic e-invoice hard-codes one buyer GSTIN**; no CGST/SGST vs IGST place-of-supply | 🟡 Med | **S** | 2 | Customs |
| 28 | **Client & Supplier masters** (buyer/supplier are free text) for 360 + multi-PO grouping | 🟡 Med | **M** | 4 | Client-PO, RFQ |

---

## Recommended roadmap

### Phase 0 — Correctness quick wins (days, mostly data plumbing)
Client-PO **currency** + FX-convert sell into order currency (#1); **margin shown to approver + floor gate + block negative + re-approve on edit** (#2); carry **requiredBy → promise date + At-Risk pill** on Orders/Client POs/Dashboard (#3); stop dropping **HSN/CoO** — capture on the forms and thread to the order line (#4); make **(manufacturer, MPN)** the part key + normalize MPN (start of #5).

### Phase 1 — Make it a sourcing tool (front-of-funnel)
**RFQ → Quote → side-by-side comparison → Award-creates-Supplier-PO** (#6); **Supplier master + onboarding/KYC/denied-party + VENDOR_APPROVAL gate**, drive testing mode from channel trust-tier (#7); **PI-as-data + PO↔PI variance freeze** (reuse the doc-extract adapter) (#8); **alternates / cross-reference** model so valid substitutes source (#5).

### Phase 2 — Make the cross-border trade legal
**Export leg**: shipping bill + LEO + export invoice/packing list as a distinct customs sub-journey + export gate when client ≠ IN (#9); **FEMA reconciliation** board + purpose/AD code + BOE/SB↔remittance linkage + eBRC (#10); **export-control screening** gate (HSN/ECCN/SCOMET/end-use/denied-party) (#11); **CoO immutable through relabel** + certificate (#12); **HSN→duty table + landed cost into margin** + duty-payment challan before OOC (#13); fix A19 two-leg re-import (#26) and e-invoice buyer GSTIN/place-of-supply (#27).

### Phase 3 — Make the warehouse real
**GRN + 3-way match** so "received" means arrived (#14); **relabel as a gated, evidenced work-order** blocking dispatch (#15); **lot/date-code/serial traceability** + date-code enforcement vs PO (#16); gate outbound/allocation on **cleared & received** qty (#17); **real shipment data** (weight/dims/declared value/e-way bill) + **DG/ESD/MSL** handling (#18); **ETA/OTIF + delay recompute** board.

### Phase 4 — Commercial depth & scale
MOQ/SPQ/price-breaks (#19); PO amendments/change-orders (#20); sell-side ACK/PI to client (#21); credit limits/exposure + mode-aware collection (#22); lifecycle/RoHS-REACH + channel/provenance (#23); multi-line BOM ingest (#24); delivered-vs-ordered reconciliation + backorders (#25); client/supplier masters (#28); notifications to role owners + unified immutable audit-event log; reporting/analytics.

---

## Quick wins (do first — small effort, high value)
- Add **currency to Client PO** and convert on order creation (#1) — everything downstream depends on it.
- Show **buy/sell/margin% to the approver** + a **margin floor** and **block negative margin** (#2).
- Carry **requiredBy → promise date** and show an **At-Risk/Late** pill + Dashboard KPI (#3).
- Capture **HSN + true CoO** on the forms; stop hardcoding `'—'` (#4).
- **Require manufacturer** on lines and **normalize MPNs** in the match guard (start of #5).
- Fix the **domestic e-invoice buyer GSTIN** to the actual mapped client (#27).

## Biggest risks (if this shipped as-is)
1. **Export-control / dual-use** items (FPGAs, MCUs) sourced and re-exported with **zero screening** — criminal-liability exposure; masking makes the operator blind to the end-user.
2. **The flagship international deal legally cannot leave India** — no export shipping bill.
3. **FEMA**: outward remittances with no BOE evidence + export proceeds with no eBRC → AD-bank caution-listing / RBI penalties.
4. **Margin is untrustworthy** — client currency missing + duty/freight/CHA excluded from cost; the "13% margin" is illusory.
5. **Masking integrity**: relabel is ungated/unevidenced and origin isn't preserved — the one act the business depends on is neither enforced nor proven.
6. **Counterfeit exposure**: no lot/date-code traceability, no channel/provenance, so WHL testing can't be tied to what actually ships.

---

## Not yet covered (personas cut off by the credit cap)
- **Trade finance / escrow / quality risk** (deep dive): escrow A1/A2 edge cases, dispute/chargeback, working-capital exposure, insurance/liability, WHL test-plan sufficiency by channel. *(Partly surfaced via customs/margin findings.)*
- **Supplier-PO issuance & fulfilment execution** (operator-at-scale): sending the masked PO, ACK handling, split-order UX, exception handling, running 50 concurrent orders, notifications, audit trail. *(Partly surfaced via RFQ + client-PO lenses; also on our prior backlog.)*
Re-run these two personas when usage credits are restored.

---

## Appendix — full finding inventory
See the raw persona output at the workflow transcript. 43 findings across: Customs/Trade-compliance (9), Logistics/Warehouse (9), RFQ/Onboarding (8), BOM/Part-intelligence (8), Client-PO/Order-management (9).
