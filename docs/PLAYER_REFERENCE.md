# Chronicles of the Promised Land — Player Reference

This reference is written to match the game’s current rules and data (units, techs, buildings, and core systems). It’s organized from “most foundational” to “most situational,” so you can learn in the order you’ll actually use things.

---

## 1) The Core Loop (What You Do Each Turn)

1. **Evaluate your economy**
   - How many Stars you’ll gain at end of turn (cities, improvements, structures, villages, roads, trade routes, passive units).
   - How much Faith you’re gaining (cities, shrines/temples/cathedrals, missionaries, passive units).
2. **Move units**
   - Position for combat, scouting, and objectives (villages, ruins, world elements).
3. **Take actions**
   - Attack, capture cities, explore ruins, harvest/build world elements, build roads, convert villages, etc.
4. **Spend Stars**
   - Research technologies.
   - Build improvements/structures.
   - Recruit units.
5. **End Turn**
   - Income applies.
   - Morale events can trigger (Pride/Dissent system).
   - Cooldowns tick down.

---

## 2) Resources & Stats (What They Mean)

### Stars (Economy)
The primary currency used to:
- Research technologies
- Recruit units
- Build improvements and structures
- Establish trade routes

### Faith (0–100)
Represents covenant strength and spiritual power. Used for:
- Missionary healing and conversion actions
- City conversion options (Faith-based / Peace-based)
- Some faction/tech abilities

Faith is also a combat factor:
- High Faith improves offense/defense (see Combat section).

### Pride (0–100)
Represents prosperity-driven pride cycles. Pride is **not** a “free buff resource”; high Pride increases the likelihood of **contention-style losses** and can interact with faction systems (e.g., Jaredites).

### Internal Dissent (0–100)
Represents instability/unrest. Higher Dissent increases the likelihood of negative events:
- Rebellion (unrest + star loss)
- Desertion (unit leaves + star loss; only possible above a floor)

---

## 3) Factions (Identity, Unlocks, Playstyle)

Factions mainly change:
- Your **identity** (name, theme, flavor).
- Your **unique and faction-locked units** (most important gameplay difference today).
- Access to certain **influence units** and late-game tools.

Note on “starting stats”: factions define intended starting Faith/Pride/Dissent profiles, but some game modes may start players with the same baseline stats. Always trust the values shown in your HUD at the start of the match.

### Nephites
- Theme: faith, defense, organized society
- Faction-locked units: Missionary, Stripling Warrior
- Strategy: invest in Faith economy (shrines/temples), hold terrain, win with stability and timing.

### Anti-Nephi-Lehies
- Theme: covenant peace, defensive endurance
- Faction-locked units: Missionary, Stripling Warrior, Peacekeeping Guard
- Strategy: high Faith tools and strong defense; win by stability and conversion pressure.

### Lamanites
- Theme: aggression, pride, early pressure
- Faction-locked units: Wilderness Hunter, Converted Missionary
- Strategy: expand and contest key points early; then stabilize Dissent and pivot into Faith tools if needed.

### Mulekites of Zarahemla
- Theme: records, diplomacy, expansion through knowledge
- Faction-locked units: Royal Envoy, Scribe-Teacher
- Strategy: build a stable economy, leverage roads/trade, and reduce Dissent with influence units.

### Zoramites
- Theme: wealth/status, pride-driven instability
- Faction-locked units: Royal Envoy, Priestcraft Preacher
- Strategy: use Preachers for fast Stars (with Pride/Dissent consequences), then manage morale and avoid collapse.

### Jaredites
- Theme: ancient power, cycles of pride and warning
- Faction-locked units: Prophet, Ancient Giant
- Strategy: ride high power safely; Prophets are a stability valve when Pride is high.

### Hagoth's Mariners
- Theme: coastal expansion, shipbuilding, and exploration
- Faction-locked units: Voyager, Shipwright
- Strategy: use ports, sea mobility, and shoreline scouting to build a flexible economy.

### Amulonites
- Theme: coercive economy, forced labor, and intimidation
- Faction-locked units: Taskmaster, Amulonite Enforcer
- Strategy: turn early output into pressure, but manage the high Faith and Dissent risk.

---

## 4) Terrain, Movement, and Visibility

### Terrain movement costs (rules baseline)
- Plains: 1
- Forest: 2
- Mountain: 2 (slow)
- Desert: 2
- Swamp: 3
- Water: impassable to most land units

### Vision
Units have a **vision radius** (varies by unit). Scouts and commanders tend to see farther.
Explored terrain remains as dimmed map memory after units move away, but current unit visibility still determines what is fully visible.

---

## 5) Cities & Economy (Where Stars Come From)

Stars per turn can come from:

1. **Cities**
   - Each owned city has `starProduction` (base + growth/buildings).
   - Cities under **unrest** lose income (see Morale).

2. **Improvements**
   - Built on the map (farms, mines, ports, shrines, roads, etc.).
   - Most provide `starProduction`; some provide Faith via effects.

3. **Structures**
   - Built in cities (temple, cathedral, academy, etc.).
   - Provide star production and other effects (including Faith for religious structures).

4. **Converted Villages**
   - Provide `+1 Star/turn` each, indefinitely.

5. **Road Networks (automatic bonus)**
   - Every connected road “network” of your cities grants Stars each turn:
     - For each connected component: `+ (number of cities in component − 1)` Stars/turn.
     - If you have **Trade**, this bonus is doubled.

6. **Trade Routes**
   - A separate system from roads (roads are a prerequisite).
   - Each active trade route adds `+Stars/turn` (see Diplomacy & Trade).

7. **Passive Unit Effects**
   - Some “influence” units provide per-turn Stars/Faith/Pride/Dissent.

### Building and recruiting (practical)
- **Recruit units** from a city by spending Stars (city capacity rules apply).
  - Per-city unit cap: up to 4 non-boat units can occupy the city tile at once.
- **Build improvements** with a Worker on valid terrain (requires the tech and Stars).
- **Build structures** in a city by paying their cost (requires the tech).

---

## 6) Faith Economy (How Faith is Generated)

Faith per turn is generated at end of your turn from:

1. **Base Faith from Cities**
   - `+2 Faith/turn` per owned city.

2. **Structures with Faith Production**
   - Temple: `+5 Faith/turn`
   - Cathedral: `+4 Faith/turn`

3. **Improvements with Faith Production**
   - Shrine: `+2 Faith/turn`

4. **Missionary Presence Bonus**
   - Each Missionary you own provides `+1 Faith/turn`, capped at `+5` total.

5. **Passive Influence Units**
   - Converted Missionary, Scribe-Teacher, Prophet can add Faith per turn (see Units).

Faith is clamped to `0–100`.

---

## 7) Combat & Status Effects (How Fighting Works)

### Core combat
- The attacker deals damage based on **Attack − Defender Defense** (minimum 1).
- The defender can **counterattack** if alive and in range (using their Attack vs attacker Defense).
- Range matters: you can only attack if the target is within your unit’s `attackRange`.

### Terrain and city defense
Defenders get terrain defense bonuses (forests, mountains, swamps).
Units defending inside a city also benefit from any completed city structure defense bonuses.

### Stealth
- Stealthed units can’t be targeted at range > 1 (you must be adjacent).
- Attacking removes stealth.

### Siege/Bombardment (Catapult and similar)
Bombardment attacks at range require:
- Unit is in `siege_mode`
- Unit has not moved this turn (must be stationary to fire at range)
- Artillery cannot fire at adjacent targets (minimum range 2)
Bombardment can apply splash damage to enemies adjacent to the target.

### Rallied / Formation / Defending
Some actions and abilities set unit statuses that modify combat:
- `rallied`: attacker gets +2 Attack
- `siege_mode`: attacker gets +3 Attack (and enables ranged bombardment)
- `formation`: defender gets +2 Defense
- `defending` / `fortified`: only grants a defense bonus if the unit has the Fortify ability (+4 Defense)

### Faith synergy bonuses
Faith provides combat advantages:
- If attacker’s owner Faith is **high** (>= 70): attacker gains `+2 Attack`.
- If defender’s owner Faith is **moderate** (>= 50): defender gains `+1 Defense`.
- If defender’s owner Faith is **high** (>= 70): defender gains `+1 Defense`.

### Testimony Pressure (Missionary Influence)
Enemy missionaries can apply a temporary “softened resolve” penalty:
- Applies to **military units** adjacent to missionaries (civilians/influence/diplomat units are excluded).
- Effect: `-1 Attack` for `1` turn (of the affected unit’s owner).
- Also clears certain temporary command buffs (where applicable).

You’ll see this in your HUD/status feedback when it affects your units.

---

## 8) Villages (Conquer vs Convert)

Unclaimed villages present a moral choice:

### Conquer (Military takeover)
- Cost: none
- Immediate: `+5 Stars`, `+1 Population` (applied to your nearest owned city)
- Moral impact: `+2 Pride`, `+1 Dissent`
- Ongoing: none

### Convert (Peaceful integration)
- Cost: `8 Faith`
- Immediate: `+2 Stars`, `+2 Population` (applied to your nearest owned city)
- Moral impact: `+2 Faith` (net Faith change is `-6` after the cost)
- Ongoing: `+1 Star/turn` from that converted village

Villages do not change technology costs directly; tech costs scale with the number of technologies researched.

---

## 9) Diplomacy, Roads, and Trade Routes (Strategic Economy)

### Alliances
Forming an alliance:
- Increases Faith and reduces Dissent (for both sides).
- Has a cooldown (can’t chain alliances instantly).

### Declaring War
Declaring war:
- Raises Pride and Dissent for the declaring player.
- Breaks alliances between the two players.
- Has a cooldown.

### Roads (Worker action)
Roads are built tile-by-tile and serve two purposes:
1. **City-network income** (automatic Stars/turn for connected city groups)
2. **Trade route infrastructure** (trade routes require road connectivity)
3. **Movement**: friendly units pay reduced movement cost on road tiles

Road build rules:
- Costs 3 Stars, requires Organization technology.
- Cannot be built on water or mountains.

### Trade Routes (requires Trade tech)
Establishing a trade route:
- Requires **Trade** technology.
- Requires a **road connection** between the two cities.
- Cannot duplicate an existing city pair (A–B is the same as B–A).
- Each city can support one outgoing route.
- Your total routes are capped: up to your number of cities (minimum 1).
- Has a cooldown to prevent spam-clicking: after establishing a route, you must wait before requesting another.

Trade route income:
- Stars/turn is computed (clamped 1–6) from:
  - city levels (base),
  - distance proximity (shorter routes get a small bump),
  - and road connectivity (routes require it anyway).
- Establishing the route costs Stars based on the route’s Stars/turn:
  - cost = max(8, StarsPerTurn * 5)

---

## 10) Ruins & Exploration Rewards

Exploring ruins consumes your unit’s action and can yield:
- Stars (small/moderate/large)
- Faith (uncommon to legendary)
- Research progress boosts
- Healing
- Temporary vision
- A curse (adds Dissent/Pride)

Rewards vary by rarity and are randomly selected.

---

## 10.1) Morale Events (Pride Cycle + Dissent Pressure)

At end of turn, the game applies a Book of Mormon-inspired “pride cycle” drift and may trigger random-feeling events.

### Ongoing drift each turn
- **Prosperity increases Pride**: higher Star income and stored Stars tend to raise Pride (capped).
- **Pride increases Dissent**: higher Pride increases contention pressure.
- **War increases Dissent**: each active war increases Dissent pressure.
- **Alliances and Temples reduce Dissent**: stability relief scales with alliances + temples.
- **High Faith and Temples humble Pride**: if Faith is high and you have temples, Pride trends downward.

### Random-feeling events (moderate severity)
These events become more likely the higher your Pride and Dissent become.

Bad events (scaled by Pride/Dissent):
- **Rebellion**: a city gains unrest for several turns and you lose Stars immediately.
- **Desertion**: a non-worker unit may leave (only possible once Dissent is high enough).
- **Contention**: you lose Stars and Pride is humbled.

Good events (more likely at low Pride/Dissent):
- **Blessings of humility/peace**: you gain Stars, Faith increases, and Dissent decreases.

## 11) World Elements (Map Resources with Moral Tradeoffs)

World elements appear on tiles and usually present two paths:
- **Immediate harvest**: “cash now” with Pride/Dissent costs.
- **Long-term build**: a structure/improvement with steady returns and often a Faith benefit.

### Timber Grove (forest/hill)
- Harvest Lumber: `+2 Stars`, `+1 Pop` (Pride +1, Dissent +1)
- Build Sawmill (5 Stars): `+1 Pop`, `+1 Star/turn`, `+1 Faith`
- Tech: Woodcraft

### Wild Goats (plains/hill)
- Slaughter for Meat: `+2 Stars`, `+1 Pop` (Pride +1, Dissent +1)
- Build Corral (5 Stars): `+1 Pop`, `+1 Star/turn`, `+1 Faith`
- Tech: Husbandry

### Untilled Grain Patch (plains/forest)
- Gather Harvest: `+2 Pop` (Pride +1, Dissent +1)
- Build Field (5 Stars): `+2 Pop`, `+1 Faith`
  - Upgrade: Windmill (requires Irrigation): adds `+1 Star/turn`
- Tech: Agriculture

### Ore Vein (mountain)
- Tap the Vein: `+2 Stars`, `+1 Pop` (Pride +1, Dissent +1)
- Build Mine (5 Stars): `+1 Pop`, `+1 Star/turn`, `+1 Faith`
- Tech: Mining

### Fishing Shoal (water)
- No immediate harvest
- Build Fishing Jetty (2 Stars): `+1 Pop`
  - Upgrade: Harbor (requires Trade): `+2 Stars/turn`
- Tech: Fishing

### Great Sea Beast (water)
Terrain: deep water.
- Expedition Harvest (requires a Boat or other naval transport unit): `+10 Stars` (Pride +3, Dissent +3)
- Build Sea Platform (5 Stars): `+2 Pop`, `+2 Faith`
- Tech: Navigation

### Jaredite Ruins (varies)
Explore Ruins: `+1 Faith` plus a random boon (Stars, technology progress, population, or a unit).
- No tech required

---

## 12) Improvements (Built on the Map)

Improvements are built on valid terrain and require the listed tech.

| Improvement | Cost | Stars/turn | Faith/turn | Tech | Notes |
|---|---:|---:|---:|---|---|
| Farm | 5 | +2 | +0 | Organization | Plains/Desert |
| Mine | 8 | +3 | +0 | Mining | Mountain |
| Forest Camp | 6 | +2 | +0 | Forestry | Forest |
| Lumber Hut | 5 | +1 | +0 | Forestry | Forest |
| Sawmill | 10 | +3 | +0 | Construction | Forest |
| Plantation | 12 | +4 | +0 | Agriculture | Plains/Forest |
| Irrigation | 10 | +3 | +0 | Irrigation | Plains/Desert |
| Workshop | 15 | +3 | +0 | Bronze Working | Mountain/Plains |
| Port | 8 | +2 | +0 | Sailing | Water (Seafaring adds +1 Star/turn) |
| Aqueduct | 20 | +2 | +0 | Engineering | Plains/Mountain |
| Road | 3 | +0 | +0 | Organization | Built by Workers; boosts network income |
| Shrine | 6 | +0 | +2 | Spirituality | Early Faith investment |

---

## 13) Structures (Built in Cities)

| Structure | Cost | Stars/turn | Faith/turn | Tech | Other effects |
|---|---:|---:|---:|---|---|
| Temple | 8 | +1 | +5 | Spirituality | +1 Population on completion |
| Cathedral | 25 | +3 | +4 | Priesthood | +1 City Defense, +2 Population on completion |
| Granary | 10 | +0 | +0 | Agriculture | +2 Population on completion |
| Lighthouse | 12 | +2 | +0 | Sailing | Unit Production (not yet implemented) |
| Academy | 30 | +4 | +0 | Philosophy | +1 Population on completion |
| Library | 20 | +2 | +0 | Philosophy | +1 Population on completion |
| Fortress | 35 | +0 | +0 | Engineering | +3 City Defense, ranged attacks deal -2 damage to defenders, Unit Production (not yet implemented) |

---

## 14) Units (Costs, Unlocks, Roles)

Units are listed by role; each includes cost, unlock tech (if any), stat requirements, and key actions.

### A) Core military units

#### Warrior
- Cost: 10 Stars
- Role: baseline melee
- Base stats: HP 25, Atk 6, Def 4, Move 3, Range 1

#### Spearman
- Cost: 12 Stars
- Tech: Bronze Working
- Role: stronger frontline unit
- Base stats: HP 20, Atk 7, Def 5, Move 3, Range 1

#### Guard
- Cost: 14 Stars
- Role: defensive specialist
- Base stats: HP 30, Atk 4, Def 8, Move 2, Range 1

#### Commander
- Cost: 25 Stars
- Tech: Leadership
- Requirement: Pride 50+
- Role: elite leader with tactical actions
- Base stats: HP 35, Atk 8, Def 6, Move 3, Range 1

#### Catapult (siege)
- Cost: 20 Stars
- Tech: Engineering
- Role: long-range bombardment
- Base stats: HP 12, Atk 15, Def 2, Move 1, Range 3
- Notes: ranged bombardment requires siege mode and being stationary that turn.

### B) Recon and skirmish

#### Scout
- Cost: 6 Stars
- Tech: Hunting
- Role: fast recon
- Base stats: HP 12, Atk 3, Def 2, Move 5, Vision 4
- Actions: stealth/recon behaviors (visibility and targeting rules apply).

#### Slinger
- Cost: 8 Stars
- Tech: Hunting
- Role: light ranged skirmisher
- Base stats: HP 16, Atk 4, Def 2, Move 3, Range 2

#### Wilderness Hunter (Lamanites)
- Cost: 13 Stars
- Requirement: Pride 40+
- Role: ranged harassment/ambush
- Base stats: HP 18, Atk 7, Def 3, Move 4, Range 2

### C) Naval

#### Boat
- Cost: 8 Stars
- Tech: Sailing
- Role: coastal transport/exploration
- Base stats: HP 15, Atk 3, Def 2, Move 4, Range 1

#### Voyager (Hagoth's Mariners)
- Cost: 12 Stars
- Tech: Sailing
- Role: amphibious expedition vessel
- Base stats: HP 18, Atk 5, Def 3, Move 4, Vision 4
- Notes: carries naval transport/coastal exploration/amphibious tags.

### D) Civilians and infrastructure

#### Worker
- Cost: 5 Stars
- Tech: Organization
- Tags: civilian
- Role: improvements, harvesting, clearing forests, building roads
- Base stats: HP 10, Atk 1, Def 1, Move 2

### E) Faith and influence units

#### Missionary (Nephites, Anti-Nephi-Lehies)
- Cost: 8 Stars
- Tech: Priesthood
- Requirement: Faith 60+
- Tags: civilian, influence
- Base stats: HP 18, Atk 1, Def 2, Move 3
- Actions:
  - Heal nearby allies (radius 2): costs 5 Faith, restores up to 3 HP to each damaged ally in range.
  - Convert enemy unit (range 2): costs 20 Faith; success chance depends on Faith advantage.
  - Convert city (adjacent): consumes the missionary’s action; choose one:
    - Faith conversion: costs 20 Faith
    - Pride conversion: costs 15 Pride
    - Peace conversion: pay 10 Faith, then regain 5 Faith and reduce Dissent by 10 (net -5 Faith, -10 Dissent)

#### Priestcraft Preacher (Zoramites)
- Cost: 10 Stars
- Tech: Spirituality
- Tags: civilian, influence
- Passive (per turn): `+1 Star`, `+2 Pride`, `+1 Dissent`

#### Converted Missionary (Lamanites)
- Cost: 10 Stars
- Tech: Priesthood
- Requirement: Faith 40+
- Tags: civilian, influence
- Passive (per turn): `+1 Faith`, `-1 Pride`, `-1 Dissent`

#### Scribe-Teacher (Mulekites)
- Cost: 12 Stars
- Tech: Trade
- Tags: civilian, influence
- Passive (per turn): `+1 Faith`, `-1 Dissent`
- Diplomacy passive: improves trade request tempo (cooldown reduction).

#### Shipwright (Hagoth's Mariners)
- Cost: 14 Stars
- Tech: Seafaring
- Tags: civilian, influence
- Passive (per turn): `+1 Star`, `+1 Pride`

#### Taskmaster (Amulonites)
- Cost: 12 Stars
- Tech: Organization
- Tags: civilian, influence
- Passive (per turn): `+1 Star`, `-1 Faith`, `+2 Pride`, `+2 Dissent`
- End-turn pressure: adjacent enemy military units become Intimidated.

#### Prophet (Jaredites)
- Cost: 12 Stars
- Tech: Spirituality
- Tags: civilian, influence
- Passive (per turn): `-1 Dissent`
- Conditional passive: if Pride >= 60, also `-2 Pride/turn`

#### Royal Envoy (Mulekites, Zoramites)
- Cost: 15 Stars
- Tags: civilian, diplomat
- Role: diplomatic mobility and non-combat pressure.
- Combat interaction: if your faction Faith is 80+, attackers may be forced to stand down when trying to attack an envoy (the attacker spends their attack and loses some Pride).

### F) Elite / special

#### Stripling Warrior (Nephites, Anti-Nephi-Lehies)
- Cost: 12 Stars
- Requirement: Faith 70+
- Role: elite defensive soldier
- Base stats: HP 20, Atk 5, Def 6, Move 3

#### Peacekeeping Guard (Anti-Nephi-Lehies)
- Cost: 16 Stars
- Requirement: Faith 80+
- Role: extreme defense, low attack
- Base stats: HP 35, Atk 2, Def 10, Move 2
- Protective Aura: reduces damage taken by adjacent allied units when they are attacked (small but reliable mitigation).

#### Ancient Giant (Jaredites)
- Cost: 30 Stars
- Requirement: Pride 80+, Dissent 20+
- Role: high HP bruiser
- Base stats: HP 45, Atk 10, Def 5, Move 2

#### Amulonite Enforcer (Amulonites)
- Cost: 15 Stars
- Tech: Bronze Working
- Role: heavy intimidation infantry
- Base stats: HP 24, Atk 7, Def 6, Move 2

---

## 15) Technology Tree (By Tier)

Tech costs scale by how many techs you already have (as shown in the Tech panel), so research becomes progressively more expensive.

### Tier 1 (foundations)
- Organization (workers, farms)
- Forestry (lumber huts, clear forest)
- Hunting (scouts, slingers)
- Spirituality (shrines, temple, early religious powers)

### Tier 2 (expansion and specialization)
- Agriculture → Irrigation
- Husbandry
- Mining
- Woodcraft
- Construction
- Bronze Working
- Sailing → Seafaring → Fishing
- Trade
- Priesthood

### Tier 3 (elite systems)
- Philosophy
- Engineering
- Navigation
- Leadership

Each tech unlocks specific units/improvements/structures/abilities; use the tech panel to browse unlocks.

---

## 16) Victory Conditions

The game checks these conditions at end of turn:
- Faith Victory: reach Faith threshold (90+) while keeping Dissent low (under 10).
- Economic Victory: income >= 15 + 3x players, treasury >= 60 + 15x players, tech >= 75%.
- Cultural Victory: population >= 20 + 6x players, cultural sites (temple/shrine/library/academy/cathedral) >= 3 + players, Dissent <= 10.
- Territorial Victory: control most owned cities (about 80%; neutral cities do not count).
- Elimination Victory: only one player has cities remaining (if elimination is enabled).
- Turn Cap: if max turns are reached, the winner is determined by score (cities > faith > techs > units).

---

## 17) Strategy Quick Notes (High-leverage)

- **Roads first, then Trade**: roads give network income; Trade doubles it and unlocks trade routes.
- **Villages are long-term decisions**: conversion is an investment; conquest is a spike with instability.
- **Keep Dissent controlled**: high Dissent increases rebellion/desertion odds and can cut city income via unrest.
- **Faith is both economy and combat**: shrines/temples/cathedrals can be “military spending” indirectly.

---

## Implementation Status / Known Gaps (for developers)

These items are visible in data or UI but are not fully wired into gameplay yet:

- **Unit Production**: Lighthouse and Fortress list `unitProduction`, but it currently has no effect on unit cost, build time, or stats.
- **Data-only unit abilities** (no gameplay effect yet): `FAITHFUL_DEFENSE`, `YOUNG_VIGOR`, `PROTECTIVE_STANCE`, `FOREST_STEALTH`, `INTELLIGENCE`, `GIANT_STRENGTH`, `INTIMIDATE`, `SIEGE_BREAKER`, `PACIFIST_DEFENSE`, `NON_VIOLENCE`, `RANGED_ATTACK`.
- **Stubbed actions**: `COASTAL_EXPLORATION` is defined for boats but does not currently reveal map tiles or grant rewards.
