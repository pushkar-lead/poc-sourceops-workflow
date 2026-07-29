# CLAUDE.md — poc-sourceops-workflow

Claude Code instructions for the internal 1Buy fulfilment-ops console POC.

## Project Summary

**poc-sourceops-workflow** is a Next.js 16 POC for 1Buy's masked back-to-back Mode-4 trade fulfilment console. It is **internal-only** — for SC/Finance/Approver/Mgmt personas. Clients & suppliers never log in.

The console picks up an **already-approved order** (PI in hand, sourcing done upstream) and runs it through a **gated fulfilment journey**: fund/escrow, per-line testing, shipping, customs, relabel, e-invoice, delivery, close. All external integrations are **mocks** (HKIN escrow, ICEGATE customs, WHL lab, logistics, banking, e-invoice, doc-extract) with a live call log for transparency.

**Key facts:**
- **Three entities:** Client PO (demand) → Supplier PO (our purchase) → Order (fulfilment).
- **Escrow math:** `escrowRemaining = A1 (material) − released − refunded` (only A1 releasable; banking charges affect display only).
- **State machine:** Journey gates enforce order (PAYMENT → TESTING → EXPORT → IMPORT → CUSTOMS → RELABEL → DELIVERY → CLOSE).
- **N:N sourcing:** one supplier PO serves multiple clients; one client line splits across supplier POs.
- **Per-line testing:** some MPNs need WHL, some self-test, some none; all testable lines must PASS before release.
- **Masked:** the order masks the buyer from the supplier (relabel at 1Buy hub = masking act).

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components) |
| Language | TypeScript 5.7 (strict mode) |
| UI | React 18.3, Shadcn/ui (New York), Radix UI |
| Styling | Tailwind CSS v4 with CSS custom properties |
| Client State | Zustand v5 (localStorage persistence) |
| Server State | TanStack React Query v5 (mock data only) |
| Data Tables | TanStack React Table v8 |
| Forms | React Hook Form 7 + Zod 3 |
| HTTP | Axios with interceptors (no auth; mock latency injection) |
| Charts | Recharts (mock data) |
| Icons | Lucide React |
| Notifications | Sonner (toast) |
| Mock Integration | in-memory adapters + integration call log |

## Commands

```bash
pnpm dev                    # Start dev server on http://localhost:3000
pnpm build                  # Production build
pnpm start                  # Start production server
pnpm lint                   # Run ESLint
pnpm lint:fix               # Fix lint issues + Prettier
```

No test runner configured (manual testing via UI + integration logs).

## Directory Structure

```
src/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Auth routes
│   ├── fulfilment/              # Dashboard + operations
│   │   ├── (dashboard)/         # Protected pages
│   │   │   ├── page.tsx         # Main dashboard
│   │   │   ├── approvals/       # Approval queue
│   │   │   ├── client-pos/      # Client PO management
│   │   │   ├── orders/          # Order listing + workspace
│   │   │   ├── testing/         # Lab testing boards
│   │   │   ├── logistics/       # Shipping & tracking
│   │   │   ├── warehouse/       # Inbound/relabel
│   │   │   ├── delivery/        # Outbound dispatch
│   │   │   ├── payments/        # Payment records
│   │   │   ├── escrow/          # Escrow dashboard
│   │   │   ├── supplier-pos/    # Supplier PO creation
│   │   │   ├── integrations/    # API call log + chaos toggle
│   │   │   └── guide/           # User guide + demo walkthrough
│   ├── layout.tsx               # Root layout + providers
│   ├── globals.css              # Global Tailwind + theme vars
│   └── theme.css                # Theme customizations
│
├── components/
│   ├── ui/                      # Shadcn/Radix UI primitives
│   ├── layout/                  # AppSidebar, Header, Breadcrumbs
│   ├── order/                   # order-workspace.tsx (13 tabs) + modals
│   └── error-boundary.tsx       # Global error boundary
│
├── store/                       # Zustand stores (localStorage-persisted)
│   ├── store.ts                 # Main orchestrator (create/advance/integrate)
│   ├── selectors.ts             # Computed state (gates, journey%, allocation math)
│   └── (integration-log.ts)     # Call log persistence
│
├── integrations/                # Mock external APIs
│   ├── mock-client.ts           # Latency + chaos wrapper
│   ├── escrow-hkin.ts           # HKIN escrow (fund/release/refund/extend)
│   ├── customs-icegate.ts       # ICEGATE BOE filing
│   ├── lab-whl.ts               # WHL testing lab
│   ├── logistics.ts             # Carrier booking + tracking (with away-country)
│   ├── banking.ts               # Wire transfer mock
│   ├── einvoice-irp.ts          # GST e-invoice
│   ├── doc-extract.ts           # Document parser
│   └── integration-log.ts        # Live call logger
│
├── lib/
│   ├── utils.ts                 # money(), qtyfmt(), cn(), fmtAddress()
│   ├── fx.ts                    # FX + landed-cost math
│   └── (utilities)
│
├── data/
│   ├── enums.ts                 # Currencies, incoterms, payment modes, standard T&Cs, statusTone()
│   ├── fixtures.ts              # Seed data (demo POs + hero escrow)
│   └── (reference data)
│
├── types/
│   └── index.ts                 # Central types (Order, Escrow, SupplierPO, Shipment, etc.)
│
└── constants/
    └── api-endpoints.ts         # Mock endpoint URLs
```

## Key Patterns

### Escrow Math (Critical!)
```
A1 (materialAmount)   ← supplier PO buy-total (only this is releasable)
A2 (chargesAmount)    ← 2% of A1
Banking charges       ← wire/FX fees (affects super-invoice, NOT release cap)
Fees                  ← fixed 450

SuperInvoiceTotal = A1 + A2 + banking + 450
EscrowRemaining = max(0, A1 − released − refunded)  ← RELEASE CAP

Key point: release is ALWAYS capped at A1, never the full super-invoice.
```

### Gate Guards (Journey Phases)
1. **KICKOFF** → manual (Supplier ACK + PI)
2. **PAYMENT** → escrow FUNDED (if ESCROW) OR client PAID (if ADVANCE)
3. **TESTING** → all per-line testing MPNs have PASS (if testing required)
4. **EXPORT** → supplier-side export clearance done
5. **IMPORT** → inbound shipment arrived
6. **CUSTOMS** → ICEGATE BOE filed + duty assessed
7. **RELABEL** → goods received + relabelled to 1Buy
8. **DELIVERY** → e-invoice generated; all lines mapped + shipment allocated
9. **CLOSE** → all approvals met

### N:N Sourcing & Allocations
- One **Supplier PO** can serve multiple **Client POs** (lines reference client PO no. + client line MPN)
- One **Client PO line** can be split across multiple **Supplier POs** (sourcing allocations track qty per supplier per client line)
- **Order** tracks sourcing allocations + per-line testing mode (NONE/SUPPLIER_SELF/WHL)
- **Delivery** queues only show unallocated received MPNs; allocate = map order line to client line

### Zustand Store Pattern
```ts
// Main store (src/store/store.ts) with immer + persist
const store = create<State>()(
  persist(
    immer((set) => ({
      createClientPo: (payload) => set((s) => { s.clientPos.push(...) }),
      createSupplierPo: (payload) => set((s) => { s.supplierPos.push(...) }),
      createOrderFromSupplierPo: (spo) => set((s) => { s.orders[id] = scaffold(...) }),
      fundEscrow: (orderId, amount, bankingCharges) => set((s) => {
        const b = s.orders[orderId];
        b.escrow.status = "FUNDED";
        b.escrow.events.push({ type: "FUND", amount, ... });
      }),
      advanceStep: (orderId, phase) => set((s) => {
        const step = s.orders[orderId].journey.find(j => j.phase === phase);
        if (gateReason(...)) return; // guard
        step.status = "DONE";
      }),
    })),
    { name: "store", merge: customMerge }
  )
);

// Selectors (src/store/selectors.ts) — pure functions over state
export const escrowRemaining = (b: OrderBundle) =>
  Math.max(0, (b.escrow?.materialAmount ?? 0) - released - refunded);
export const gateReason = (b: OrderBundle, step: JourneyStep): string | null => {
  // returns null = can advance, string = reason blocked
};
```

## Naming Conventions

- **Files:** `kebab-case.tsx` / `kebab-case.ts`
- **Components:** `PascalCase`
- **Hooks:** `use-kebab-case` or `useCamelCase`
- **Stores:** `{domain}-store.ts`
- **Types:** `index.ts` (centralized, not per-domain)
- **Constants:** `SCREAMING_SNAKE_CASE`

## Code Style

- **Prettier:** single quotes, 2-space indent, LF endings, no trailing commas
- **ESLint:** `@typescript-eslint/no-explicit-any` is OFF; `no-console` WARN; `no-unused-vars` WARN
- **TypeScript:** strict mode; no `any` unless unavoidable
- **'use client':** for interactive components; Server Components for routes
- **Tailwind v4:** CSS custom properties via globals.css / theme.css

## Known Limitations & Caveats

- **No backend:** all data in-memory + localStorage; resets on page reload
- **No tests:** manual testing via UI
- **Mocks only:** HKIN, ICEGATE, WHL, logistics, banking, e-invoice, doc-extract are in-memory with latency injection
- **Chaos toggle:** on Integrations board; ~30% of mock calls fail when enabled (for resilience testing)
- **No real auth:** mock user auto-loaded (structure in place for future backend)

## Recent Fixes

- **Escrow cap:** `escrowRemaining` nets both released AND refunded (prevent double-spend)
- **Extend request:** optimistic REQUESTED state rolls back on failure (user can retry)
- **Ledger tones:** FUND/RELEASE/REFUND now color correctly (amber/ok/bad)
- **Terminal guards:** release blocked when REFUNDED; refund blocked when already REFUNDED

## For New Developers

1. **Read DOMAIN.md** — business context (masked trade, 1Buy masking, 3-entity model)
2. **Read ARCHITECTURE.md** — system design, data flows, subsystems
3. **Read RULES.md** — coding conventions, patterns, DO/DON'Ts
4. **Run `pnpm dev`** → http://localhost:3000/fulfilment
5. **Click "↺ Reset demo"** to reload seed data
6. **Open Integrations board** in a second tab to watch mock API calls in real-time
7. **Read `docs/demo/demo-flow.md`** for a guided walkthrough of a complete order

## GitHub

- **Repo:** https://github.com/pushkar-lead/poc-sourceops-workflow
- **Branch:** main
- **Visibility:** private
- **Status:** POC (no deployment pipeline)
