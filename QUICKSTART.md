# QUICKSTART — 5-Minute Orientation

Welcome to **poc-sourceops-workflow**, the 1Buy masked back-to-back Mode-4 trade fulfillment console POC.

## Get Running (2 min)

```bash
cd ~/Desktop/poc-sourceops-workflow
pnpm install        # first time only
pnpm dev            # starts on http://localhost:3000
```

Click on `/fulfilment` link in the console output. The dashboard appears.

## Understand the Domain (2 min)

The app models a **three-entity supply chain:**

```
Client (real buyer)
  ↓ orders from 1Buy (masked)
1Buy/Sharpbuy (masking entity)
  ↓ purchases from
Supplier (sees only Sharpbuy, not the client)
```

**Key flows:**
1. Create a **Client PO** (buyer demand)
2. Create a **Supplier PO** (our purchase, links client lines)
3. Create an **Order** (start the 9-phase fulfillment journey)
4. Fund **Escrow** (hold supplier payment until delivery confirmed)
5. Confirm **Testing** (WHL lab or supplier self-test)
6. **Release** Escrow (pay supplier after PASS)
7. Ship **Inbound** → **Customs** → **Relabel** → **Outbound**
8. Deliver to client (with 1Buy invoice, supplier identity hidden)

## Navigate Docs (1 min)

**Start here:**
- [DOCUMENTATION.md](DOCUMENTATION.md) — Master index + reading order

**By role:**
- **New dev (first time):** DOCUMENTATION.md → CLAUDE.md → DOMAIN.md → ARCHITECTURE.md
- **Active dev (daily):** RULES.md (bookmark it) + ARCHITECTURE.md (reference)
- **Team lead:** DOMAIN.md + SOP.md (governance)
- **Claude users:** AGENTS.md (workflows)

**Key files:**
- [RULES.md](RULES.md) — Coding standards (14 min, bookmark this)
- [DOMAIN.md](DOMAIN.md) — Business logic (12 min)
- [ARCHITECTURE.md](ARCHITECTURE.md) — Tech design (20 min)
- [SOP.md](SOP.md) — How to keep docs in sync with code (binding for all features)

## Try a Flow (2 min)

1. Dashboard → **Orders** tab
2. Click the green "ORD-2026-00314" (HERO_ESCROW demo)
3. Click **Overview** tab → see the order details (buyer, supplier, escrow state)
4. Click **Escrow** tab → see escrow status (should be FUNDED = $7013 held)
5. Click **Testing** tab → add a WHL lab sample for one MPN, mark as PASS
6. Back to **Escrow** → "Release Escrow" button appears
7. Click it → confirm amount → see integration call logged on Integrations board
8. Open **Integrations** tab in a second browser tab, toggle "Chaos Mode" (30% failures)
9. Try a release again → watch it fail or succeed randomly

## Key Concepts (1-minute cheat sheet)

| Term | Meaning |
|------|---------|
| **A1** | Material amount (only this is releasable from escrow) |
| **A2** | Escrow charges (~2% of A1) |
| **Gate** | Automatic guard that prevents moving to next phase if conditions unmet |
| **Phase** | Stage of fulfillment (PAYMENT, TESTING, CUSTOMS, RELABEL, DELIVERY, etc.) |
| **Testing mode** | NONE (no test), SUPPLIER_SELF (CoA), WHL (China lab) |
| **Lot** | Test sample (per-line, status = PASS/FAIL/MAYBE) |
| **Masking** | Relabel at 1Buy hub = remove supplier's label, apply 1Buy's |
| **Escrow** | Funds held until delivery confirmed (HKIN provider) |

## For Developers (How to Add a Feature)

See [SOP.md](SOP.md) "Quick Reference: Update Checklist by Feature Type" for exactly which docs to update when:
- Adding a **modal**? Update CLAUDE.md, ARCHITECTURE.md, RULES.md
- Adding an **integration**? Update ARCHITECTURE.md, RULES.md, AGENTS.md
- Adding a **journey phase**? Update DOMAIN.md, ARCHITECTURE.md, docs/flows/
- Adding a **store action**? Update ARCHITECTURE.md, RULES.md, docs/flows/
- Fixing a **bug**? Update ARCHITECTURE.md or RULES.md if it clarifies confusing logic

**Golden rule:** Commit code + docs together. No stale documentation.

## Chat with Claude Code

Use Claude Code to work on this project. Key super-powers:
- `/agent` — spawn research agents (use Explore type for codebase searches)
- `/agent subagent_type=code-reviewer` — review your implementation against plan + RULES.md
- See [AGENTS.md](AGENTS.md) for workflow examples (escrow-review, data-flow-trace, gate-logic-audit)

## Project Status

- **POC:** Internal prototype (no real backend, all mock integrations)
- **Stack:** Next.js 16, React 18, TypeScript, Zustand, Tailwind v4
- **Tests:** Manual (via UI + integration log). No test runner configured
- **Docs:** Complete (~2,600 lines). See [DOCUMENTATION.md](DOCUMENTATION.md)
- **GitHub:** https://github.com/pushkar-lead/poc-sourceops-workflow (private, main branch)

## Support

**Question? Check:**
1. [DOCUMENTATION.md](DOCUMENTATION.md) — Master index
2. [RULES.md](RULES.md) FAQ section
3. [ARCHITECTURE.md](ARCHITECTURE.md) for technical deep-dives
4. [SOP.md](SOP.md) for documentation/governance questions

**Found a problem?**
- Bug in code? Fix it + update ARCHITECTURE.md or RULES.md (if logic clarification needed)
- Doc is wrong? Fix it immediately (code is source of truth)
- Want to add a feature? Read SOP.md Part 1–2, then code + docs together

---

**Ready? Start with [DOCUMENTATION.md](DOCUMENTATION.md), then pick your role's reading path.** Enjoy!
