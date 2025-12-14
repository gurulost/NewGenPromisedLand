import { nanoid } from 'nanoid';
import { GameState } from '../types/game';
import { HexCoordinate } from '../types/coordinates';
import { Unit } from '../types/unit';
import { City } from '../types/city';
import { getWorldElement, RuinReward } from '../data/worldElements';
import { getUnitDefinition, UNIT_DEFINITIONS } from '../data/units';
import { getAvailableTechnologies, TECHNOLOGIES } from '../data/technologies';
import type { UnitType } from '../types/unit';

type WeightedRuinReward = RuinReward & { weight: number };

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
    return unitType === 'commander' && unitDef.abilities.includes('NAVAL_COMMAND');
  }

  return false;
}

/**
 * Execute immediate harvest/exploit action on world element
 */
export function executeElementHarvest(
  gameState: GameState,
  playerId: string,
  elementId: string,
  coordinate: HexCoordinate
): WorldElementActionResult {
  const element = getWorldElement(elementId);
  if (!element || !element.immediateAction) {
    return {
      success: false,
      message: 'Cannot harvest this element',
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
      message: `Requires ${element.techPrerequisite} technology`,
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
        message: `Requires unit with ${action.requiresUnitTag} capability on this tile`,
        resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
      };
    }
  }

  // Special handling for Jaredite Ruins
  if (elementId === 'jaredite_ruins') {
    return executeRuinExploration(gameState, playerId, coordinate);
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
        ? { ...city, population: Math.min(20, city.population + action.popDelta) }
        : city
    ) || []
  };

  // Transform tile if specified
  if (action.tileTransform) {
    newState.map.tiles = newState.map.tiles.map(tile =>
      tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
        ? {
          ...tile,
          terrain: action.tileTransform as any,
          resources: [] // Remove the resource after harvesting
        }
        : tile
    );
  }

  return {
    success: true,
    message: `${action.name} completed - ${getImpactMessage(action.prideDelta, action.faithDelta)}${action.popDelta > 0 && closestCity ? ` (+${action.popDelta} population to ${closestCity.name})` : ''
      }`,
    newState,
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

  // Check tech prerequisite
  if (element.techPrerequisite && !player.researchedTechs.includes(element.techPrerequisite)) {
    return {
      success: false,
      message: `Requires ${element.techPrerequisite} technology`,
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  // Check if player has enough stars
  if (player.stars < build.costStars) {
    return {
      success: false,
      message: `Need ${build.costStars} stars to build ${build.name}`,
      resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
    };
  }

  // Apply costs and benefits
  const newState = {
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

  // Add improvement to map (this will need to integrate with existing improvement system)
  // For now, we'll transform the tile to indicate the improvement was built
  newState.map.tiles = newState.map.tiles.map(tile =>
    tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
      ? {
        ...tile,
        resources: [`${elementId}_improved`] // Mark as improved
      }
      : tile
  );

  return {
    success: true,
    message: `${build.name} constructed - ${getImpactMessage(build.prideDelta, build.faithDelta)}`,
    newState,
    resourceDeltas: {
      stars: -build.costStars,
      faith: build.faithDelta,
      pride: build.prideDelta,
      dissent: build.dissentDelta,
      population: build.effectPermanent.popDelta
    }
  };
}

/**
 * Handle Jaredite Ruin exploration with random rewards
 */
function executeRuinExploration(
  gameState: GameState,
  playerId: string,
  coordinate: HexCoordinate
): WorldElementActionResult {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return {
    success: false,
    message: 'Player not found',
    resourceDeltas: { stars: 0, faith: 0, pride: 0, dissent: 0 }
  };

  // Always grant +1 Faith for exploring sacred history
  const faithGain = 1;
  const reward = pickWeightedRuinReward(getRuinRewardPool(gameState, playerId), Math.random());

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
        const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
        message += ` and discovered ${randomTech.name} technology scroll!`;
        reward.techId = randomTech.id;

        // Update player
        newPlayers = newPlayers.map(p =>
          p.id === playerId
            ? { ...p, researchedTechs: [...p.researchedTechs, randomTech.id] }
            : p
        );
      } else {
        // Fallback to stars if no tech available
        starGain = 20;
        reward.type = 'stars';
        reward.value = 20;
        message += ` and found 20 stars (all tech researched)!`;
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
        id: nanoid(),
        type: unitType,
        playerId,
        coordinate: { ...coordinate },
        hp: unitDef.baseStats.hp,
        maxHp: unitDef.baseStats.hp,
        attack: unitDef.baseStats.attack,
        defense: unitDef.baseStats.defense,
        movement: unitDef.baseStats.movement,
        remainingMovement: 0, // Summoned units delay
        status: 'active',
        abilities: [...(unitDef.abilities || [])],
        level: 1,
        experience: 0,
        visionRadius: unitDef.baseStats.visionRadius,
        attackRange: unitDef.baseStats.attackRange,
        hasAttacked: false
      };
      newUnits.push(newUnit);
      break;
    }

    case 'reveal': {
      // Find nearest enemy city
      const enemyCities: City[] = gameState.cities.filter(c => !player.citiesOwned.includes(c.id));

      let closestEnemyCity: City | null = null;
      let minDistance = Infinity;

      enemyCities.forEach(city => {
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
        const enemyCity = closestEnemyCity as City; // Type assertion for TypeScript
        message += ` and revealed the location of an enemy city!`;
        const cityCoordKey = `${enemyCity.coordinate.q},${enemyCity.coordinate.r}`;

        if (!player.exploredTiles.includes(cityCoordKey)) {
          newPlayers = newPlayers.map(p =>
            p.id === playerId
              ? { ...p, exploredTiles: [...p.exploredTiles, cityCoordKey] }
              : p
          );
        }
      } else {
        // Fallback if no enemies
        starGain = 10;
        reward.type = 'stars';
        reward.value = 10;
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
        ? { ...city, population: Math.min(20, city.population + popGain) }
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
  actionType: 'harvest' | 'build'
): { canExecute: boolean; reason?: string } {
  const element = getWorldElement(elementId);
  if (!element) {
    return { canExecute: false, reason: 'Unknown element' };
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return { canExecute: false, reason: 'Player not found' };
  }

  // Check tech prerequisite
  if (element.techPrerequisite && !player.researchedTechs.includes(element.techPrerequisite)) {
    return { canExecute: false, reason: `Requires ${element.techPrerequisite} technology` };
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

    // Check if player has enough stars
    if (player.stars < element.longTermBuild.costStars) {
      return { canExecute: false, reason: `Need ${element.longTermBuild.costStars} stars` };
    }

    return { canExecute: true };
  }

  return { canExecute: false, reason: 'Invalid action type' };
}
