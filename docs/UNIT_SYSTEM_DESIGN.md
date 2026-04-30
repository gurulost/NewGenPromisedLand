# Unit System Design

Source of truth: unit availability, stats, costs, requirements, abilities, tags, and passive effects are defined in `shared/data/units.ts`. This document is a compact design reference for the current roster.

## Design Philosophy

Following The Battle of Polytopia's approach, the unit system features:
- **Common units** available to all factions (the backbone of gameplay)
- **Special units** unique to specific factions (strategic differentiation)
- **Balanced gameplay** where faction choice matters but doesn't lock out core functionality

## Unit Categories

### Common Units (Available to ALL Factions)

These units form the foundation of every faction's army and ensure all players have access to essential unit types:

1. **Warrior** (10 stars)
   - Basic melee unit with balanced stats
   - The backbone of any army
   - HP: 25, Attack: 6, Defense: 4, Movement: 3

2. **Scout** (6 stars, requires Hunting)
   - Fast reconnaissance with high vision
   - Essential for exploration and intelligence
   - HP: 12, Attack: 3, Defense: 2, Movement: 5, Vision: 4

3. **Slinger** (8 stars, requires Hunting)
   - Light ranged unit for early skirmishes
   - HP: 16, Attack: 4, Defense: 2, Movement: 3, Range: 2

4. **Worker** (5 stars, requires Organization)
   - Non-combat unit for improvements and resources
   - Critical for economic development
   - HP: 10, Attack: 1, Defense: 1, Movement: 2

5. **Guard** (14 stars)
   - Defensive specialist for protecting cities
   - High defense, low mobility
   - HP: 30, Attack: 4, Defense: 8, Movement: 2

6. **Commander** (25 stars, requires Leadership tech, Pride: 50)
   - Elite leadership unit with tactical bonuses
   - Late-game power unit
   - HP: 35, Attack: 8, Defense: 6, Movement: 3, Vision: 3

7. **Spearman** (12 stars, requires Bronze Working)
   - Frontline unit with anti-cavalry bonuses
   - HP: 20, Attack: 7, Defense: 5, Movement: 3

8. **Boat** (8 stars, requires Sailing)
   - Coastal transport and exploration
   - HP: 15, Attack: 3, Defense: 2, Movement: 4

9. **Catapult** (20 stars, requires Engineering)
   - Siege unit with long-range bombardment
   - HP: 12, Attack: 15, Defense: 2, Movement: 1, Range: 3

### Faction-Specific Special Units

Each faction has unique or faction-locked units that reflect its cultural identity and strategic focus:

#### Nephites
- **Stripling Warrior** (12 stars, requires Faith: 70)
  - Elite young warriors with divine protection
  - High defense, faith-based special abilities
- **Missionary** (8 stars, requires Priesthood tech, Faith: 60)
  - Conversion and healing specialist

#### Lamanites  
- **Wilderness Hunter** (13 stars, requires Pride: 40)
  - Forest warfare specialist with ranged attacks
  - Stealth, ambush tactics, range: 2
- **Converted Missionary** (10 stars, requires Priesthood tech, Faith: 40)
  - Influence unit that stabilizes Pride and Dissent

#### Mulekites & Zoramites
- **Royal Envoy** (15 stars)
  - Diplomatic unit for conversion and intelligence
  - High movement, special diplomatic abilities
- **Scribe-Teacher** (12 stars, requires Trade tech) [Mulekites]
  - Influence unit; improves trade request tempo
- **Priestcraft Preacher** (10 stars, requires Spirituality tech) [Zoramites]
  - Influence unit; boosts Stars with Pride/Dissent tradeoff

#### Anti-Nephi-Lehies
- **Missionary** (8 stars, requires Faith: 60)
  - Peaceful conversion and healing specialist
  - Shared with Nephites due to religious connection
- **Stripling Warrior** (12 stars, requires Faith: 70)
  - Shared with Nephites as a faith-forward defensive infantry option
- **Peacekeeping Guard** (16 stars, requires Faith: 80)
  - Ultimate defensive unit with pacifist principles
  - Extremely high defense, very low attack

#### Jaredites
- **Ancient Giant** (30 stars, requires Pride: 80, Dissent: 20)
  - Massive legendary warrior from ancient times
  - Highest stats but very expensive
- **Prophet** (12 stars, requires Spirituality tech)
  - Influence unit that reduces Dissent and (when Pride is high) Pride

#### Hagoth's Mariners
- **Voyager** (12 stars, requires Sailing)
  - Maritime scout and expedition vessel
  - Strong vision, coastal exploration, transport, and amphibious identity
- **Shipwright** (14 stars, requires Seafaring tech)
  - Influence unit that supports sea trade and shipbuilding capacity
  - Generates Stars with a small Pride tradeoff

#### Amulonites
- **Taskmaster** (12 stars, requires Organization)
  - Influence unit that extracts output at steep social and spiritual cost
  - Generates Stars while increasing Pride/Dissent and reducing Faith
- **Amulonite Enforcer** (15 stars, requires Bronze Working)
  - Heavy infantry with fortified defense and intimidation identity

## Strategic Balance

### Common Foundation
- All factions can build a complete army with common units
- No faction is locked out of essential unit roles
- Strategic diversity comes from special units, not unit availability

### Faction Differentiation
- Special units provide unique tactical options
- Requirements (Faith, Pride, Dissent) tie units to faction themes
- Cost and stat variations create different strategic focuses

### Economic Balance
- Common units are reasonably priced (5-25 stars)
- Special units range from cheap specialists (8 stars) to expensive elites (30 stars)
- Resource requirements add strategic depth without blocking access

## Implementation Benefits

1. **Improved Gameplay Balance**: No faction locked out of essential unit types
2. **Strategic Depth**: Special units provide meaningful choices
3. **Cultural Authenticity**: Units reflect Book of Mormon faction identities
4. **Scalability**: Easy to add new common or special units
5. **Polytopia-Style Feel**: Familiar structure with thematic adaptation

## Future Expansion

The system is designed to easily accommodate:
- Additional common units (archers, cavalry, siege engines)
- More faction specials (1-2 more per faction)
- Tech-gated advanced units
- Promoted/veteran unit variants

## Implementation Status / Known Gaps

Items defined in data but not fully implemented in gameplay yet:

- **Ability identifiers that still need resolver/effect review before treating them as fully implemented**: `INTELLIGENCE`, `GIANT_STRENGTH`, `SIEGE_BREAKER`, `PACIFIST_DEFENSE`, `NON_VIOLENCE`.
- **Unit production modifiers** from structures such as Lighthouse/Fortress still need a clear gameplay contract for cost, build time, or unit-stat effects.
- **Future faction/unit additions** should update `shared/data/units.ts`, `docs/PLAYER_REFERENCE.md`, and this design reference in the same change.
