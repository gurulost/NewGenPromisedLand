/**
 * World Element Actions - Handles moral choices for Book of Mormon themed resources
 * Each action affects Faith/Pride/Dissent creating strategic moral decisions
 */

import { GameState } from '../types/game';
import { HexCoordinate } from '../types/coordinates';
import { getWorldElement, RUIN_REWARDS, RuinReward } from '../data/worldElements';

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

  // Special handling for Jaredite Ruins
  if (elementId === 'jaredite_ruins') {
    return executeRuinExploration(gameState, playerId, coordinate);
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
    )
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
    message: `${action.name} completed - ${getImpactMessage(action.prideDelta, action.faithDelta)}`,
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
    case 'tech':
      message += ` and discovered a technology scroll!`;
      // TODO: Grant random technology
      break;
    case 'unit':
      message += ` and awakened a Title of Liberty Giant!`;
      // TODO: Create giant unit
      break;
    case 'reveal':
      message += ` and revealed the location of an enemy capital!`;
      // TODO: Reveal enemy capital
      break;
  }

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

  // Remove the ruin after exploration
  newState.map.tiles = newState.map.tiles.map(tile =>
    tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
      ? { ...tile, resources: [] }
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
  } else if (actionType === 'build') {
    if (!element.longTermBuild) {
      return { canExecute: false, reason: 'No build action available' };
    }
    
    if (player.stars < element.longTermBuild.costStars) {
      return { canExecute: false, reason: `Need ${element.longTermBuild.costStars} stars` };
    }
  }

  return { canExecute: true };
}