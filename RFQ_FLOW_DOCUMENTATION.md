# RFQ Flow Documentation - Client RFQs to Supplier RFQs to Client Quotes

## Overview

The RFQ (Request for Quotation) flow consists of three main actors:
1. **Client RFQs** - Requests from buyers (incoming)
2. **Supplier RFQs** - Our aggregated requests to suppliers (outgoing)
3. **Client Quotes** - Quotes we send back to buyers (outgoing)

This document clarifies the complete flow and how demands are aggregated.

---

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BUYER/CLIENT SIDE                           │
│  "We need 500x STM32F407VG by Aug 31 at $8/unit minimum"           │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ├─ Email (auto-parsed via rfq-intake adapter)
                 └─ Manual entry (Demand Intake page)
                 │
                 ▼
        ┌────────────────────┐
        │  CLIENT RFQs PAGE  │  View all incoming RFQs from buyers
        │ /fulfilment/       │  Grouped by buyer/source
        │  client-rfq        │  Import from email or manual entry
        └────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  DEMAND LINES      │  Each RFQ line = 1 DemandLine
        │ (DemandLine[])     │  • mpn, qty, target price
        │                    │  • required date, buyer ref
        └────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────────┐
  │    RFQ AGGREGATION (CRITICAL STEP)       │
  │  Group demands by: MPN + currency +      │
  │  required-date (with tolerance)          │
  │                                          │
  │  E.g. 5 buyers want STM32F407VG         │
  │  → 1 Supplier RFQ for 2500 units total  │
  └──────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  RFQ BUNDLES       │  Aggregated RFQs
        │ (RfqBundle[])      │  • Multiple supplier targets
        │                    │  • Deadline + tolerance
        │                    │  • Traceability to client RFQs
        └────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  SUPPLIER RFQs     │  Send to multiple suppliers
        │  /fulfilment/      │  Portal links or emails
        │  rfq-bundles       │  Suppliers compete on price
        └────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ SUPPLIER QUOTES    │  Quotes from suppliers
        │ (SupplierQuote[])  │  • Price per unit
        │                    │  • Stock available
        │                    │  • Lead time
        └────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────────┐
  │    QUOTE COMPARISON & SELECTION          │
  │  SC compares quotes, selects best        │
  │  Calculates margin % per line            │
  │  Creates ClientQuoteDecision             │
  └──────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ CLIENT QUOTES      │  Quote back to buyers
        │ /fulfilment/       │  Masked (no supplier name)
        │ client-quotes      │  With margin applied
        └────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BUYER/CLIENT SIDE                           │
│  "We accept the quote. Please proceed with procurement."            │
└─────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  AUTO-CREATE POs   │  System auto-creates:
        │                    │  • SupplierPOs for each supplier
        │                    │  • ClientPOs for each buyer
        │                    │  • Linking via clientPoId
        └────────────────────┘
```

---

## Pages in RFQ Flow

### 1. **Client RFQs** (`/fulfilment/client-rfq`)
**Purpose:** View and manage incoming RFQs from buyers

**Features:**
- Import from email (paste RFQ text, auto-parse)
- Manual entry of demand lines
- Group by buyer
- Show source (email, manual, portal)
- Button to aggregate into supplier RFQ

**Action:** Go to RFQ Aggregation when ready to group demands

---

### 2. **RFQ Aggregation Flow** (`/fulfilment/rfq-aggregation`)
**Purpose:** Understand and monitor the complete RFQ flow

**Shows:**
- Statistics: # of client RFQs → # aggregated → # quotes → # client quotes
- Step-by-step flow diagram (6 steps)
- Traceability chain: Client RFQ → DemandLine → RfqLine → SupplierQuote → ClientQuote
- Response rates and aggregation ratios

**Not interactive** - just informational to understand the process

---

### 3. **Demand Intake** (`/fulfilment/demand-intake`)
**Purpose:** Create demand lines manually or review parsed ones

**Features:**
- Create new demand: MPN, Qty, Target Price, Required Date
- Stock intelligence lookup (Octopart-like)
- Shows all demands with source
- Bulk review before aggregation

---

### 4. **RFQ Bundles** (`/fulfilment/rfq-bundles`)
**Purpose:** Create and manage aggregated Supplier RFQs

**What happens:**
1. Select demand lines from Demand Intake
2. Add suppliers to quote (2-5 typically)
3. Set deadline + date tolerance
4. Send to suppliers (email + portal)

**Result:** One RfqBundle sent to N suppliers

---

### 5. **Quote Matching Inbox** (`/fulfilment/quote-matching-inbox`)
**Purpose:** Manual matching of supplier quote emails to RFQ lines

**When needed:**
- Supplier sends unstructured quote email
- Auto-parsing failed
- Manual match to RFQ line

---

### 6. **RFQ Bundles [Decide]** (`/fulfilment/rfq-bundles/[id]/decide`)
**Purpose:** Compare quotes and decide which to use

**Flow:**
- Tab 1: Compare supplier quotes side-by-side
- Tab 2: Apply markup % and calculate P&L
- Tab 3: Review decision
- Tab 4: Submit for Finance approval

**Result:** ClientQuoteDecision created

---

### 7. **Client Quotes** (`/fulfilment/client-quotes`)
**Purpose:** Outbound quotes to buyers

**Shows:**
- All quotes sent to buyers
- Status: PENDING → ACCEPTED
- Accept/Decline buttons
- Auto-creates POs on acceptance

---

## Key Concepts

### Aggregation Strategy

**Demands are aggregated by:**
- ✅ MPN (same component)
- ✅ Currency (same currency)
- ✅ Required Date (within tolerance, e.g., 7 days)

**Aggregation creates:**
- 1 RfqLine per unique MPN combo
- RfqLine.demandLineIds[] → traces back to all client RFQs
- RfqLine.aggregatedQty = sum of all demand qtys for this MPN

**Example:**
```
Client RFQ 1: 500x STM32F407VG by Aug 31
Client RFQ 2: 300x STM32F407VG by Aug 28 (within tolerance)
Client RFQ 3: 500x STM32F407VG by Sep 5 (outside tolerance → separate RFQ)

Aggregation Result:
- RfqBundle 1: 800x STM32F407VG (combines RFQs 1 & 2)
- RfqBundle 2: 500x STM32F407VG (separate due to date)
```

---

## Data Model Chain

```typescript
// 1. INCOMING: Client RFQ
Email: "We need 500x STM32F407VG at $8/unit, delivery Aug 31"

// 2. Parse → DemandLine
{
  id: "dem-001",
  mpn: "STM32F407VG",
  qty: 500,
  targetPrice: 8.00,
  currency: "USD",
  requiredByDate: "2026-08-31",
  clientPoId: "buyer-001",
  source: "email"
}

// 3. Aggregate → RfqLine
{
  id: "rlin-001",
  rfqBundleId: "rfq-001",
  demandLineIds: ["dem-001", "dem-002"],  // 2 clients
  mpn: "STM32F407VG",
  aggregatedQty: 800,  // 500 + 300
  targetPrice: 8.00,
  clientPoId: "buyer-001",  // Buyer ref preserved
}

// 4. Supplier responds → QuoteLine
{
  id: "ql-001",
  rfqLineId: "rlin-001",
  supplierEmail: "sales@shanghai-elec.com",
  quotedMpn: "STM32F407VG",  // May be alternate
  unitPrice: 7.85,  // Better than target!
  stockQty: 1000,
  leadTimeDays: 12,
  currency: "USD"
}

// 5. We decide → SupplierQuote (selected)
// Client sees masked → ClientQuote
{
  id: "cq-001",
  clientQuoteId: "cq-001",
  clientName: "Acme Electronics",
  clientEmail: "buyer@acme.com",
  lines: [
    { mpn: "STM32F407VG", qty: 500, unitPrice: 9.81 }  // With margin
  ],
  status: "PENDING"
}

// 6. Client accepts → Auto-create SupplierPO
{
  id: "spo-001",
  clientPoId: "buyer-001",  // ← Linked back!
  referenceNo: "rfq-001",
  supplierEmail: "sales@shanghai-elec.com",
  lines: [
    { mpn: "STM32F407VG", qty: 800, unitPrice: 7.85 }
  ]
}
```

---

## Traceability (Critical for Disputes)

### Forward Trace (Client → PO):
```
Client Email
  ↓ (parsed as)
DemandLine.clientPoId
  ↓ (aggregated into)
RfqLine.clientPoId
  ↓ (selected quote creates)
ClientQuote
  ↓ (accepted creates)
SupplierPO.clientPoId
```

### Backward Trace (PO → Client):
```
SupplierPO.clientPoId → Original buyer
SupplierPO.referenceNo → Which RFQ bundle
RfqLine.demandLineIds[] → All client RFQs that fed this PO
```

---

## Email Integration

### RFQ Intake Flow:
1. **Receive:** Client sends RFQ email
2. **Detect:** System polls email (or manual paste)
3. **Parse:** `rfq-intake` adapter extracts:
   - Buyer name + email
   - Component MPNs
   - Quantities
   - Target prices
   - Required dates
4. **Create:** DemandLines automatically or with review
5. **Aggregate:** Ready to bundle into supplier RFQ

### Quote Intake Flow:
1. **Receive:** Supplier responds with quote
2. **Parse:** `quote-intake` adapter extracts:
   - Quoted MPN (may be alternate)
   - Unit price
   - Stock qty
   - Lead time
3. **Match:** Manual matching if auto-parse fails
4. **Create:** QuoteLine linked to RfqLine

---

## Next Steps

1. **Import Client RFQ** → /fulfilment/client-rfq
2. **Create Demand Lines** → /fulfilment/demand-intake
3. **Aggregate into Supplier RFQ** → /fulfilment/rfq-bundles/new
4. **Send to Suppliers** → Auto via portal/email
5. **Collect Quotes** → /fulfilment/quote-matching-inbox (if needed)
6. **Compare & Decide** → /fulfilment/rfq-bundles/[id]/decide
7. **Send Client Quote** → /fulfilment/client-quotes
8. **Client Accepts** → Auto-create SupplierPO & ClientPO

---

## Statistics & Monitoring

Visit `/fulfilment/rfq-aggregation` to see:
- How many client RFQs received
- How many lines aggregated (ratio)
- Supplier response rates
- Client quote acceptance rates

This gives visibility into aggregation effectiveness and negotiation outcomes.

---

## File Summary

### New Pages:
- `src/app/fulfilment/client-rfq/page.tsx` - View & manage incoming client RFQs
- `src/app/fulfilment/rfq-aggregation/page.tsx` - Flow visualization & statistics

### Updated Navigation:
- RFQ Management group restructured for clarity
- Added "Client RFQs" (incoming)
- Renamed "Supplier RFQs" (RFQ Bundles)
- Added "RFQ Flow" (visualization)

### Existing Integrated Pages:
- Demand Intake (manual entry)
- RFQ Bundles (creation & aggregation)
- Quote Matching Inbox (email matching)
- Client Quotes (outbound quotes)

---

## Build Status
✅ 29 pages
✅ Build passes
✅ All RFQ features integrated
✅ Email parsing ready (via adapters)
