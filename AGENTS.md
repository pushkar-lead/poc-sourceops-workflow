# AGENTS.md — Claude Agent Configurations

Custom agent definitions and Claude Code super-powers guidance for poc-sourceops-workflow.

---

## Super-Powers Guidance

### When to Use Agents

Use the **Agent** tool to parallelize independent research or validation tasks:

1. **Code review** — Review implementation against ARCHITECTURE.md / RULES.md (spawns review agent)
2. **Parallel exploration** — Search multiple areas of the codebase at once (spawns Explore agents)
3. **Research** — Investigate cross-cutting concerns (e.g., "all places escrow is used")
4. **Validation** — Verify that a completed feature matches the spec

**Do NOT use agents for:**
- Single-file edits (use Edit directly)
- Straightforward refactoring (direct approach)
- Reading comprehension (Read tool is faster)

---

## Workflow Definitions

### Workflow: `adversarial-escrow-review`

**Purpose:** Review escrow math and release/refund logic for correctness + edge cases.

**When to use:** After implementing changes to `fundEscrow()`, `releaseEscrow()`, `refundEscrow()`, or `requestEscrowExtension()`.

**Agents spawned (in parallel):**
1. **Escrow math reviewer** — Check A1/A2/banking caps, netting logic, terminal guards
2. **Release guard reviewer** — Verify `canReleaseEscrow()` catches all edge cases
3. **Refund logic reviewer** — Confirm refunds don't over-spend or bypass guards
4. **Extension reviewer** — Validate optimistic state + rollback + netting logic
5. **Integration reviewer** — Check HKIN adapter calls + error handling

**Input:** Code snippet (store.ts escrow actions + hkinRequestExtension adapter)

**Output:** Findings (bugs, recommendations), confidence scores, verified status

**Example run:**
```
/agent
Prompt: "Review the escrow implementation in src/store/store.ts and src/integrations/escrow-hkin.ts for:
1. Correct A1/A2/banking cap math
2. Terminal guards (REFUNDED blocks release/refund)
3. Netting logic prevents double-spend
4. Optimistic state rollback on failure
Use an adversarial approach — try to break the logic."
```

---

### Workflow: `data-flow-trace`

**Purpose:** Trace a specific user action (e.g., "fund escrow") from UI form → store action → integration call → state update → UI render.

**When to use:** When debugging unexpected behavior or validating a new feature's complete flow.

**Agents spawned (in parallel):**
1. **UI layer** — Find the form/modal that triggers the action
2. **Store layer** — Trace the action in store.ts, identify guards + mutations
3. **Integration layer** — Find the mock adapter call + logging
4. **Selector layer** — Check which selectors update as a result
5. **Render layer** — Verify UI components respond to the state change

**Input:** Action name (e.g., "fundEscrow") + expected behavior

**Output:** Complete trace (files + line numbers), identifies breaks/gaps

**Example run:**
```
/agent
Prompt: "Trace the 'fundEscrow' action from start to finish:
1. What UI form triggers it? (file + lines)
2. What store action does it call? (file + lines)
3. What guard checks happen?
4. What integration call is made? (file + function name)
5. How is the state updated? (file + mutations)
6. What selectors react to the change?
7. Which components re-render?
Provide file:line references for each."
```

---

### Workflow: `gate-logic-audit`

**Purpose:** Audit all journey gates to ensure:
- Every gate has explicit guards in `gateReason()`
- No gate can be bypassed
- Order of gates is correct (e.g., PAYMENT before TESTING)
- Guard conditions match business rules from DOMAIN.md

**When to use:** Before a demo or sign-off; after adding a new phase.

**Agents spawned (in parallel):**
1. **Journey phases** — List all 9 phases in order
2. **Gate implementations** — Find guard code in selectors.ts for each gate
3. **Guard completeness** — Check for missing or weak guards
4. **Phase ordering** — Verify dependencies (e.g., can't skip TESTING if lines need it)

**Output:** Audit report (all gates documented, gaps identified)

---

### Workflow: `integration-completeness`

**Purpose:** Verify all mock integrations are wired up correctly.

**Checklist:**
- [ ] Adapter function exists in `integrations/{domain}.ts`
- [ ] Called from store action
- [ ] Result logged to integration log
- [ ] Error handling + rollback in place
- [ ] Chaos toggle tested

**When to use:** After adding a new integration (e.g., new banking service).

---

## Agent Rules (Next.js 16)

⚠️  **Next.js 16 has breaking changes from your training data.**

Before writing code:
1. Check `node_modules/next/dist/docs/` for API changes
2. Use the **App Router** (not Pages Router)
3. **Server Components by default** (add `'use client'` only when needed)
4. **No `getStaticProps` / `getServerSideProps`** (replaced by direct async in Server Components)
5. **Middleware** at `src/proxy.ts` (not `_middleware.ts`)

Common pitfalls:
- ❌ Trying to use `pages/` directory (removed, use `app/` instead)
- ❌ Importing hooks in Server Components (use `'use client'` wrapper)
- ❌ Exporting `config` objects from routes (now `route.ts` handlers)

---

## Code Review Agent (superpowers:code-reviewer)

Invoke this agent when a major feature is complete.

**When to use:**
- After implementing a new modal
- After modifying escrow logic
- After adding a new journey phase
- After integrating a new external API

**Example:**
```
I've finished the ExtendEscrowModal implementation per the spec.
Let me use code-reviewer to validate it against ARCHITECTURE.md + RULES.md.
```

Agent will check:
- Type safety
- Zustand patterns
- Error handling
- UI/UX consistency
- Edge cases

---

## Explore Agent (Explore)

Fast read-only searches for patterns, symbol definitions, or file organization.

**Examples:**

Find all places where `escrowRemaining` is used:
```
/agent subagent_type=Explore
Prompt: "Grep for all uses of 'escrowRemaining' in the codebase. 
List file:line + surrounding context. Is it used only in selectors, or also in components?"
```

Find all release guards:
```
/agent subagent_type=Explore
Prompt: "Find all places where we check 'canReleaseEscrow' or similar.
List each gate check + the action it guards."
```

Find all mock adapters:
```
/agent subagent_type=Explore
Prompt: "List all files in src/integrations/ that export mock adapters.
For each, show the main exported function(s) + mock latency range."
```

---

## General-Purpose Agent (general-purpose)

Use for multi-step research or implementation tasks.

**Examples:**

Refactor a complex function:
```
/agent subagent_type=general-purpose
Prompt: "Refactor gateReason() in src/store/selectors.ts to be more readable.
Current approach: long if-chain. Proposal: switch statement + helper functions.
Implement the refactor, keeping behavior identical. Run tsc + lint after."
```

Add a new feature from spec:
```
/agent subagent_type=general-purpose
Prompt: "Implement the ExtendEscrowModal per ARCHITECTURE.md section 'Escrow Extend Mechanics'.
Files to modify: src/components/order/modals.tsx, src/store/store.ts, src/integrations/escrow-hkin.ts.
Steps: 1. Add hkinRequestExtension adapter, 2. Add store action + guard, 3. Add modal UI, 4. Wire into EscrowTab.
Verify with manual E2E."
```

---

## Workflow Examples (Real Scenarios)

### Scenario 1: Add "Reship" Feature
**Goal:** Allow re-shipping goods if first attempt failed.

**Agents to spawn (in parallel):**
1. **Domain research** — Check DOMAIN.md: is reship covered? What's the business rule?
2. **Type definition** — Should `Shipment` have a `status: "FAILED"`? Add to types.
3. **Store action** — Implement `reshopShipment(orderId, shipmentId)` action.
4. **UI component** — Add "Reship" button to ShipmentsTab (render when status="FAILED").
5. **E2E test** — Manually trace: create shipment → mark failed → reship → verify.

### Scenario 2: Debug "Release Escrow" Not Working
**Goal:** Escrow balance shows remaining, but release button says "not allowed".

**Agents to spawn:**
1. **Gate logic** — Get the exact guard text from `gateReason()`.
2. **State snapshot** — Print the order bundle (escrow status, lots, payments).
3. **Selector calculation** — Run `escrowRemaining(bundle)` manually, show math.
4. **Component rendering** — Check the EscrowTab release button logic.
5. **Integration log** — Are there any failed integration calls?

**Likely causes:**
- No PASS lot (testing required but not done)
- Escrow status not FUNDED (payment not sent)
- `escrowRemaining = 0` (already released)
- Guard text misleading (fix RULES.md)

### Scenario 3: Validate Integration Completeness Before Demo
**Goal:** Ensure all external API calls are logged + visible on the Integrations board.

**Agents to spawn:**
1. **List all actions** — Find every store action that calls an integration.
2. **Check logging** — For each action, verify `logIntegrationCall()` is called.
3. **Check board display** — Render integrations board, verify entries appear.
4. **Test chaos** — Toggle chaos mode, confirm ~30% fail rate in the logs.

---

## Tips for Effective Agent Prompts

1. **Be specific** — "Check escrow" is vague; "Check that `escrowRemaining` nets both RELEASE and REFUND events" is clear.
2. **Provide context** — "We're implementing feature X per DOMAIN.md section Y" helps agents understand intent.
3. **Ask for deliverables** — "Provide file:line references for each change" ensures output is actionable.
4. **Set success criteria** — "Verify that manual E2E (Reset demo → fund → pass → release → shipment) completes without errors" is testable.
5. **Parallel where possible** — Split independent reviews across agents; they'll run in parallel.

---

## CI/CD & Automation (Future)

When this moves from POC to production:

1. **Pre-commit hooks** (via Husky):
   - `tsc --noEmit` (type check)
   - `next build` (build check)
   - `pnpm lint` (lint + format)

2. **CI pipeline** (GitHub Actions):
   - Run linter + type checker + build on every PR
   - Snapshot test Integrations board (visual regression)
   - Manual smoke tests (demo flow trace)

3. **Deploy gate** (manual):
   - Review checklist (RULES.md review checklist)
   - Sign-off from SC/Finance/Approver personas
   - Backwards-compatibility check (localStorage schema)

---

## FAQ

**Q: Can I use agents to write an entire feature?**
A: Yes, but break it into phases:
1. **Sketch phase** — Agent designs the approach (files + actions)
2. **Implement phase** — Agent writes the code (store + UI + integration)
3. **Review phase** — Code-reviewer agent validates (safety + correctness)
4. **Test phase** — You manually verify (E2E via UI)

**Q: How do I know when to spawn an agent?**
A: Use the rule from "When to Use Agents" above. If it's a one-off read or edit, don't use an agent. If it's parallel exploration or validation, spawn agents.

**Q: Can agents modify the codebase?**
A: Yes, if you give them Edit/Write permissions. They can:
- Add new files
- Modify existing files
- Run `pnpm lint:fix` to format
- Commit changes (with your approval)

**Q: What if an agent makes a mistake?**
A: Review its output before accepting. If wrong:
1. Use `git diff` to see what changed
2. Revert with `git checkout {file}`
3. Adjust the agent prompt + retry, or do it manually

---

## Resources

- **CLAUDE.md** — project setup + commands
- **DOMAIN.md** — business context + trade model
- **ARCHITECTURE.md** — system design + data flows
- **RULES.md** — coding conventions + do/don'ts
- **demos/demo-flow.md** — end-to-end walkthrough (use to test agents)
