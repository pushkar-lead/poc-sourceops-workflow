# Documentation Index — poc-sourceops-workflow

Complete guide to the project documentation. Start here to navigate the docs.

## Files Overview

### 1. **[CLAUDE.md](CLAUDE.md)** — Claude Code Guidance
**Purpose:** Instructions for working with this project in Claude Code  
**Read first if:** You're a developer using Claude Code for the first time on this project  
**Key sections:**
- Project summary (what the POC does)
- Tech stack overview
- Directory structure
- Key patterns (stores, escrow math, gates)
- Naming conventions & code style
- Known caveats & recent fixes
- Getting started guide for new developers

**Length:** ~7 min read | 224 lines

---

### 2. **[DOMAIN.md](DOMAIN.md)** — Business Context
**Purpose:** Deep dive into the business domain (masked trade, 1Buy, escrow mechanics)  
**Read first if:** You're new to 1Buy's trade model or need business context  
**Key sections:**
- What is Mode-4 trade? (back-to-back supply chain masking)
- Three-entity model (Client PO → Supplier PO → Order)
- The masking act (relabeling at 1Buy hub)
- Escrow lifecycle & math (A1/A2/banking/fees)
- Per-line testing modes (NONE / SUPPLIER_SELF / WHL)
- Trade types (domestic vs international)
- Personas & typical order flow
- Key constraints & success metrics

**Length:** ~12 min read | 261 lines

---

### 3. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Technical Design
**Purpose:** System architecture, data flows, entity models, and subsystems  
**Read first if:** You need to understand how the system works technically  
**Key sections:**
- High-level architecture (React → Zustand → Integrations)
- Data flow (user input → state → render)
- Store architecture (main store.ts + selectors.ts + integration log)
- Entity models (ClientPO, SupplierPO, OrderBundle)
- Integration subsystems (HKIN, ICEGATE, WHL, logistics, banking, e-invoice, doc-extract)
- State transitions & guards (9 journey phases + gate logic)
- Zustand persistence & hydration
- Component hierarchy
- Performance considerations
- Testing & debugging (integration log, chaos toggle, reset demo)
- Deployment model (future roadmap)
- Directory reference

**Length:** ~20 min read | 486 lines

---

### 4. **[RULES.md](RULES.md)** — Coding Standards
**Purpose:** Conventions, patterns, and best practices for writing code in this project  
**Read first if:** You're writing code and want to follow project conventions  
**Key sections:**
- Golden rule (clarity, simplicity, speed)
- TypeScript & code style (types, naming, formatting, comments)
- Zustand store patterns (actions, guards, async, selectors)
- React patterns (components, props, hooks)
- Form patterns (React Hook Form + Zod)
- Data table patterns (TanStack React Table)
- Modal & sheet patterns (controlled state)
- Styling & Tailwind
- Integration patterns (mock APIs, latency, logging)
- DO list (10 guardrails to enforce)
- DON'T list (10 anti-patterns to avoid)
- Error handling
- File organization
- Git & commits
- Testing approach
- Performance notes
- Security (POC vs production)
- Documentation expectations
- Review checklist

**Length:** ~18 min read | 540 lines

---

### 5. **[AGENTS.md](AGENTS.md)** — Agent Configurations
**Purpose:** Custom agent definitions and Claude Code super-powers guidance  
**Read first if:** You want to use Claude Code agents for this project  
**Key sections:**
- When to use agents (parallelization, validation, exploration)
- Workflow definitions (escrow-review, data-flow-trace, gate-logic-audit, integration-completeness)
- Agent rules (Next.js 16 breaking changes, common pitfalls)
- Code review agent (superpowers:code-reviewer)
- Explore agent (pattern searches, symbol lookups)
- General-purpose agent (multi-step tasks)
- Real workflow examples (reship feature, debug release escrow, pre-demo validation)
- Tips for effective prompts
- CI/CD & automation (future)
- FAQ
- Resources

**Length:** ~12 min read | 325 lines

---

## Reading Order

### For First-Time Setup
1. **[README.md](README.md)** — Quick start (how to run the app)
2. **[CLAUDE.md](CLAUDE.md)** — Project overview + tech stack
3. **[DOMAIN.md](DOMAIN.md)** — Understand the business problem
4. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Understand the system design

### For Development
1. **[RULES.md](RULES.md)** — Coding conventions (bookmark this)
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Reference for patterns
3. **[AGENTS.md](AGENTS.md)** — Use agents for complex tasks

### For Code Review / Validation
1. **[RULES.md](RULES.md)** — Review checklist at end
2. **[AGENTS.md](AGENTS.md)** — Spawn code-reviewer agent
3. **[docs/demo/demo-flow.md](docs/demo/demo-flow.md)** — Manual E2E walkthrough

---

## Quick Reference

### Most Common Tasks

**"I want to add a new feature"**
1. Check DOMAIN.md for business rules
2. Read ARCHITECTURE.md for data model
3. Follow RULES.md patterns while coding
4. Use `pnpm dev` to test locally
5. Spawn code-reviewer agent to validate

**"I need to debug something"**
1. Run `pnpm dev`
2. Open http://localhost:3000/fulfilment
3. Open Integrations board in second tab
4. Reproduce the issue, watch integration calls
5. Check store state (Zustand DevTools)

**"I'm stuck on escrow logic"**
1. Read DOMAIN.md section "Escrow: 1Buy's Credit Risk Mitigation"
2. Read ARCHITECTURE.md section "Escrow Math"
3. Read RULES.md section "Zustand Store Patterns" + "Integration Patterns"
4. Check src/store/store.ts + src/integrations/escrow-hkin.ts
5. Spawn adversarial-escrow-review workflow (AGENTS.md)

**"I want to reset the app"**
1. Click "↺ Reset demo" button in dashboard header
2. Clears localStorage + reloads seed data

---

## Documentation Metadata

| File | Lines | Audience | Effort |
|------|-------|----------|--------|
| CLAUDE.md | 224 | Developers using Claude Code | 7 min |
| DOMAIN.md | 261 | Anyone (biz + tech) | 12 min |
| ARCHITECTURE.md | 486 | Engineers | 20 min |
| RULES.md | 540 | Developers | 18 min |
| AGENTS.md | 325 | Claude Code users | 12 min |
| **Total** | **1,836** | All | **69 min** |

---

## Key Concepts (Glossary)

### Entities
- **Client PO** — The real buyer's purchase order (demand signal)
- **Supplier PO** — 1Buy's purchase order to a supplier (sourcing commitment)
- **Order** — Fulfillment journey from supplier to client (9 phases + gates)

### Finance
- **A1** — Material amount (only releasable part of escrow)
- **A2** — Escrow charges (~2% of A1)
- **Banking charges** — Wire/FX fees (affects displayed total, not release cap)
- **Escrow** — Funds held in escrow (HKIN provider) until delivery verified
- **Release trigger** — Condition that allows release (PASS lot + T&Cs agreed)

### Operations
- **Phase** — Stage of the order journey (KICKOFF, PAYMENT, TESTING, EXPORT, IMPORT, CUSTOMS, RELABEL, DELIVERY, CLOSE)
- **Gate** — Automatic guard that prevents advancing to next phase if conditions not met
- **Lot** — Test sample (per-line, PASS/FAIL/MAYBE status)
- **Testing mode** — NONE (no test), SUPPLIER_SELF (supplier CoA), WHL (lab in China)

### Trade Model
- **Mode-4 trade** — Back-to-back supply chain with masking
- **Masking entity** — 1Buy (Sharpbuy) hides real buyer from supplier
- **Relabel** — 1Buy removes supplier's label, applies its own (masking act)
- **Trade type** — DOMESTIC (India→India) or INTERNATIONAL (foreign→India)

---

## Support & Feedback

- **Code questions?** Check RULES.md or ask in PR comments
- **Business logic unclear?** Read DOMAIN.md sections or ask SC team
- **Architecture concerns?** Review ARCHITECTURE.md or spawn Explore agent
- **Agent workflows?** See AGENTS.md examples or ask in comments

---

## Last Updated

- **CLAUDE.md** — 2026-07-29
- **DOMAIN.md** — 2026-07-29
- **ARCHITECTURE.md** — 2026-07-29
- **RULES.md** — 2026-07-29
- **AGENTS.md** — 2026-07-29

See [CHANGELOG.md](CHANGELOG.md) (if present) for update history.
