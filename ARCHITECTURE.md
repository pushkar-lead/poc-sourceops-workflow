# ARCHITECTURE.md — Technical Architecture

System design, data flows, and subsystem integration for poc-sourceops-workflow.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React 18 + Next.js 16                    │
│                  (App Router, Server Components)            │
├─────────────────────────────────────────────────────────────┤
│                     Zustand v5 Store                        │
│  (localStorage-persisted state: POs, Orders, Integrations)  │
├─────────────────────────────────────────────────────────────┤
│  TanStack React Query v5  │  TanStack React Table v8        │
│  (mock data fetching)     │  (data grid rendering)          │
├─────────────────────────────────────────────────────────────┤
│               Mock Integration Layer                         │
│  HKIN · ICEGATE · WHL · Logistics · Banking · E-Invoice     │
│  (latency-injected, chaos toggle, call logging)             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input (forms/modals)
  ↓
Zustand Actions (createClientPo, fundEscrow, etc.)
  ↓
State Mutation (immer) + localStorage sync
  ↓
Components re-render (React hooks)
  ↓
Selectors compute derived state (escrowRemaining, gateReason, etc.)
  ↓
Integration Side-effects (async: HKIN fund, ICEGATE file, etc.)
  ↓
Integration results logged to call log
  ↓
State updated with response data
```

## Store Architecture (`src/store/`)

### Main Store (`store.ts`)

```ts
interface State {
  clientPos: ClientPO[];
  supplierPos: SupplierPO[];
  orders: Record<string, OrderBundle>;
  integrationLog: IntegrationCall[];
  chaos: boolean; // chaos toggle for failures
  selectedPersona: Persona;
}

// Actions (all use immer)
createClientPo(payload: CreateClientPoPayload): void
createSupplierPo(payload: CreateSupplierPoPayload): void
createOrderFromSupplierPo(spo: SupplierPO): void
advanceStep(orderId: string, phase: JourneyPhase): void
fundEscrow(orderId: string, amount: number, bankingCharges: number): void
releaseEscrow(orderId: string): void
refundEscrow(orderId: string, amount: number): void
requestEscrowExtension(orderId: string, reason: string, newDate: Date): void
// ... and ~20 more actions
```

**Key design:**
- All actions use immer (`produce` wrapper) for immutable updates
- `localStorage` persistence via `persist` middleware
- Guards (gates) checked before each action; if guard fails, no-op + toast
- Async actions (integrations) dispatch `logIntegrationCall` on completion
- Optimistic updates for long-running actions (e.g., escrow extend request)

### Selectors (`selectors.ts`)

Pure functions that compute derived state over a bundle:

```ts
escrowReleased(b: OrderBundle): number
escrowRefunded(b: OrderBundle): number
escrowRemaining(b: OrderBundle): number  // A1 - released - refunded
journeyPct(b: OrderBundle): number        // % of phases completed
gateReason(b: OrderBundle, step: JourneyStep): string | null  // null = can advance
customsApplies(b: OrderBundle): boolean   // INTERNATIONAL || WHL testing
mappedForOrderLine(b: OrderBundle, line): number
unmappedForOrderLine(b: OrderBundle, line): number
sourcedForClientLine(clientPoNo, clientLineMpn): number
deliveryWork(o: OrdersMap): DeliveryQueue[]  // received but unallocated MPNs
allEscrow(o: OrdersMap): EscrowSummary[]
kpis(o: OrdersMap): KPIs
```

## Entity Models

### ClientPO
```ts
interface ClientPO {
  id: string;
  clientPoNo: string;        // "BEL/26-27/PO/0042"
  buyer: Party;              // client company
  lines: ClientLine[];       // MPN, qty, unitPrice
  deliveryAddress: Address;
  terms: PoTerms;            // deliveryTerms, testingTerms, paymentMethod
  status: "DRAFT" | "ORDERED" | "CANCELLED";
  createdAt: Date;
}
```

### SupplierPO
```ts
interface SupplierPO {
  id: string;
  poNo: string;              // "SPO-2026-0221"
  supplier: Party;           // supplier company (China, SG, etc.)
  lines: SupplierLine[];     // MPN, qty, buyUnitPrice, references to client lines
  terms: PoTerms;            // paymentMethod, creditDays, incoterm, destinationPort, testingTerms
  creditDays?: number;       // 30, 60, 90 (if paymentMode = CREDIT)
  termsConditions?: string[]; // e.g., ["genuine", "datecode", "warranty"]
  relabelCost?: number;      // cost to relabel at hub
  orderId?: string;          // set when Order is created from this PO
  status: "DRAFT" | "ORDERED" | "CANCELLED";
  createdAt: Date;
}
```

### OrderBundle (The Workhorse)
```ts
interface OrderBundle {
  id: string;
  orderNo: string;           // "ORD-2026-00314"
  tradeType: "DOMESTIC" | "INTERNATIONAL";
  buyer: Party;              // real client (from Client PO)
  supplier: Party;           // (from Supplier PO)
  maskingEntity: Party;      // Sharpbuy
  
  // Commerce
  lines: OrderLine[];
  currency: string;          // "USD", "INR", etc.
  buyTotal: number;          // sum of buy prices
  sellTotal: number;         // sum of client prices
  
  // Terms & Compliance
  terms: PoTerms;
  creditDays?: number;
  termsConditions?: string[]; // supplier T&Cs
  relabelCost?: number;
  hubAddress: Address;       // 1Buy inbound location
  buyerAddress: Address;     // client outbound location
  
  // Journey & Gates
  journey: JourneyStep[];    // 9 phases, each with status + guard
  status: OrderStatus;       // DRAFT → ACTIVE → CLOSED
  
  // Testing
  lots: Lot[];               // per-line samples (PASS/FAIL/MAYBE)
  
  // Escrow (if payment mode = ESCROW)
  escrow?: {
    provider: "HKIN";
    materialAmount: number;  // A1
    chargesAmount: number;   // A2 (2% of A1)
    bankingCharges: number;  // wire/FX fees
    releaseTrigger: string;  // "Per T&C + lab PASS" or "Upon lab PASS"
    expiryDate: Date;
    extensions: EscrowExtension[];
    status: EscrowStatus;
    events: EscrowEvent[];   // FUND/RELEASE/REFUND/HOLD
  };
  
  // Movement
  shipments: Shipment[];     // INBOUND (supplier→hub) + OUTBOUND (hub→client)
  customs: CustomsRecord[];  // ICEGATE BOE filings
  deliveries: Delivery[];    // allocations to client lines
  
  // Allocations (N:N)
  sourcingAllocations: SourcingAllocation[]; // client line ← qty from this order
  
  // Finance
  payments: Payment[];       // client→1buy, 1buy→supplier
  approvals: Approval[];     // PO review, relabel, delivery sign-off
  documents: Document[];     // invoices, BOE, e-invoice, PoD
  
  // Audit
  events: OrderEvent[];      // state changes + decisions
  createdAt: Date;
}
```

## Integration Subsystems (`src/integrations/`)

### Mock Client (`mock-client.ts`)
```ts
export async function mockCall<T>(
  name: string,
  latencyMs: number,
  fn: () => T
): Promise<T>
```
- Injects latency (simulates network delay)
- Chaos toggle: ~30% of calls fail with random error
- All calls logged to integration log

### HKIN Escrow (`escrow-hkin.ts`)
```ts
interface EscrowAccount {
  escrowRef: string;
  status: "OPEN" | "FUNDED" | "RELEASED" | "REFUNDED";
  materialAmount: number;
  chargesAmount: number;
  bankingCharges: number;
  superInvoiceTotal: number;
  expiryDate: Date;
}

// Adapters
hkinOpen(orderId, amount, chargesAmount, bankingCharges): Promise<EscrowAccount>
hkinFund(escrowRef, totalAmount): Promise<void>
hkinRelease(escrowRef, amount): Promise<void>
hkinRefund(escrowRef, amount): Promise<void>
hkinRequestExtension(escrowRef, reason, newDate): Promise<{ status: "APPROVED" | "DECLINED", newExpiry }>
```

### ICEGATE Customs (`customs-icegate.ts`)
```ts
interface CustomsRecord {
  beNo: string;              // Bill of Entry number
  icegateRef: string;        // ICEGATE reference
  totalDuty: number;
  totalTax: number;
  status: "PENDING" | "CLEARED" | "REFUSED";
}

icegateFileBoe(shipmentNo, hs codes, values): Promise<CustomsRecord>
icegateCheckStatus(icegateRef): Promise<CustomsRecord>
```

### WHL Lab (`lab-whl.ts`)
```ts
interface LabSample {
  sampleId: string;
  mpn: string;
  testStatus: "PENDING" | "PASS" | "FAIL";
  reportUrl?: string;
}

whlSubmitSample(mpn, qty, labLocation): Promise<LabSample>
whlGetReport(sampleId): Promise<{ testStatus, reportUrl, issuesIfAny }>
```

### Logistics (`logistics.ts`)
```ts
interface TrackingCheckpoint {
  timestamp: Date;
  location: string;
  status: "PICKED_UP" | "IN_TRANSIT" | "AT_CUSTOMS" | "ARRIVED" | "DELIVERED";
}

bookShipment(carrier, origin, destination): Promise<{ awb, estimatedDelivery }>
getTracking(awb): Promise<{ checkpoints, currentStatus, lastLocation }>
```

### Banking (`banking.ts`)
```ts
interface WireTransfer {
  txnId: string;
  from: string;
  to: string;
  amount: number;
  status: "INITIATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

wireTransfer(from, to, amount, currency, reference): Promise<WireTransfer>
```

### E-Invoice (`einvoice-irp.ts`)
```ts
interface EInvoice {
  irn: string;
  qrCode: string;
  status: "GENERATED" | "CANCELLED";
}

generateEInvoice(invoiceData): Promise<EInvoice>
```

### Doc Extract (`doc-extract.ts`)
```ts
interface ExtractedFields {
  vendorName: string;
  invoiceNo: string;
  amount: number;
  date: Date;
  hsCode?: string;
}

extractFromPdf(pdfBuffer): Promise<ExtractedFields>
```

## State Transitions & Guards

### Journey Phases (Order lifecycle)

```
KICKOFF (manual gate)
  └─ User: Supplier ACKs PO + sends PI
     Guard: Manual approval required

PAYMENT
  └─ If ESCROW mode: Fund escrow
     If ADVANCE mode: Collect from client first
     Guard: escrow FUNDED OR client PAID

TESTING
  └─ If any line has testing mode: Submit to WHL or supplier
     Guard: All testing MPNs have PASS lots

EXPORT
  └─ Supplier ships goods (INBOUND shipment created)
     Guard: Shipment has departed origin

IMPORT
  └─ Goods in transit to 1Buy hub
     Guard: INBOUND shipment arrived

CUSTOMS
  └─ If international or WHL: File ICEGATE BOE
     Guard: icegateRef present

RELABEL
  └─ 1Buy receives, inspects, relabels goods
     Guard: Manual warehouse sign-off

DELIVERY
  └─ Map received goods to client lines; create OUTBOUND shipment
     Guard: All lines allocated + shipment ready

CLOSE
  └─ Final approvals + sign-off
     Guard: All approvals APPROVED
```

### Release Escrow Guard (Critical!)

```ts
export function canReleaseEscrow(b: OrderBundle): string | null {
  if (!b.escrow) return "No escrow on this order";
  if (b.escrow.status !== "FUNDED") return "Escrow not funded yet";
  if (escrowRemaining(b) <= 0) return "No funds remaining to release";
  
  // If T&Cs exist, require a PASS lot
  if (b.termsConditions?.length > 0) {
    if (!b.lots.some(l => l.testStatus === "PASS")) {
      return "Per T&C, must have a PASS lot before release";
    }
  } else {
    // If no T&Cs, check if this order has testable lines
    const needsTesting = b.lines.some(l => l.testingMode !== "NONE");
    if (needsTesting && !b.lots.some(l => l.testStatus === "PASS")) {
      return "All testable lines must have PASS before release";
    }
  }
  
  return null; // can release
}
```

## Zustand Persistence & Hydration

```ts
const store = create<State>()(
  persist(
    immer((set) => ({ /* actions */ })),
    {
      name: "store",
      merge: (persisted, current) => {
        // Custom merge logic to handle schema evolution
        // (e.g., new fields added in an update)
        return {
          ...current,
          ...persisted,
          clientPos: persisted.clientPos || current.clientPos,
          // etc.
        };
      }
    }
  )
);
```

**Persistence notes:**
- All state is stored in `localStorage` under key `"store"`
- On app reload, Zustand re-hydrates from localStorage
- Schema migration: `merge` function handles version mismatches
- No versioning field in POC; if schema breaks, clear localStorage + Reset Demo

## Component Hierarchy

```
app/layout.tsx (root, providers)
  ├── QueryClientProvider
  ├── ThemeProvider
  ├── ErrorBoundary
  └── app/(auth)/ or app/fulfilment/(dashboard)/
      ├── Header
      ├── AppSidebar
      └── Page (orders/, client-pos/, etc.)
          └── Workspace / Listing / Board
              └── Modals (fund-escrow, allocate-delivery, etc.)
              └── Tabs (overview, testing, escrow, etc.)
              └── DataTables (with useDataTable hook)
```

## Performance Considerations

- **Selectors:** Pure functions, memoized by Zustand (only recompute when state changes)
- **DataTables:** TanStack React Table with virtualization for large datasets
- **Modals:** Lazy-loaded (Dialog only renders when open)
- **Integrations:** Fire-and-forget with call logging; no blocking waits
- **localStorage:** ~5MB limit (POC uses <1MB); no issue with seed data

## Testing & Debugging

### Integration Log
- Every mock API call is logged with:
  - `timestamp`
  - `endpoint` (e.g., "HKIN fund")
  - `requestPayload`
  - `responsePayload` or `error`
  - `latencyMs`
- Rendered on `/fulfilment/integrations` board
- Can be cleared or exported for audit

### Chaos Toggle
- On Integrations board, toggle "Chaos Mode"
- When ON: ~30% of mock calls fail with random error
- Use to test error handling + resilience

### Reset Demo
- Button in dashboard header: "↺ Reset demo"
- Clears localStorage + reloads seed data (fixtures)
- Useful for testing workflows from a clean state

## Deployment Model (Future)

Currently: POC (no deployment). When moving to production:

1. **Backend separation:** Move stores → REST API + database
2. **Real auth:** Replace mock user with OAuth/JWT
3. **Real integrations:** Replace mock adapters → actual HKIN, ICEGATE, WHL APIs
4. **Offline-first:** Keep Zustand + localStorage for local draft state; sync on network
5. **Real-time:** Replace mock Socket.IO → actual WebSocket for live shipment tracking

---

## Security Notes (POC)

- **No authentication:** Mock user is hardcoded
- **No authorization:** All personas see all data (future: RBAC)
- **No encryption:** localStorage is plaintext (POC only)
- **No input validation:** Forms accept any input (future: Zod validation)
- **No CORS:** All APIs are local (mock)

For production, add:
- JWT auth + refresh tokens
- RBAC checks in store actions
- Zod schema validation on inputs
- HTTPS + secure cookies
- CSP headers

---

## Directory Reference

| Path | Purpose |
|------|---------|
| `src/app/fulfilment/` | Next.js route pages |
| `src/components/` | React components (UI + order workspace) |
| `src/store/` | Zustand stores + selectors |
| `src/integrations/` | Mock external APIs |
| `src/types/index.ts` | Central type definitions |
| `src/data/` | Enums + fixtures |
| `src/lib/` | Utils (money, fx, address formatting) |
| `docs/demo/` | Demo flow + walkthrough |
