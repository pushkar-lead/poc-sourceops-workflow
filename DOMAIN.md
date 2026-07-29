# DOMAIN.md — 1Buy Masked Back-to-Back Mode-4 Trade Fulfilment

Business context and domain model for the poc-sourceops-workflow POC.

## What is Mode-4 Trade?

**Mode-4** (Mercurial/Trade Finance Mode 4) is a **back-to-back supply chain structure** where a buyer (client) sources from a supplier, but the transaction is **masked** — the supplier never sees the end-buyer's identity. Instead, a **masking entity** (1Buy's Sharpbuy subsidiary) is inserted in the middle:

```
[Client] (real buyer)
   ↓
[1Buy/Sharpbuy] (masking entity — the seller to supplier, buyer to client)
   ↓
[Supplier] (sees Sharpbuy as the buyer, never knows the real client)
```

**Why mask?**
- **Supplier negotiation leverage:** Suppliers price lower if they don't know the real buyer (avoid direct deals).
- **Confidentiality:** Clients' sourcing strategies stay private.
- **Arbitrage:** 1Buy captures margin between client price and supplier cost.
- **Risk isolation:** If the client defaults, the supplier is 1Buy's problem, not the supplier's problem.

---

## The Three-Entity Model

### 1. **Client PO** (Buyer's Demand)
The **real client's** purchase order. Contains:
- **Lines:** MPN, Make, Qty, Unit Price (what the client is willing to pay), Required By date
- **Address:** Where goods ship to (the client's site)
- **Terms:** Delivery terms, testing terms, payment method (advance/LC/credit)
- **Status:** UNSOURCED → PARTIALLY_SOURCED → FULLY_SOURCED (computed from supplier PO links)

**Role:** Demand signal. Multiple supplier POs can be sourced to fulfill one client PO line (N:N).

### 2. **Supplier PO** (1Buy's Purchase)
**1Buy's PO to the supplier.** Contains:
- **Supplier:** Name, country, GSTIN (if India), state
- **Lines:** MPN, Make, Qty, Buy Unit Price, references to which Client PO line(s) it sources for
- **Terms:** Payment method (advance/LC/credit), credit days (if CREDIT mode), incoterm (EXW/FOB/CIF), destination port (if CIF), delivery terms, testing terms
- **Terms & Conditions:** Standard clauses (genuine goods, traceability, datecode, test report, failbearer, warranty, no partial shipment, RoHS) — tickboxes with pre-checked defaults + free-text additions
- **Relabel Cost:** Cost for 1Buy hub to relabel goods (applies to masked trade only)
- **Status:** DRAFT → ORDERED (once an Order is created) → completed

**Role:** Sourcing commitment. Links client demand to supplier supply. One supplier PO can serve multiple client POs (e.g., an MPN that multiple clients need).

### 3. **Order** (Fulfilment Journey)
**The execution/fulfillment document.** Created from a Supplier PO. Contains:
- **Parties:** Buyer (the client), Supplier, Masking Entity (Sharpbuy), Incoterms, Payment terms
- **Lines:** Inherited from the supplier PO, with per-line testing mode (NONE/SUPPLIER_SELF/WHL)
- **Sourcing Allocations:** Maps order lines → client PO lines (N:N): which client PO did this order line source for, and in what qty?
- **Escrow** (if applicable): Holds supplier payment in escrow until delivery/testing confirmed
- **Journey:** 9 phases (KICKOFF, PAYMENT, TESTING, EXPORT, IMPORT, CUSTOMS, RELABEL, DELIVERY, CLOSE) with gates and manual steps
- **Lots:** Per-line test samples (WHL or supplier self-test), with PASS/FAIL/MAYBE status
- **Shipments:** Inbound (supplier → 1Buy hub) + Outbound (1Buy hub → client)
- **Customs:** ICEGATE BOE filings (domestic or international)
- **Deliveries:** Maps received + tested goods → client PO lines (completes fulfillment)
- **Payments:** Logs client→1Buy and 1Buy→supplier payments
- **Approvals:** PO review, relabeling approval, delivery authorization

**Role:** Tracks fulfilment from purchase to delivery. One order = one supplier PO's entire journey.

---

## The Masked Trade Masking Act

In masked trade, the **relabel step** is critical. Before goods leave the 1Buy hub:

1. **Goods arrive** from supplier with supplier's invoice + supplier's label/branding
2. **1Buy receives + inspects** at the hub (customs clearance if international)
3. **Relabel:** 1Buy removes supplier's label and applies its own (or the client's, depending on agreement)
4. **Cost:** 1Buy charges a **relabel cost** (captures in `SupplierPO.relabelCost` and `Order.relabelCost`)
5. **Outbound:** Goods ship to client with 1Buy's/client's invoice, supplier's identity erased

**Why this matters:**
- Supplier never knows where goods ultimately go (fulfills anonymously)
- Client gets an invoice from 1Buy, not the supplier (keeps supply chain confidential)
- 1Buy's margin = (client price − supplier cost − relabel cost − freight − testing − etc.)

---

## Escrow: 1Buy's Credit Risk Mitigation

When a **Supplier PO uses ESCROW payment mode**, funds are held in escrow (e.g., via HKIN) until goods are confirmed received and tested.

### Escrow Math

```
Material Amount (A1)         = Sum of supplier PO line totals (what we buy)
Charges Amount (A2)          = 2% of A1 (escrow agent's handling fee)
Banking Charges              = Wire/FX fees (e.g., 0.5% of A1)
Fixed Fees                   = 450 (1Buy 300 + Supplier 150)

Super Invoice Total          = A1 + A2 + Banking + 450

⚠️  RELEASE CAP = A1 ONLY  (not the super-invoice)
```

Only **A1 (material amount)** is releasable to the supplier. The rest stays with the escrow agent or is refunded to 1Buy.

### Escrow Lifecycle

```
OPEN
  ├─ FUND: 1Buy deposits A1+A2+Banking+Fees into escrow (awaits full payment receipt)
  │
  ├─ FUNDED (all funds in escrow, awaiting release trigger)
  │   ├─ Release Trigger: "Per T&C + lab PASS" (if T&Cs specified) OR "Upon lab PASS" (if no T&Cs)
  │   └─ Guard: At least one PASS lot + escrowRemaining > 0 + FUNDED status
  │
  ├─ PARTIALLY_RELEASED / RELEASED (supplier got paid, goods in transit)
  │
  ├─ Can REQUEST_EXTENSION: extend expiry date (e.g., if goods stuck in customs)
  │   └─ Extensions logged: REQUESTED → APPROVED/DECLINED (mock response)
  │
  └─ REFUNDED: 1Buy requested refund (e.g., supplier failed, order cancelled)
     └─ Guard: Can't release after REFUNDED (terminal state)
```

### Release Netting (Critical!)

When funds are released AND refunded, both are netted against A1:

```
EscrowRemaining = max(0, A1 − released − refunded)
```

**Example:**
- A1 = 10,000 USD
- Released to supplier = 6,000 USD (partial shipment confirmed)
- Refunded to 1Buy = 2,000 USD (quality issue, returning goods)
- Remaining = 10,000 − 6,000 − 2,000 = 2,000 USD (still available)

This prevents:
1. **Double-release** (releasing more than A1 total)
2. **Refund after release** (refunding already-released funds)

---

## Per-Line Testing Modes

Each order line can require testing:
- **NONE:** No testing required (standard components, proven suppliers)
- **SUPPLIER_SELF:** Supplier provides test report (CoA, compliance) at shipment time
- **WHL:** Send sample to WHL lab in China (3-5 days, higher cost, gold standard)

**Gate:** Before releasing escrow OR dispatching to client, all lines with testing modes must have **PASS lots**.

---

## Trade Type: Domestic vs. International

### Domestic (India → India)
- **Customs:** Usually not required (same country)
- **Exception:** If a line uses WHL (China lab), goods cross a border, so customs applies (goes to China → back to India)
- **E-invoice:** Required (GSTR-1 reporting) if client is registered under GST
- **Incoterm:** Usually EXW (supplier's site) or FCA (at 1Buy hub)

### International (Supplier country → India)
- **Customs:** Always required (both export + import)
- **Export:** Supplier's country customs clears goods out
- **Import:** India customs (ICEGATE BOE filing) clears goods in; duty assessed
- **E-invoice:** May not apply if supplier is foreign (outside GST scope)
- **Incoterm:** CFR (supplier covers freight to India) or CIF (supplier covers freight + insurance)

---

## 1Buy as a Masking Entity vs. Direct Reseller

In the POC, 1Buy is always the **masking entity** (Sharpbuy):
- Supplier sees "Sharpbuy" as the buyer (never sees the real client's name)
- Client sees "1Buy" as the seller (receives invoice + goods from 1Buy)
- Margin = (client price − supplier cost − relabel cost − operatingcosts)

**Why Sharpbuy?** It's 1Buy's "procurement arm" — a legal entity that acts as the buyer in masked trades.

---

## Payment Modes: Advance vs. Escrow vs. Credit

### Advance
1Buy pays the supplier upfront (before goods ship).
- **Risk:** Supplier ships late or ships quality-defective goods → 1Buy's loss
- **Client flow:** Client pays 1Buy first (or per agreement); 1Buy holds funds, pays supplier
- **Guard:** Gate only checks "CLIENT collection initiated" before paying supplier

### Escrow
Supplier payment is held in escrow until goods verified.
- **Risk:** Mitigated (supplier gets paid only after PASS)
- **Cost:** Escrow fees + banking charges (passed to supplier or absorbed by 1Buy)
- **Guard:** Gate checks escrow FUNDED before releasing

### Credit
Supplier ships now, 1Buy pays later (30/60/90 days).
- **Risk:** High (supplier extends credit, trusts 1Buy)
- **Supplier PO term:** `creditDays` (30, 60, or 90)
- **Flow:** Supplier ships → 1Buy receives + tests → PASS → invokes payment at agreed term
- **Guard:** Similar to advance (client collection first, supplier pay on schedule)

---

## Personas & Roles in the Ops Panel

The POC supports 4 personas (switchable in header):

| Persona | Responsibility | Key Tasks |
|---------|---|---|
| **SC** (Supply Chain) | Sourcing, supplier management | Create POs, approve suppliers, manage allocations |
| **Finance** | Payments, escrow, invoicing | Fund escrow, release supplier payments, reconcile |
| **Approver** | Quality, compliance, risk | Review POs, approve shipments, sign off on testing |
| **Mgmt** (Management) | Oversight, KPIs | View dashboards, check blockers, monitor margins |

---

## Typical Order Flow (Happy Path)

1. **Client PO Created** (demand recorded)
2. **Supplier PO Created** (sourcing commitment, links client line → supplier line)
3. **Order Scaffolded** (from Supplier PO, with escrow if payment mode = ESCROW)
4. **KICKOFF phase** → Manual: Supplier ACKs + sends PI
5. **PAYMENT phase gate** → FUNDED (if escrow) or PAID (if advance/credit)
6. **TESTING phase gate** → All per-line testing MPNs have PASS lots (via WHL or supplier self-test)
7. **EXPORT phase** → Supplier ships goods (INBOUND shipment created, awaits departure)
8. **IMPORT phase** → Goods in transit → arrive at 1Buy hub
9. **CUSTOMS phase gate** → ICEGATE BOE filed; duty assessed (if international)
10. **RELABEL phase** → Goods relabelled to 1Buy; relabel cost recorded
11. **DELIVERY phase gate** → All lines allocated to client POs; outbound shipment ready
   - E-invoice generated (if domestic India)
   - Delivery QTY finalized per client line
12. **CLOSE phase** → All approvals signed; order closed
13. **End state:** Client receives goods with 1Buy's invoice (supplier identity masked)

---

## Key Constraints & Assumptions

1. **No PO amendment:** Once a PO is ORDERED (Order created), it's locked (can't edit lines). New requirements = new PO.
2. **Testing is blocking:** A line can't be released to client until its test lot passes (if testing required).
3. **Sourcing is static:** Allocations are recorded at order creation time; can be edited before order is closed but not after.
4. **No partial refunds:** Refund is for entire line or nothing (no qty-based partial refunds in POC).
5. **Escrow is per-order:** Not shared across orders (each order has its own escrow account).
6. **Masking is permanent:** Once relabelled, goods can't be "unmasked" (no way to reveal supplier identity).

---

## Success Metrics (Post-POC)

- **Cycle time:** Days from order creation to client delivery (target: reduce vs. manual)
- **Cost:** Escrow fees + relabel cost + testing cost + freight (inline with budget)
- **Quality:** PASS rate % on first lot (optimize supplier + WHL reliability)
- **Cash flow:** When does 1Buy get paid vs. pay supplier? (escrow improves if working capital needed)
- **Margin capture:** Actual margin vs. quoted margin (operational efficiency)

---

## Context References

- **Design/Spec:** ~/Downloads/1Source/phase1-poc-plan.md
- **Demo Flow:** `docs/demo/demo-flow.md` (end-to-end walkthrough)
- **Technical Architecture:** `ARCHITECTURE.md` (system design, subsystems)
- **Code Conventions:** `RULES.md` (patterns, do/don'ts)
