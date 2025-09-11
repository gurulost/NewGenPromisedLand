/**
 * World Element Actions - Handles moral choices for Book of Mormon themed resources
 * Each action affects Faith/Pride/Dissent creating strategic moral decisions
 */

import { GameState } from '../types/game';
import { HexCoordinate } from '../types/coordinates';
import { getWorldElement, RUIN_REWARDS, RuinReward } from '../data/worldElements';
import { getUnitDefinition } from '../data/units';
import { getAvailableTechnologies } from '../data/technologies';
import type { UnitType } from '../types/unit';

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
    technologyGranted?: string;
    unitCreated?: string;
    capitalsRevealed?: string[];
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
  
  // Explorer tag for special exploration abilities
  if (requiredTag === 'explorer') {
    return unitType === 'scout' || unitType === 'commander';
  }
  
  // Religious leader tag for faith-based actions
  if (requiredTag === 'religious_leader') {
    return unitDef.abilities.includes('BLESSING') || unitDef.abilities.includes('CONVERSION');
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
    message: `${action.name} completed - ${getImpactMessage(action.prideDelta, action.faithDelta)}${
      action.popDelta > 0 && closestCity ? ` (+${action.popDelta} population to ${closestCity.name})` : ''
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
  // Always grant +1 Faith for exploring sacred history
  const faithGain = 1;
  
  // Random reward selection
  const rewardIndex = Math.floor(Math.random() * RUIN_REWARDS.length);
  const reward = RUIN_REWARDS[rewardIndex];
  
  let starGain = 0;
  let popGain = 0;
  let message = `Ruins explored - discovered ancient Jaredite history (+1 Faith)`;
  
  // Track effect results
  let grantedTechId: string | undefined;
  let createdUnitId: string | undefined;
  let revealedCapitalId: string | undefined;

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
      // Grant random available technology
      const player = gameState.players.find(p => p.id === playerId)!;
      const availableTechs = getAvailableTechnologies(player.researchedTechs);
      
      if (availableTechs.length > 0) {
        const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
        message += ` and discovered a ${randomTech.name} technology scroll!`;
        
        // Update gameState to grant the technology
        gameState = {
          ...gameState,
          players: gameState.players.map(p => 
            p.id === playerId 
              ? { ...p, researchedTechs: [...p.researchedTechs, randomTech.id] }
              : p
          )
        };
        
        // Store the granted technology for effects
        grantedTechId = randomTech.id;
      } else {
        message += ` and discovered ancient knowledge, but no new technologies could be learned.`;
      }
      break;
    }
    case 'unit': {
      message += ` and awakened a Title of Liberty Giant!`;
      
      // Generate unique ID for the giant unit
      const unitId = `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get unit definition for spearman as base
      const unitDef = getUnitDefinition('spearman');
      
      // Create a giant unit at the ruin location with all required properties
      const giantUnit = {
        id: unitId,
        type: 'spearman' as UnitType,
        playerId: playerId,
        coordinate: coordinate,
        hp: unitDef.baseStats.hp,
        maxHp: unitDef.baseStats.hp,
        attack: unitDef.baseStats.attack + 5, // Giant bonus
        defense: unitDef.baseStats.defense + 3, // Giant bonus
        movement: unitDef.baseStats.movement,
        remainingMovement: unitDef.baseStats.movement,
        status: 'active' as const,
        rallyBuff: false,
        tacticalCommand: false,
        abilities: [...unitDef.abilities],
        level: 2, // Giants start at higher level
        experience: 0,
        visionRadius: unitDef.baseStats.visionRadius,
        attackRange: unitDef.baseStats.attackRange,
        hasAttacked: false
      };
      
      // Add the giant to the game state
      gameState = {
        ...gameState,
        units: [...gameState.units, giantUnit]
      };
      
      // Store the created unit ID for effects
      createdUnitId = unitId;
      break;
    }
    case 'reveal': {
      message += ` and revealed the location of an enemy capital!`;
      
      // Find enemy capital cities (first city in each enemy player's citiesOwned list)
      const player = gameState.players.find(p => p.id === playerId)!;
      const enemyPlayers = gameState.players.filter(p => p.id !== playerId && !p.isEliminated);
      const enemyCapitals = [];
      
      for (const enemyPlayer of enemyPlayers) {
        if (enemyPlayer.citiesOwned.length > 0) {
          // First city is the capital
          const capitalId = enemyPlayer.citiesOwned[0];
          const capitalCity = gameState.cities?.find(city => city.id === capitalId);
          if (capitalCity && capitalCity.ownerId === enemyPlayer.id) {
            enemyCapitals.push(capitalCity);
          }
        }
      }
      
      if (enemyCapitals.length > 0) {
        // Reveal the nearest enemy capital
        let nearestCapital = enemyCapitals[0];
        let nearestDistance = Math.sqrt(
          Math.pow(coordinate.q - nearestCapital.coordinate.q, 2) + 
          Math.pow(coordinate.r - nearestCapital.coordinate.r, 2)
        );
        
        for (const capital of enemyCapitals) {
          const distance = Math.sqrt(
            Math.pow(coordinate.q - capital.coordinate.q, 2) + 
            Math.pow(coordinate.r - capital.coordinate.r, 2)
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCapital = capital;
          }
        }
        
        // Mark the capital tile as explored for this player (avoid duplicates)
        gameState = {
          ...gameState,
          map: {
            ...gameState.map,
            tiles: gameState.map.tiles.map(tile =>
              tile.coordinate.q === nearestCapital.coordinate.q && 
              tile.coordinate.r === nearestCapital.coordinate.r && 
              !tile.exploredBy.includes(playerId)
                ? { ...tile, exploredBy: [...tile.exploredBy, playerId] }
                : tile
            )
          }
        };
        
        const capitalOwner = gameState.players.find(p => p.id === nearestCapital.ownerId);
        message += ` The ${capitalOwner?.factionId || 'enemy'} capital at ${nearestCapital.name} has been revealed!`;
        
        // Store the revealed capital for effects
        revealedCapitalId = nearestCapital.id;
      } else {
        message += ` But no enemy capitals remain hidden from your knowledge.`;
      }
      break;
    }
  }

  // Apply population gain to nearest city if any
  if (popGain > 0) {
    const player = gameState.players.find(p => p.id === playerId)!;
    const playerCities = gameState.cities?.filter(city => 
      player.citiesOwned.includes(city.id)
    ) || [];
    
    if (playerCities.length > 0) {
      // Find nearest city
      let closestCity = playerCities[0];
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
      
      // Apply population gain to nearest city
      gameState = {
        ...gameState,
        cities: gameState.cities?.map(city => 
          city.id === closestCity.id
            ? { ...city, population: Math.min(city.maxPopulation || 20, city.population + popGain) }
            : city
        ) || []
      };
    }
  }

  // Apply base star and faith gains from the exploration
  const newState = {
    ...gameState,
    players: gameState.players.map(p => 
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
    )
  };

  // Remove the ruin after exploration and transform terrain to plains
  newState.map.tiles = newState.map.tiles.map(tile =>
    tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
      ? { ...tile, resources: [], terrain: 'plains' }
      : tile
  );

  return {
    success: true,
    message,
    newState,
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
      ruinReward: reward,
      technologyGranted: grantedTechId,
      unitCreated: createdUnitId,
      capitalsRevealed: revealedCapitalId ? [revealedCapitalId] : undefined
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