# 1Source Ops Panel — Phase-1 POC

Clickable, **front-end-only** prototype of the Mode-4 fulfilment Ops Panel. Purpose: get sign-off
on the **flow and UX** before any backend is built. **No backend, no real data** — everything is
typed dummy data in `src/data/`, and a few actions mutate local state (they reset on reload).

> Standalone project — intentionally separate from the `1data` repo. Once approved, the components
> and `types/` lift into the real `/1source/fulfilment` module. Spec: `~/Downloads/1Source/phase1-poc-plan.md`.

## Run
```bash
cd ~/Desktop/poc-sourceops-workflow
pnpm install        # first time only
pnpm dev            # → http://localhost:3000  (redirects to /fulfilment)
```
Optional native build scripts (`sharp`, `unrs-resolver`) are intentionally **not** built —
declared `allowBuilds: false` in `pnpm-workspace.yaml`; the app doesn't need them. Fallback if
`pnpm dev` ever balks: `./node_modules/.bin/next dev`.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · lucide-react. Mirrors the main
1Buy app so code transfers. Light/dark + persona (SC/Finance/Approver) switch in the header.

## What's in it
Three-entity model: **Client PO** (buyer demand) → **Supplier PO** (our purchase doc) → **Order** (fulfilment).
- **Dashboard** (`/fulfilment`) — KPIs + needs-attention + recent orders.
- **Client POs** (`/fulfilment/client-pos`, `…/new`) — buyer demand + live sourcing roll-up; **Source →** spins a Supplier PO.
- **Supplier POs** (`/fulfilment/supplier-pos`, `…/new`) — our POs to suppliers (linked or unlinked lines); **Create order →** starts fulfilment.
- **Orders** (`/fulfilment/orders`) — fulfilment list, each spun from a Supplier PO → click a row.
- **Order workspace** (`/fulfilment/orders/[id]`) — header + journey progress + **13 tabs**
  (Overview · Lines · Allocations · Journey · Testing · Escrow · Payments · Shipments · Customs · Delivery ·
  Documents · Events · Approvals). Order **ORD-2026-000148** is fully populated.
- **Queues** — Approvals · Payments · Testing (role work-surfaces).
- **Boards** — Escrow · Shipments · Delivery (cross-order roll-ups).

## Demo click-path (for the approval review)
**Client POs** → **Source →** on a line (or **New Client PO**) → **Supplier POs** → **Create order →** →
**Approvals** (approve the PO) → **Journey** (Advance to the fund gate) → **Escrow** (Fund, then set a lot
PASS on **Testing** → Release) → **Shipments / Customs / Delivery** (allocate to the client) → **Journey** (Close).
Or just open the seeded `ORD-2026-000148` to see a fully-populated order.

## State & logic (fully wired)
- **Zustand store** (`src/store/store.ts`) holds all entities, **persisted to localStorage** (survives reload;
  a **Reset demo** button in the header re-seeds). Selectors + allocation math in `src/store/selectors.ts`.
- **Every action is wired**: create order · advance / add journey step · add lot + PASS/FAIL/MAYBE ·
  fund / release / refund escrow · add payment + mark paid · create shipment (**remaining-qty guard**) ·
  file BOE (auto **duty** calc) · allocate delivery (**received-qty guard**) · record PoD · add event · upload doc · approve / reject.
- **Real client-side logic**: N:N allocation guards (can't ship or allocate beyond what's available),
  FX→USD roll-ups, duty/GST calc.
- Seed fixtures: `src/data/fixtures.ts`; types mirror `schema.json` (`src/types/index.ts`).

_Illustrative numbers; no real FX / GST / FEMA logic. Sourcing (RFQ→award) and all integrations are out of scope._
