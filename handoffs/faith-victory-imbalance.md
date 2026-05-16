# Faith victory imbalance — problem shape

## TL;DR
Faith victory is currently disabled (`GAME_RULES.victory.faithEnabled = false` in `shared/data/gameRules.ts:201`) because reaching the win condition is too easy. The note in source attributes this to diplomacy, but the underlying problem is much broader than that. Faith victory is **structurally over-rewarded across at least seven independent systems**, and the win path has **no real opportunity cost, no upkeep, no counter-play, and no synergy tax** against the other victory paths. The 90/dissent-≤10 threshold isn't the issue — the issue is that almost every system in the game pushes a peaceful player *toward* that threshold, and almost nothing pushes back.

## The win condition itself (for reference)
From `shared/logic/actions/turns.ts:894–903` and `shared/data/gameRules.ts:199–222`:
- `player.stats.faith >= 90` (faith is clamped 0–100)
- `player.stats.internalDissent <= 10`
- Both checked at end of any turn; first qualifying player wins (`pickWinnerByTiebreaker`, line 251).

There is nothing wrong with the check itself. The problem is that the inputs are trivial to satisfy.

## Problem 1 — Passive faith generation stacks linearly with no cap and no upkeep

`calculatePlayerFaithGeneration` in `shared/logic/actions/turns.ts:179–224` sums up:

| Source | Amount | Per | Notes |
|---|---|---|---|
| Cities owned | 2 faith | per city per turn | `faithPerCity` in `gameRules.ts:227`. Free baseline, no opt-in. |
| Shrine improvement | 2 faith | per shrine | `city.ts:240`. Costs 6 stars, `spirituality` tech. Buildable on plains/forest/mountain — plentiful tiles. |
| Temple structure | 5 faith | per temple | `city.ts:275`. Costs 8 stars, `spirituality`. One per city, but every city wants one. |
| Cathedral structure | 4 faith | per cathedral | `city.ts:321`. Costs 25 stars, `priesthood`. Late-game compounding. |
| Missionary unit | 1 faith | per missionary, **capped at +5** | `gameRules.ts:228–229`. Capped, but the cap is hit at 5 missionaries — cheap. |
| Reformed (Lamanite) | 1 faith | per Reformed unit | `units.ts:257`. **Not capped.** Stacks unlimited. Also -1 dissent. |
| Scribe-Teacher (Mulekite) | 1 faith | per Scribe-Teacher | `units.ts:279`. **Not capped.** Also -1 dissent. |
| Yield modifiers | × multiplier | applied last | `applyYieldModifiers` (turns.ts:223). Active-effect tests at `activeEffects.test.ts:241–242` verify 2× stacking. |

**Concrete numbers.** A 4-city peaceful Nephite/Anti-Nephi-Lehi player at mid-game with 1 temple + 1 shrine per city + 1 cathedral + 5 missionaries generates:
- 4×2 (cities) + 4×5 (temples) + 4×2 (shrines) + 1×4 (cathedral) + 5 (missionary cap) = **45 faith/turn** with no faction-passive units.

Faith is clamped to 100. 45/turn means **the entire 0-to-90 climb takes ≤2 turns** once the buildings are up. Even a minimalist 2-city setup with 1 temple + 1 shrine per city generates 4 + 10 + 4 = 18 faith/turn — full bar from zero in ~5 turns.

There is no upkeep cost on temples/cathedrals/shrines (no faith drain, no star drain). Buildings are pure one-time stars-in, faith-out-forever.

## Problem 2 — Faith almost never decays

Searched `shared/logic` and `shared/data` for negative-faith mechanics. Found:
- One unit type (Zoramite-flavored) has `perTurn: { ..., faith: -1 }` in `units.ts:440`. Player-controlled, easily avoided.
- `WEALTH_ACCUMULATION` faction ability is described as "lose faith over time" (`abilities.ts:111`) — passive cost, applies to Zoramites, voluntary.
- One-shot costs when a player *spends* faith (`abilitySystem.ts`, `conversion.ts`, etc.) — see Problem 4.

That's it. **There is no environmental, time-based, or opponent-driven faith decay.** Banked faith stays banked. A player who reaches 90 stays at 90 indefinitely. There is no equivalent of Civ's culture/tourism pressure from rivals, no faith-erosion from war losses, no "lose faith when a city is captured," no "lose faith when a missionary dies." Faith is a pure ratchet.

## Problem 3 — Dissent ≤10 is easier to satisfy than faith ≥90, and the two goals share infrastructure

The win condition needs *both* faith and low dissent. They look like two checks, but they're solved by the same buildings and units.

Dissent inputs per turn (`turns.ts:361–390`):
- **+** `Math.floor(pride / 35)` — capped at +3
- **+** `wars × 1` — capped at +4
- **−** `min(4, alliances + temples)` — the same temples that produce faith
- **−** `1` extra if `faith ≥ 70`, via the "humility pressure" branch (line 384–390) that reduces pride, which then reduces dissentFromPride next turn
- Unit passives: Reformed −1, Scribe-Teacher −1, Prophet −1 (`units.ts:257/279/303`) — the same units that produce faith
- City peace-conversion: instant −10 dissent (`gameRules.ts:370`) — costs only 5 net faith

**The optimum faith strategy is *also* the optimum low-dissent strategy.** A peaceful player who:
- avoids wars (dissentFromWar = 0)
- builds temples (faith ↑, dissent ↓ via alliance+temple cap)
- recruits Reformed / Scribe-Teacher (faith ↑, dissent ↓)
- naturally hits faith ≥70 (extra pride humble → less dissent inflation)

...will park dissent near 0 without effort. The "10 dissent" ceiling is essentially a non-check for a faith-pursuing player.

The diplomacy angle is real but limited: each alliance contributes only 1 to the `min(4, alliances + temples)` cap. The cap is already saturated by 4 temples alone. Alliances are an *additional* free path, not the path.

## Problem 4 — Faith sinks are too cheap and entirely opt-in

`gameRules.ts:298–311` and `:362–376` list every faith cost in the game:

| Sink | Faith cost | Notes |
|---|---|---|
| Missionary heal | 5 | Almost free at 45/turn income. |
| Unit conversion | 20 | One-shot. |
| Village conversion | 8 | One-shot, **and refunded by +8 faith reward in `villageActions.ts:62`**. Net zero. |
| City conversion (faith) | 20 | One-shot. |
| City conversion (peace) | 10 − 5 refund = **5 net** | And gives −10 dissent. Net win for the faith player. |
| Covenant of Peace | 15 | Cooldown gates it more than the cost. |
| Title of Liberty (Nephite) | 50 | Highest single cost. Spent voluntarily for combat buff. |
| Divine Protection | 20 | Voluntary. |
| Enlightenment | 50 | Voluntary, grants a free tech (snowballs other victory paths). |
| Divine Ward | 10 | Voluntary. |

A player who simply does not use any of these abilities pays **zero faith**. There is no mandatory drain. Every sink is a choice the player makes to spend a resource they're generating faster than they can use it.

Note that village conversion is *net-positive* faith (cost 8, reward 8 from the peaceful-integration handler — see `villageActions.ts:62`) and city peace-conversion is *net-negative dissent* — these are the actions the game wants you to take for thematic/peaceful play, and both of them help the faith path instead of taxing it.

## Problem 5 — Faith is positively coupled to military strength, not traded off against it

`gameRules.ts:347–353` and the combat resolver apply combat bonuses based on the faith stat:
- Faith ≥ 50: **+1 defense** to all your units
- Faith ≥ 70: **+2 attack, +1 defense** to all your units

This means **the player closest to faith victory has the strongest army**. There is no "we're winning, but we're soft" trade-off. A faith leader who is attacked by a rival trying to stop the win is fighting that rival from a position of military advantage *because* of their faith stockpile. Combined with no faith-loss-on-defeat (Problem 2), even successful raids against a faith leader don't slow the win path.

## Problem 6 — No opponent counter-play exists

There is no mechanic by which one player can directly reduce another player's faith stat. Specifically:
- Unit conversion, city conversion, village conversion: cost the **converter** faith, do not subtract from the target player's faith.
- Combat / raiding: no faith damage.
- City capture: destroys structures (`gameRules.ts:255` `destroyAllStructures: true`), which removes the *future* faith generation from that city — but this requires military conquest, which most players in a peaceful 4-faction game will not pursue in time. And the leader's existing 90 faith is untouched.
- AI behavior: `aiEngine.ts:2601–2667` computes the AI's *own* `faithProgress` to decide whether to pivot strategy, but there is **no "stop the faith leader" reactive behavior**. The AI does not target a leading faith player, does not preferentially destroy their temples, does not race to convert their cities, does not declare war to inject dissent.
- No mechanic in `aiDiplomacyEngine.ts` weights a peer's faith level when deciding to break alliances or declare war.

A human or AI rival, on noticing a faith leader at 70/0, has no toolkit beyond "send an army and try to take a city" — which (a) takes many turns, (b) gives the faith leader free combat bonuses to defend with, and (c) generates dissent in the *attacker* via the `dissentFromWar` term.

## Problem 7 — Building requirements overlap with cultural victory, doubling the reward

`gameRules.ts:213–221` cultural victory threshold:
- `structureTypes: ['temple', 'cathedral', 'library', 'academy']`
- `improvementTypes: ['shrine']`

**Temple, cathedral, and shrine are simultaneously the top three faith-production buildings and three of the five buildings that count toward cultural victory.** A faith-pursuing player automatically banks cultural-victory progress with no extra investment. They race two victory paths in parallel and only need one to land. The tie-breaker (`turns.ts:251–260`) then sorts by `cities → faith → techs → units` — so a faith-stockpiled player who happens to also reach cultural or territorial thresholds wins the tie on faith.

## Problem 8 — The faction roster makes the problem extreme for several factions

Multiple factions get faith-positive unit passives unavailable to others, with no balancing tax:
- **Lamanites**: `reformed` unit, +1 faith / −1 pride / −1 dissent per turn passive (`units.ts:257`), uncapped stacking.
- **Mulekites**: `scribe_teacher`, +1 faith / −1 dissent per turn, plus diplomacy cooldown bonus (`units.ts:279`).
- **Jaredites**: `prophet`, no direct faith but −1 dissent and pride-suppression (`units.ts:303–306`) — essentially solves the dissent half of the win condition.
- **Nephites**: Title of Liberty (faith ≥70 gate) + Faithful Defense + Faith-coupled combat bonuses align perfectly.
- **Anti-Nephi-Lehies**: thematically the faith faction — get every advantage of the above without trade-off.

This means the **balance problem is not symmetric across factions**: 5 of 8 factions get bonus rails toward faith victory, and 0 of 8 get a meaningful counter or tax. A re-enable without faction-level rebalancing would skew win rates by faction roster.

## Problem 9 — Pacing has no gate

`gameRules.ts:281–283`: `maxTurnsPerGame: 200`, no turn floor on faith victory. Combined with ~45 faith/turn at mid-game, faith victory can land on turn 20–30 in a small game — before most other victory paths have meaningfully developed (economic victory requires high income + tech %; cultural requires population scaling). This makes faith not just *easier*, but *faster*, which compounds the problem: faster wins reduce the window in which any of the existing weak counter-play (military conquest) could even be attempted.

## Problem 10 — The "moral choice" framing is structurally broken

The game's design framing presents Faith vs Pride as a meaningful trade-off (e.g. `worldElementActions.ts:295`, the moral-delta system, and faction descriptions). In practice:
- Pride feeds dissent (`turns.ts:375`), dissent breaks the faith-victory condition → Pride is strictly bad for a faith player.
- Faith ≥70 actively reduces Pride (`turns.ts:384–390`) → Faith strictly dominates Pride for a faith player.
- The morale loop's "prosperity → pride → contention → loss" cycle (`turns.ts:373–399`) only triggers from `prosperityScore = starIncome + ...`, which is *low* for a peaceful low-population faith player. The cycle that's supposed to punish snowballing **never engages against the faith path**.

There is no actual choice. Pursuing faith is monotonically better than not pursuing it, for any non-warfare faction.

## What test coverage exists today

`shared/logic/gameReducer.test.ts:509–544`:
- "awards faith victory when threshold and dissent are met" — flips flag on, sets faith=95/dissent=5, asserts win.
- "does not award faith victory while the faith win condition is disabled" — flips flag off, sets faith=95/dissent=5, asserts no win.

That's the entire dedicated test surface. Neither test exercises *time-to-90* under realistic generation rates, faith decay/upkeep, dissent under sustained pride/war pressure, faction asymmetry, opponent counter-play, or interaction with other victory paths. The win-condition *plumbing* is tested; the *balance* of inputs feeding the plumbing is not.

## Files that constitute the full surface

| File | Role |
|---|---|
| `shared/data/gameRules.ts` | Victory threshold, dissent cap, faithPerCity, faithPerMissionary cap, all faith costs, conversion costs, faithBonuses. |
| `shared/types/city.ts` | Shrine/Temple/Cathedral `faithProduction` values (the dominant source). |
| `shared/logic/actions/turns.ts:179–224` | `calculatePlayerFaithGeneration` — the single point that sums all passive faith. |
| `shared/logic/actions/turns.ts:361–399` | Dissent inflation/relief math, including `alliances + temples` cap. |
| `shared/logic/actions/turns.ts:881–903` | `checkVictoryConditions` faith branch. |
| `shared/logic/actions/turns.ts:251–260` | Tiebreaker that uses faith as a secondary sort key for *all* victory types. |
| `shared/data/units.ts` | Reformed, Scribe-Teacher, Prophet, Zoramite passives. |
| `shared/data/abilities.ts` | Faith-gated faction abilities (Title of Liberty, Covenant of Peace, Missionary Zeal, Cultural Reclamation, Enlightenment, Divine Protection, Divine Ward). |
| `shared/logic/worldElementActions.ts` | Ruin exploration +1 faith, village conversion +8 faith, peace-conversion math. |
| `shared/logic/actions/conversion.ts` | City conversion faith costs (faith / pride / peace variants). |
| `shared/ai/aiEngine.ts:2596–2667` | AI victory-progress calculation, including the `faithEnabled` gate that pivots away from faith when disabled. |
| `shared/ai/aiDiplomacyEngine.ts` | Alliance proposal/break logic; does not factor opponent faith. |
| `shared/ai/factionAbilityHeuristics.ts:57/134/157` | AI thresholds tied to its own faith level (e.g. ≥70/≥90/≥95) — references for behavior, not contributors to the bug. |
| `client/src/components/hud/PlayerHUD.tsx:571,626` | UI surface (Faith tile + tooltip line) — both already gated on `faithEnabled` so they'll light up automatically on re-enable. |
| `docs/PLAYER_REFERENCE.md` § 16 | Player-facing victory-conditions copy — currently silent on faith per replit.md note; will need rewrite. |
| `shared/logic/gameReducer.test.ts:509–544` | Existing test coverage (minimal). |

## Net characterization

The faith victory is not unbalanced because of any single mechanic. It's unbalanced because **every system in the game that touches faith pushes in the same direction**: production is high and stacks with no cap, drain is voluntary, the win-condition's second clause (dissent ≤10) is served by the same buildings as the first clause, the same buildings also count for cultural victory, the same faith stat boosts combat so the leader is hard to attack, no opponent has a tool to reduce the leader's faith, no AI behavior tries to stop the leader, 5 of 8 factions get bonus passive faith, no turn-floor gate exists, and the moral-loop pressure that's supposed to throttle snowballing only engages against high-income players, not high-faith ones. The 90/10 threshold is the visible symptom; the cause is system-wide one-sidedness with no compensating pressure on any axis.

Re-enabling the flag without addressing the structural issues will reproduce the "instant/cheap wins" the original commenter flagged, regardless of how the threshold itself is tuned.
