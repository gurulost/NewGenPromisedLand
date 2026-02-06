import { GameState } from '../types/game';
import { HexCoordinate } from '../types/coordinates';
import { Unit } from '../types/unit';
import { City } from '../types/city';
import { getWorldElement, RuinReward } from '../data/worldElements';
import { getUnitDefinition, UNIT_DEFINITIONS } from '../data/units';
import { getAvailableTechnologies, TECHNOLOGIES } from '../data/technologies';
import type { UnitType } from '../types/unit';
import { applyPopulationGain } from './cityGrowth';
import { emitTelemetry } from './telemetry';
import { getUnitActionsRemaining, getUnitAttackRangeFromDefinition } from './unitLogic';

type WeightedRuinReward = RuinReward & { weight: number };

const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
const hasAbility = (abilities: string[] | undefined, abilityId: string) =>
  (abilities || []).some(ability => normalizeAbility(String(ability)) === normalizeAbility(abilityId));

function createRngId(rng: () => number, prefix: string): string {
  return `${prefix}_${Math.floor(rng() * 1e9).toString(36)}`;
}

function pickWeightedRuinReward(rewards: WeightedRuinReward[], roll: number): RuinReward {
  if (rewards.length === 0) {
    return { type: 'stars', value: 10, description: '10 Star cache discovered' };
  }

  const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
  if (totalWeight <= 0) {
    const { weight: _w, ...fallback } = rewards[0];
    return fallback;
  }

  let selector = Math.max(0, Math.min(0.999999, roll)) * totalWeight;
  for (const reward of rewards) {
    selector -= reward.weight;
    if (selector <= 0) {
      const { weight: _w, ...picked } = reward;
      return picked;
    }
  }

  const { weight: _w, ...last } = rewards[rewards.length - 1];
  return last;
}

function getRuinRewardPool(gameState: GameState, playerId: string): WeightedRuinReward[] {
  const hasGiantAlready = gameState.units.some(u => u.playerId === playerId && u.type === 'ancient_giant');
  const canSpawnGiant = gameState.turn >= 20 && !hasGiantAlready;

  // Units from ruins are intentionally rare; Ancient Giants are legendary and gated out of early-game snowball.
  const giantWeight = canSpawnGiant ? (gameState.turn >= 70 ? 3 : gameState.turn >= 40 ? 2 : 1) : 0;
  const warriorWeight = Math.max(0, 5 - giantWeight); // keep total unit chance ~5% but shift to giants later

  const pool: WeightedRuinReward[] = [
    { type: 'tech', description: 'Free Technology Scroll', techId: 'random', weight: 35 },
    { type: 'population', value: 3, description: '+3 Population to nearest city', weight: 24 },
    { type: 'stars', value: 15, description: '15 Star cache discovered', weight: 24 },
    { type: 'reveal', description: 'Nearest enemy capital revealed', weight: 12 },
  ];

  if (warriorWeight > 0) {
    pool.push({ type: 'unit', unitType: 'warrior', description: 'Ancient Ally joins your cause', weight: warriorWeight });
  }
  if (giantWeight > 0) {
    pool.push({ type: 'unit', unitType: 'ancient_giant', description: 'Ancient Giant awakens', weight: giantWeight });
  }

  return pool;
}

function parseTutorialFixedRuinReward(resources: string[] | undefined): RuinReward | null {
  if (!resources || resources.length === 0) return null;

  const candidates = resources.filter((r) =>
    String(r).startsWith('tutorial:episode1:ruin_reward:') ||
    String(r).startsWith('tutorial:ruin_reward:')
  );
  if (candidates.length === 0) return null;

  const marker = String(candidates[0]);
  const parts = marker.split(':');
  // Supported patterns:
  // - tutorial:episode1:ruin_reward:stars:15
  // - tutorial:ruin_reward:stars:15
  const isEpisode = parts[0] === 'tutorial' && parts[1] === 'episode1' && parts[2] === 'ruin_reward';
  const isLegacy = parts[0] === 'tutorial' && parts[1] === 'ruin_reward';

  const typeIndex = isEpisode ? 3 : isLegacy ? 2 : -1;
  const valueIndex = typeIndex >= 0 ? typeIndex + 1 : -1;
  if (typeIndex < 0 || valueIndex < 0) return null;

  const rewardType = parts[typeIndex] as RuinReward['type'] | undefined;
  const rawValue = parts[valueIndex];
  const value = rawValue ? Number.parseInt(rawValue, 10) : NaN;
  if (!rewardType || !Number.isFinite(value)) return null;

  if (rewardType === 'stars') {
    const stars = Math.max(0, value);
    return { type: 'stars', value: stars, description: `${stars} Star cache discovered` };
  }

  if (rewardType === 'population') {
    const pop = Math.max(0, value);
    return { type: 'population', value: pop, description: `+${pop} Population to nearest city` };
  }

  return null;
}

export interface WorldElementActionResult {
  success: boolean;
  message: string;
  newState?: GameState;
  resourceDeltas: {
    stars: number;
    faith: number;
    pride: number;
    dissent: number;
    population?: number;
  };
  effects?: {
    tileTransformed?: boolean;
    newTerrain?: string;
    ruinReward?: RuinReward;
  };
}

/**
 * Check if unit type has required tag for special actions
 */
function hasRequiredTag(unitType: UnitType, requiredTag: string): boolean {
  const unitDef = getUnitDefinition(unitType);

  // Naval commander tag check for sea beast harvesting
  if (requiredTag === 'naval_commander') {
    return unitType === 'commander' && hasAbility(unitDef.abilities, 'NAVAL_COMMAND');
  }

  if (requiredTag === 'naval_transport') {
    return unitType === 'boat' || hasAbility(unitDef.abilities, 'NAVAL_TRANSPORT');
  }

  return false;
}

function formatTechnologyName(techId?: string): string {
  if (!techId) return 'Unknown technology';
  return TECHNOLOGIES[techId]?.name || techId;
}

function getUnitRequirementMessage(
  elementId: string,
  actionType: 'harvest' | 'build',
  requiredTag?: string
): string {
  if (requiredTag) {
    if (requiredTag === 'naval_commander') {
      return 'Requires a Naval Commander on this tile (Commander with Naval Command)';
    }
    if (requiredTag === 'naval_transport') {
      return 'Requires a naval transport unit on this tile';
    }
    return `Requires a unit with ${requiredTag} capability on this tile`;
  }

  if (actionType === 'harvest' && elementId === 'jaredite_ruins') {
    return 'Requires any unit on this tile';
  }

  return 'Requires a Worker on this tile';
}

/**
 * Execute immediate harvest/exploit action on world element
 */
export function executeElementHarvest(
  gameState: GameState,
  playerId: string,
  elementId: string,
  coordinate: HexCoordinate,
  rng: () => number = Math.random
): WorldElementActionResult {
  const element = getWorldElement(elementId);
  if (!element || !element.immediateAction) {
    return {
      success: false,
      message: 'Cannot harvest this element',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const tileAt = gameState.map.tiles.find(tile =>
    tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
  );
  const hasElementAtTile =
    !!tileAt &&
    (tileAt.feature === (elementId as any) || (tileAt.resources || []).includes(elementId));
  if (!hasElementAtTile) {
    return {
      success: false,
      message: 'No such element at this location',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const markerPrefix = `we:${elementId}:`;
  const hasBuildMarker = (tileAt.resources || []).some(r => String(r).startsWith(markerPrefix));
  if (hasBuildMarker) {
    return {
      success: false,
      message: 'Already developed',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return {
      success: false,
      message: 'Player not found',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const action = element.immediateAction;

  // Check tech prerequisite
  if (element.techPrerequisite && !player.researchedTechs.includes(element.techPrerequisite)) {
    return {
      success: false,
      message: `Requires ${formatTechnologyName(element.techPrerequisite)} technology`,
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  // Check unit tag requirement (Sea Beast Harvesting needs naval_commander)
  if (action.requiresUnitTag) {
    const requiredUnits = gameState.units.filter(unit =>
      unit.playerId === playerId &&
      unit.coordinate.q === coordinate.q &&
      unit.coordinate.r === coordinate.r &&
      hasRequiredTag(unit.type as UnitType, action.requiresUnitTag!)
    );

    if (requiredUnits.length === 0) {
      return {
        success: false,
        message: getUnitRequirementMessage(elementId, 'harvest', action.requiresUnitTag),
        resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
      };
    }
  }

  // Special handling for Jaredite Ruins
  if (elementId === 'jaredite_ruins') {
    return executeRuinExploration(gameState, playerId, coordinate, rng);
  }

  // Find nearest city to receive population bonus
  const playerCities = gameState.cities?.filter(city =>
    player.citiesOwned.includes(city.id)
  ) || [];

  let closestCity = null;
  if (playerCities.length > 0) {
    closestCity = playerCities[0];
    let closestDistance = Math.sqrt(
      Math.pow(coordinate.q - closestCity.coordinate.q, 2) +
      Math.pow(coordinate.r - closestCity.coordinate.r, 2)
    );

    for (const city of playerCities) {
      const distance = Math.sqrt(
        Math.pow(coordinate.q - city.coordinate.q, 2) +
        Math.pow(coordinate.r - city.coordinate.r, 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCity = city;
      }
    }
  }

  // Apply resource changes with bounds checking
  const newState = {
    ...gameState,
    players: gameState.players.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: Math.max(0, p.stars + action.starsDelta),
          stats: {
            ...p.stats,
            faith: Math.min(100, Math.max(0, p.stats.faith + action.faithDelta)),
            pride: Math.min(100, Math.max(0, p.stats.pride + action.prideDelta)),
            internalDissent: Math.min(100, Math.max(0, p.stats.internalDissent + action.dissentDelta))
          }
        }
        : p
    ),
    cities: gameState.cities?.map(city =>
      city.id === closestCity?.id && action.popDelta > 0
        ? applyPopulationGain(city, action.popDelta)
        : city
    ) || []
  };

  // Transform tile if specified
  const updatedState = action.tileTransform
    ? {
      ...newState,
      map: {
        ...newState.map,
        tiles: newState.map.tiles.map(tile =>
          tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
            ? {
              ...tile,
              terrain: action.tileTransform as any,
              resources: [] // Remove the resource after harvesting
            }
            : tile
        )
      }
    }
    : newState;

  return {
    success: true,
    message: `${action.name} completed - ${getImpactMessage(action.prideDelta, action.faithDelta)}${action.popDelta > 0 && closestCity ? ` (+${action.popDelta} population to ${closestCity.name})` : ''
      }`,
    newState: updatedState,
    resourceDeltas: {
      stars: action.starsDelta,
      faith: action.faithDelta,
      pride: action.prideDelta,
      dissent: action.dissentDelta,
      population: action.popDelta || 0
    },
    effects: {
      tileTransformed: !!action.tileTransform,
      newTerrain: action.tileTransform
    }
  };
}

/**
 * Execute long-term building action on world element
 */
export function executeElementBuild(
  gameState: GameState,
  playerId: string,
  elementId: string,
  coordinate: HexCoordinate
): WorldElementActionResult {
  const element = getWorldElement(elementId);
  if (!element || !element.longTermBuild) {
    return {
      success: false,
      message: 'Cannot build on this element',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return {
      success: false,
      message: 'Player not found',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const build = element.longTermBuild;

  const targetTile = gameState.map.tiles.find(tile =>
    tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
  );
  if (!targetTile) {
    return {
      success: false,
      message: 'Tile not found',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const hasElementAtTile =
    targetTile.feature === (elementId as any) || (targetTile.resources || []).includes(elementId);
  if (!hasElementAtTile) {
    return {
      success: false,
      message: 'No such element at this location',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  // Check tech prerequisite
  if (element.techPrerequisite && !player.researchedTechs.includes(element.techPrerequisite)) {
    return {
      success: false,
      message: `Requires ${formatTechnologyName(element.techPrerequisite)} technology`,
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const playerCities = gameState.cities?.filter(city => player.citiesOwned.includes(city.id)) || [];
  if (playerCities.length === 0) {
    return {
      success: false,
      message: 'You need a city to benefit from world improvements',
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  const findClosestCity = (): City => {
    let closestCity = playerCities[0];
    let closestDistance = Infinity;
    for (const city of playerCities) {
      const dist = Math.sqrt(
        Math.pow(coordinate.q - city.coordinate.q, 2) +
        Math.pow(coordinate.r - city.coordinate.r, 2)
      );
      if (dist < closestDistance) {
        closestDistance = dist;
        closestCity = city;
      }
    }
    return closestCity;
  };

  const markerPrefix = `we:${elementId}:`;
  const existingMarker = (targetTile.resources || []).find(r => String(r).startsWith(markerPrefix));
  const baseMarker = `${markerPrefix}${build.name}`;

  const closestCity = findClosestCity();
  const baseStarsPerTurn = build.effectPermanent?.starsPerTurn || 0;
  const basePopDelta = build.effectPermanent?.popDelta || 0;

  const applyCityDeltas = (state: GameState, popDelta: number, starsPerTurnDelta: number): GameState => ({
    ...state,
    cities: (state.cities || []).map(city => {
      if (city.id !== closestCity.id) return city;
      const grownCity = applyPopulationGain(city, popDelta);
      return {
        ...grownCity,
        starProduction: Math.max(0, (grownCity.starProduction || 0) + starsPerTurnDelta)
      };
    })
  });

  // Upgrade path: convert marker -> upgraded marker, apply delta to city production.
  if (existingMarker) {
    const upgrade = build.upgrade;
    if (
      upgrade &&
      player.researchedTechs.includes(upgrade.techRequired) &&
      existingMarker === baseMarker
    ) {
      const upgradeCost = upgrade.costStars || 0;
      if (player.stars < upgradeCost) {
        return {
          success: false,
          message: `Need ${upgradeCost} stars to upgrade to ${upgrade.structure}`,
          resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
        };
      }

      const upgradedStarsPerTurn = upgrade.effectPermanent?.starsPerTurn || 0;
      const upgradedPopDelta = upgrade.effectPermanent?.popDelta || 0;
      const starsDelta = upgradedStarsPerTurn - baseStarsPerTurn;
      const popDelta = upgradedPopDelta - basePopDelta;

      let stateWithCity: GameState = applyCityDeltas(gameState, popDelta, starsDelta);
      if (upgradeCost > 0) {
        stateWithCity = {
          ...stateWithCity,
          players: stateWithCity.players.map(p =>
            p.id === playerId ? { ...p, stars: Math.max(0, p.stars - upgradeCost) } : p
          )
        };
      }
      stateWithCity = {
        ...stateWithCity,
        map: {
          ...stateWithCity.map,
          tiles: stateWithCity.map.tiles.map(tile =>
            tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
              ? {
                ...tile,
                resources: [
                  ...(tile.resources || []).filter(r => !String(r).startsWith(markerPrefix)),
                  `${markerPrefix}${upgrade.structure}`
                ]
              }
              : tile
          )
        }
      };

      return {
        success: true,
        message: `${upgrade.structure} upgraded - prosperity increases`,
        newState: stateWithCity,
        resourceDeltas: { stars: -upgradeCost, faith: 0, pride: 0, dissent: 0, population: popDelta }
      };
    }

    return {
      success: false,
      message: `${build.name} already constructed here`,
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  // Check if player has enough stars (base build)
  if (player.stars < build.costStars) {
    return {
      success: false,
      message: `Need ${build.costStars} stars to build ${build.name}`,
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  // Apply costs and benefits
  let newState: GameState = {
    ...gameState,
    players: gameState.players.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: p.stars - build.costStars,
          stats: {
            ...p.stats,
            faith: Math.min(100, Math.max(0, p.stats.faith + build.faithDelta)),
            pride: Math.min(100, Math.max(0, p.stats.pride + build.prideDelta)),
            internalDissent: Math.min(100, Math.max(0, p.stats.internalDissent + build.dissentDelta))
          }
        }
        : p
    )
  };

  newState = applyCityDeltas(newState, basePopDelta, baseStarsPerTurn);

  // Mark the tile as improved (used to gate upgrades and prevent rebuild spam)
  newState = {
    ...newState,
    map: {
      ...newState.map,
      tiles: newState.map.tiles.map(tile =>
        tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
          ? {
            ...tile,
            resources: [...(tile.resources || []), baseMarker]
          }
          : tile
      )
    }
  };

  return {
    success: true,
    message: `${build.name} constructed - ${getImpactMessage(build.prideDelta, build.faithDelta)}${basePopDelta > 0 ? ` (+${basePopDelta} population to ${closestCity.name})` : ''}`,
    newState,
    resourceDeltas: {
      stars: -build.costStars,
      faith: build.faithDelta,
      pride: build.prideDelta,
      dissent: build.dissentDelta,
      population: basePopDelta
    }
  };
}

/**
 * Handle Jaredite Ruin exploration with random rewards
 */
function executeRuinExploration(
  gameState: GameState,
  playerId: string,
  coordinate: HexCoordinate,
  rng: () => number
): WorldElementActionResult {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return {
    success: false,
    message: 'Player not found',
    resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
  };

  // Always grant +1 Faith for exploring sacred history
  const faithGain = 1;
  const tileAt = gameState.map.tiles.find(
    (tile) => tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
  );
  const fixedReward = parseTutorialFixedRuinReward(tileAt?.resources);
  const reward = fixedReward ?? pickWeightedRuinReward(getRuinRewardPool(gameState, playerId), rng());

  let starGain = 0;
  let popGain = 0;
  let message = `Ruins explored - discovered ancient Jaredite history (+1 Faith)`;

  // Clone state parts we might modify
  let newPlayers = [...gameState.players];
  let newUnits = [...gameState.units];
  const newTiles = [...gameState.map.tiles];

  // Apply specific reward
  switch (reward.type) {
    case 'stars':
      starGain = reward.value || 15;
      message += ` and found ${starGain} stars in treasure cache!`;
      break;

    case 'population':
      popGain = reward.value || 3;
      message += ` and gained ${popGain} population from ancient knowledge!`;
      break;

    case 'tech': {
      const availableTechs = getAvailableTechnologies(player.researchedTechs);
      if (availableTechs.length > 0) {
        const randomTech = availableTechs[Math.floor(rng() * availableTechs.length)];
        message += ` and discovered ${randomTech.name} technology scroll!`;
        reward.techId = randomTech.id;

        // Update player
        newPlayers = newPlayers.map(p =>
          p.id === playerId
            ? { ...p, researchedTechs: [...p.researchedTechs, randomTech.id] }
            : p
        );

        emitTelemetry({
          channel: 'technology',
          status: 'success',
          playerId,
          technologyId: randomTech.id,
          reason: 'ruin_reward',
          metadata: { source: 'jaredite_ruins' }
        });
      } else {
        // Fallback to stars if no tech available
        starGain = 20;
        reward.type = 'stars';
        reward.value = 20;
        message += ` and found 20 stars (all tech researched)!`;

        emitTelemetry({
          channel: 'technology',
          status: 'info',
          playerId,
          reason: 'ruin_reward_unavailable',
          metadata: { source: 'jaredite_ruins' }
        });
      }
      break;
    }

    case 'unit': {
      const unitType = (reward.unitType || 'warrior') as UnitType;
      const unitDef = UNIT_DEFINITIONS[unitType];
      if (!unitDef) break;

      const label = unitType === 'ancient_giant' ? 'an Ancient Giant' : 'an Ancient Ally';
      message += ` and awakened ${label}!`;

      const newUnit: Unit = {
        id: createRngId(rng, "unit"),
        type: unitType,
        playerId,
        coordinate: { ...coordinate },
        hp: unitDef.baseStats.hp,
        maxHp: unitDef.baseStats.hp,
        attack: unitDef.baseStats.attack,
        defense: unitDef.baseStats.defense,
        movement: unitDef.baseStats.movement,
        remainingMovement: 0, // Summoned units delay
        maxActions: unitDef.baseStats.actions,
        actionsRemaining: 0,
        status: 'active',
        abilities: [...(unitDef.abilities || [])],
        level: 1,
        experience: 0,
        visionRadius: unitDef.baseStats.visionRadius,
        attackRange: getUnitAttackRangeFromDefinition(unitDef),
        hasAttacked: true
      };
      newUnits.push(newUnit);
      break;
    }

    case 'reveal': {
      const enemyCities: City[] = gameState.cities.filter(
        c => c.ownerId && c.ownerId !== playerId
      );
      const unseenEnemyCities = enemyCities.filter(city => {
        const key = `${city.coordinate.q},${city.coordinate.r}`;
        return !player.exploredTiles.includes(key);
      });
      const candidateCities = unseenEnemyCities.length > 0 ? unseenEnemyCities : [];

      let closestEnemyCity: City | null = null;
      let minDistance = Infinity;

      candidateCities.forEach(city => {
        const dist = Math.sqrt(
          Math.pow(city.coordinate.q - coordinate.q, 2) +
          Math.pow(city.coordinate.r - coordinate.r, 2)
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestEnemyCity = city;
        }
      });

      if (closestEnemyCity !== null) {
        const enemyCity = closestEnemyCity as City;
        message += ` and revealed the location of an enemy city!`;
        const cityCoordKey = `${enemyCity.coordinate.q},${enemyCity.coordinate.r}`;

        if (!player.exploredTiles.includes(cityCoordKey)) {
          newPlayers = newPlayers.map(p =>
            p.id === playerId
              ? { ...p, exploredTiles: [...p.exploredTiles, cityCoordKey] }
              : p
          );
        }
        for (let i = 0; i < newTiles.length; i++) {
          const tile = newTiles[i];
          if (tile.coordinate.q === enemyCity.coordinate.q && tile.coordinate.r === enemyCity.coordinate.r) {
            if (!tile.exploredBy.includes(playerId)) {
              newTiles[i] = { ...tile, exploredBy: [...tile.exploredBy, playerId] };
            }
            break;
          }
        }
      } else {
        // Fallback if no unseen enemy cities remain
        starGain = 10;
        reward.type = 'stars';
        reward.value = 10;
        reward.description = 'No new enemy cities remain; ancient maps point to a small cache of stars.';
        message += ` and found 10 stars!`;
      }
      break;
    }
  }

  // Find nearest city for population reward
  let closestCity: City | null = null;
  if (popGain > 0) {
    const playerCities = gameState.cities.filter(city => player.citiesOwned.includes(city.id));
    if (playerCities.length > 0) {
      closestCity = playerCities[0];
      let closestDist = Infinity;
      playerCities.forEach(city => {
        const d = Math.sqrt(Math.pow(city.coordinate.q - coordinate.q, 2) + Math.pow(city.coordinate.r - coordinate.r, 2));
        if (d < closestDist) {
          closestDist = d;
          closestCity = city;
        }
      });
    } else {
      // No cities to grow - convert population reward into a small star cache.
      const fallbackStars = 10;
      starGain += fallbackStars;
      popGain = 0;
      reward.type = 'stars';
      reward.value = fallbackStars;
      reward.description = `Ancient records offer no city to bless; you recover ${fallbackStars} stars instead.`;
      message += ` With no city to grow, you instead recover ${fallbackStars} stars.`;
    }
  }

  // Construct Final State
  const finalState: GameState = {
    ...gameState,
    players: newPlayers.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: p.stars + starGain,
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + faithGain)
          }
        }
        : p
    ),
    units: newUnits,
    cities: gameState.cities.map(city =>
      city.id === closestCity?.id && popGain > 0
        ? applyPopulationGain(city, popGain)
        : city
    ),
    map: {
      ...gameState.map,
      tiles: newTiles.map(tile =>
        tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
          ? { ...tile, resources: [] } // Remove ruin
          : tile
      )
    }
  };

  return {
    success: true,
    message,
    newState: finalState,
    resourceDeltas: {
      stars: starGain,
      faith: faithGain,
      pride: 0,
      dissent: 0,
      population: popGain
    },
    effects: {
      tileTransformed: true,
      newTerrain: 'plains',
      ruinReward: reward
    }
  };
}

/**
 * Generate impact message based on moral choice consequences
 */
function getImpactMessage(prideDelta: number, faithDelta: number): string {
  if (prideDelta > 0) {
    return "Your prideful exploitation increases internal dissent";
  } else if (faithDelta > 0) {
    return "Your faithful stewardship strengthens spiritual bonds";
  }
  return "A practical choice with measured consequences";
}

/**
 * Check if element action is available for player
 */
export function canExecuteElementAction(
  gameState: GameState,
  playerId: string,
  elementId: string,
  actionType: 'harvest' | 'build',
  coordinate?: HexCoordinate,
  unitId?: string
): { canExecute: boolean; reason?: string } {
  const element = getWorldElement(elementId);
  if (!element) {
    return { canExecute: false, reason: 'Unknown element' };
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return { canExecute: false, reason: 'Player not found' };
  }

  // Unit gating: world elements are interacted with by units standing on the tile.
  // Default is Worker-only, except for ruins exploration; some elements require special tags (e.g., naval_commander).
  if (coordinate) {
    const tile = gameState.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);
    if (!tile) return { canExecute: false, reason: 'Tile not found' };

    const hasElementAtTile =
      tile.feature === (elementId as any) || (tile.resources || []).includes(elementId);
    if (!hasElementAtTile) return { canExecute: false, reason: 'Element not present' };

    const markerPrefix = `we:${elementId}:`;
    const hasBuildMarker = (tile.resources || []).some(r => String(r).startsWith(markerPrefix));
    if (actionType === 'harvest' && hasBuildMarker) {
      return { canExecute: false, reason: 'Already developed' };
    }

    const unitsOnTile = gameState.units.filter(u =>
      u.playerId === playerId &&
      u.coordinate.q === coordinate.q &&
      u.coordinate.r === coordinate.r
    );
    const actingUnit = unitId ? unitsOnTile.find(u => u.id === unitId) : unitsOnTile[0];
    const requiresUnitTag = actionType === 'harvest'
      ? element.immediateAction?.requiresUnitTag
      : element.longTermBuild?.requiresUnitTag;
    if (!actingUnit) {
      return { canExecute: false, reason: getUnitRequirementMessage(elementId, actionType, requiresUnitTag) };
    }
    if (getUnitActionsRemaining(actingUnit) <= 0) return { canExecute: false, reason: 'Unit is exhausted' };

    if (requiresUnitTag) {
      if (!hasRequiredTag(actingUnit.type as UnitType, requiresUnitTag)) {
        return { canExecute: false, reason: getUnitRequirementMessage(elementId, actionType, requiresUnitTag) };
      }
    } else {
      const requiresWorker = elementId !== 'jaredite_ruins';
      if (requiresWorker && actingUnit.type !== 'worker') {
        return { canExecute: false, reason: getUnitRequirementMessage(elementId, actionType) };
      }
    }
  }

  // Check tech prerequisite
  if (element.techPrerequisite && !player.researchedTechs.includes(element.techPrerequisite)) {
    return { canExecute: false, reason: `Requires ${formatTechnologyName(element.techPrerequisite)} technology` };
  }

  if (actionType === 'harvest') {
    if (!element.immediateAction) {
      return { canExecute: false, reason: 'No harvest action available' };
    }
    return { canExecute: true };
  } else if (actionType === 'build') {
    if (!element.longTermBuild) {
      return { canExecute: false, reason: 'No build action available' };
    }

    const playerCities = gameState.cities?.filter(city => player.citiesOwned.includes(city.id)) || [];
    if (playerCities.length === 0) {
      return { canExecute: false, reason: 'Requires an owned city' };
    }

    // If we can see the tile, gate on whether it is already improved/upgradeable.
    if (coordinate) {
      const tile = gameState.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);
      if (tile) {
        const markerPrefix = `we:${elementId}:`;
        const existingMarker = (tile.resources || []).find(r => String(r).startsWith(markerPrefix));
        const baseMarker = `${markerPrefix}${element.longTermBuild.name}`;

        if (existingMarker) {
          const upgrade = element.longTermBuild.upgrade;
          if (upgrade && existingMarker === baseMarker && player.researchedTechs.includes(upgrade.techRequired)) {
            const upgradeCost = upgrade.costStars || 0;
            if (player.stars < upgradeCost) return { canExecute: false, reason: `Need ${upgradeCost} stars` };
            return { canExecute: true };
          }
          return { canExecute: false, reason: 'Already constructed' };
        }
      }
    }

    // Base build: check stars
    if (player.stars < element.longTermBuild.costStars) {
      return { canExecute: false, reason: `Need ${element.longTermBuild.costStars} stars` };
    }

    return { canExecute: true };
  }

  return { canExecute: false, reason: 'Invalid action type' };
}
