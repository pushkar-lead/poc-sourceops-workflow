# 1Source Ops POC — UI/UX consistency pass

**Date:** 2026-07-28
**Status:** approved (design) → implementing

## Goal
Make the POC's pages consistent and easier to use. Headline: convert the multi-section
create forms (Client PO, Supplier PO) from stacked panels to a **tabbed** layout. Then a
**consistency sweep** across every page. Purely layout/consistency — no rebrand, no colour
system change, no route changes.

## Shared primitives (new, in `src/components/ui/primitives.tsx`)
- **`PageHeader`** — `{ title, description?, actions? }` → standard `h1` + muted description +
  right-aligned actions. Replaces the hand-rolled header `div` repeated across ~13 pages.
- **`FormTabBar`** — `{ tabs: {id,label,invalid?}[], active, onChange }` → tab bar reusing the
  polished active-tab style, with a **warning dot** on any tab that still has missing required
  fields (so a hidden tab can't silently block submit).
- **`StickyBar`** — sticky footer (`fixed bottom-0`, offset past the sidebar on desktop) for
  totals + the primary Create button + a "what's missing" hint.

## Create forms → tabs
- **Client PO `/new`**: Upload/Parse strip stays pinned on top; tabs =
  `Client & parties` · `PO terms` · `Demand lines`. Sticky footer: PO value + Create.
  Validity: parties invalid when no client name; lines invalid when no valid line.
- **Supplier PO `/new`**: tabs = `Supplier & terms` · `PO terms` · `Lines`.
  Sticky footer: Buy/Sell/Margin + Create. Validity: supplier name; ≥1 valid line & not over-sourced.

## Consistency sweep (all board/list/console pages)
Adopt `PageHeader`; uniform `space-y-5` rhythm; ensure each list has a real empty state;
right-align numeric columns; consistent pill usage; keep the workspace (already tabbed) as-is.

## Execution
1. Build the shared primitives + convert the two create forms (shared code → one hand).
2. Parallel workflow: one agent per remaining page applies the checklist to its own page file
   (pages are independent files → no edit conflicts), using `PageHeader`.
3. Verify `tsc` / `build` / `lint` once; fix any rough edges.

## Non-goals (YAGNI)
No visual rebrand, no design-token overhaul, no data/logic changes. No auto-commit.
