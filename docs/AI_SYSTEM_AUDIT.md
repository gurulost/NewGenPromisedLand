# AI System Audit

_Date_: 2025-01-07  
_Author_: Codex Agent (GPT-5)

This audit captures the current state of the AI stack in **NewGenPromisedLand**, summarises outstanding risks, and provides continuity notes for future contributors.

## Architectural Snapshot
- **Strategic Layer** (`shared/ai/aiEngine.ts`) – `AIStrategicPlan` exists but only partially informs downstream logic. Budgeting, goal queues, and reserved stars are calculated yet not consistently consumed by decision evaluators.
- **Tactical Layer** (`shared/ai/aiTacticalEngine.ts`) – Generates influence maps and targets, though combat odds and damage estimates still rely on placeholder heuristics.
- **Personality Engine** (`shared/ai/aiFactionPersonality.ts`) – Provides faction-specific traits and dynamic moods; references such as `getTechPreferenceWeight` are not implemented, muting some flavour hooks.
- **Turn Manager** (`shared/ai/aiTurnManager.ts`) – Sequencing stubs remain (empty logging branches, missing pacing feedback). Construction decisions may omit `constructionCategory` without downstream guardrails.
- **Data Plumbing** – AI still references hard-coded building and ability lists; these diverge from shared data definitions (`STRUCTURE_DEFINITIONS`, ability catalogue), leading to invalid or redundant decisions.

## Key Findings

1. **Strategic Planning & Budgeting**
   - `recalculateStrategy` picks a tech target but evaluators historically ignored it, causing the AI to spend savings on unrelated items.
   - `reservedStars` previously held 50% of tech cost even when fully affordable, delaying research.
   - No goal metadata (reason, urgency) was stored for planner insights or debugging.

2. **Economy & City Development**
   - Building catalogues inside the AI were hand-coded and out of sync with `STRUCTURE_DEFINITIONS`, so the AI attempted to build structures that do not exist or that it already owns.
   - Worker tasking, improvement construction, and resource harvesting remain unimplemented; the AI neither plans roads nor organises economy upgrades.

3. **Combat & Ability Usage**
   - Combat evaluation relies on seeded randomness rather than deterministic odds; the AI cannot anticipate counter-damage or aura effects.
   - Ability handling is placeholder-only; Book-of-Mormon themed abilities are invisible to the AI despite game support.

4. **Exploration & Expansion**
   - Escort and formation logic exist but exploration targets are not prioritised; there is no concept of city founding, settler safety, or ruin scouting.

5. **Telemetry & Tooling**
   - Telemetry events emit for debugging but there is no replay logger or persistence.
   - Console logging remains in turn execution and can flood production logs.

6. **Testing & Determinism**
   - No automated tests cover AI planner outputs or decision quality.
   - Seeds derive from `Date.now()` and numeric player IDs; non-numeric IDs or deterministic tests can break reproducibility.

## Recommended Upgrade Path

1. **Strategic Planner Integration** – Ensure planner outputs drive all tech and city decisions, enforce star reservations, and expose actionable goal metadata.
2. **Economy Manager** – Replace stub catalogues with shared data, add worker automation, and respect inspiration discounts when budgeting.
3. **Combat & Ability Brain** – Replace placeholder combat heuristics with reducer-backed simulations; add scripted ability usage patterns.
4. **Exploration & Expansion** – Implement scouting priorities, neutral city capture routines, and settlement spacing logic driven by personality traits.
5. **Telemetry & Analytics** – Route AI decisions through telemetry (reason, expected payoff) and enable optional replay export for QA.
6. **Testing & Determinism** – Introduce unit/integration tests for planner results; base seeds on hashed game state rather than wall-clock time.

## Current Work-in-Progress
- Telemetry consumer/export tooling so captured events translate into analytics or player-facing logs.
- Worker automation (roads, improvements) and fuller exploration goals remain open follow-ups.

Future agents should append notes to this document when milestones are completed or new risks surface.

## Progress Update – 2025-01-07
- Strategic planner now generates data-driven improvement and unit build plans with budgeting restraints, and decision evaluators consume those plans (structures, improvements, units) when queuing construction.
- Combat evaluation uses reducer-backed simulations for attack advantage/risk, and unit ability automation covers healing, siege preparation, stealth, formation fighting, and rally actions; scouts prioritise unexplored frontier tiles.
- Initial unit tests (`test/unit/AIEngineStrategic.unit.test.ts`) now exercise planner output, heal/siege automation, worker job routing, and scout exploration. Telemetry export persists locally; long-term analytics integration remains a follow-up task.
