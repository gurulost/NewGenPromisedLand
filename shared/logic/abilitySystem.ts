import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { ABILITIES } from "../data/abilities";
import { GAME_RULES } from "../data/gameRules";

/**
 * Ability System - Handles technology-unlocked abilities
 * These are more powerful, strategic abilities that require research
 */

export interface AbilityResult {
  success: boolean;
  message: string;
  newState?: GameState;
  resourceCost?: {
    faith?: number;
    pride?: number;
    stars?: number;
  };
  effects?: {
    unitsAffected?: string[];
    tilesRevealed?: HexCoordinate[];
    damage?: number;
    healing?: number;
  };
}

/**
 * Blessing Ability - Divine Protection and Healing
 */
export function executeBlessing(
  state: GameState,
  casterId: string,
  targetArea: HexCoordinate
): AbilityResult {
  const ability = ABILITIES.blessing;
  if (!ability) {
    return { success: false, message: "Blessing ability not found" };
  }

  const caster = state.units.find(u => u.id === casterId);
  if (!caster) {
    return { success: false, message: "Caster not found" };
  }

  const player = state.players.find(p => p.id === caster.playerId);
  if (!player) {
    return { success: false, message: "Player not found" };
  }

  const faithCost = ability.requirements?.faith || 30;
  if (player.stats.faith < faithCost) {
    return { 
      success: false, 
      message: `Insufficient faith. Need ${faithCost}, have ${player.stats.faith}` 
    };
  }

  // Affect all allied units in 2-tile radius
  const blessingRadius = 2;
  const affectedTiles = [targetArea, ...hexNeighbors(targetArea)];
  
  // Add second ring
  affectedTiles.forEach(tile => {
    hexNeighbors(tile).forEach(neighbor => {
      if (!affectedTiles.some(t => t.q === neighbor.q && t.r === neighbor.r)) {
        affectedTiles.push(neighbor);
      }
    });
  });

  const affectedUnits = state.units.filter(unit => 
    unit.playerId === caster.playerId &&
    affectedTiles.some(tile => 
      tile.q === unit.coordinate.q && tile.r === unit.coordinate.r
    )
  );

  const healingAmount = GAME_RULES.units.healingAmount * 2; // Double healing

  const newState = {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { ...p, stats: { ...p.stats, faith: p.stats.faith - faithCost } }
        : p
    ),
    units: state.units.map(unit => {
      if (affectedUnits.some(affected => affected.id === unit.id)) {
        return {
          ...unit,
          hp: Math.min(unit.maxHp, unit.hp + healingAmount),
          status: 'active' as const, // Remove negative status effects
        };
      }
      return unit;
    })
  };

  return {
    success: true,
    message: `Blessed ${affectedUnits.length} units with divine protection`,
    newState,
    resourceCost: { faith: faithCost },
    effects: {
      unitsAffected: affectedUnits.map(u => u.id),
      healing: healingAmount
    }
  };
}

/**
 * Conversion Ability - Convert Enemy Units
 */
export function executeConversion(
  state: GameState,
  casterId: string,
  targetUnitId: string
): AbilityResult {
  const ability = ABILITIES.conversion;
  if (!ability) {
    return { success: false, message: "Conversion ability not found" };
  }

  const caster = state.units.find(u => u.id === casterId);
  const target = state.units.find(u => u.id === targetUnitId);
  
  if (!caster || !target) {
    return { success: false, message: "Caster or target not found" };
  }

  if (caster.playerId === target.playerId) {
    return { success: false, message: "Cannot convert allied units" };
  }

  const player = state.players.find(p => p.id === caster.playerId);
  if (!player) {
    return { success: false, message: "Player not found" };
  }

  const faithCost = ability.requirements?.faith || 50;
  if (player.stats.faith < faithCost) {
    return { 
      success: false, 
      message: `Insufficient faith. Need ${faithCost}, have ${player.stats.faith}` 
    };
  }

  const distance = hexDistance(caster.coordinate, target.coordinate);
  if (distance > 2) {
    return { success: false, message: "Target too far away for conversion" };
  }

  // Conversion success based on relative faith and target's health
  const targetPlayer = state.players.find(p => p.id === target.playerId);
  const targetFaith = targetPlayer?.stats.faith || 0;
  
  const conversionChance = Math.min(0.9, 
    (player.stats.faith - targetFaith + 50) / 100 * 
    (1 - target.hp / target.maxHp) // Wounded units easier to convert
  );

  const success = Math.random() < conversionChance;

  if (!success) {
    const newState = {
      ...state,
      players: state.players.map(p => 
        p.id === player.id 
          ? { ...p, stats: { ...p.stats, faith: p.stats.faith - faithCost } }
          : p
      )
    };
    
    return {
      success: false,
      message: "Conversion attempt failed",
      newState,
      resourceCost: { faith: faithCost }
    };
  }

  const newState = {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { ...p, stats: { ...p.stats, faith: p.stats.faith - faithCost } }
        : p
    ),
    units: state.units.map(unit => 
      unit.id === target.id 
        ? { 
            ...unit, 
            playerId: caster.playerId,
            hp: Math.min(unit.maxHp, unit.hp + GAME_RULES.units.healingAmount) // Heal converted unit
          }
        : unit
    )
  };

  return {
    success: true,
    message: `Successfully converted ${target.type}`,
    newState,
    resourceCost: { faith: faithCost },
    effects: {
      unitsAffected: [target.id],
      healing: GAME_RULES.units.healingAmount
    }
  };
}

/**
 * Divine Protection Ability - Temporary Damage Immunity
 */
export function executeDivineProtection(
  state: GameState,
  casterId: string,
  targetArea: HexCoordinate
): AbilityResult {
  const ability = ABILITIES.divine_protection;
  if (!ability) {
    return { success: false, message: "Divine Protection ability not found" };
  }

  const caster = state.units.find(u => u.id === casterId);
  if (!caster) {
    return { success: false, message: "Caster not found" };
  }

  const player = state.players.find(p => p.id === caster.playerId);
  if (!player) {
    return { success: false, message: "Player not found" };
  }

  const faithCost = ability.requirements?.faith || 60;
  if (player.stats.faith < faithCost) {
    return { 
      success: false, 
      message: `Insufficient faith. Need ${faithCost}, have ${player.stats.faith}` 
    };
  }

  // Protection radius
  const protectionRadius = 1;
  const affectedTiles = [targetArea, ...hexNeighbors(targetArea)];
  
  const protectedUnits = state.units.filter(unit => 
    unit.playerId === caster.playerId &&
    affectedTiles.some(tile => 
      tile.q === unit.coordinate.q && tile.r === unit.coordinate.r
    )
  );

  // Add divine protection status (would need to extend unit schema for temporary effects)
  const newState = {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { ...p, stats: { ...p.stats, faith: p.stats.faith - faithCost } }
        : p
    ),
    units: state.units.map(unit => {
      if (protectedUnits.some(protectedUnit => protectedUnit.id === unit.id)) {
        return {
          ...unit,
          status: 'defending' as const, // Use defending status to indicate protection
        };
      }
      return unit;
    })
  };

  return {
    success: true,
    message: `${protectedUnits.length} units protected by divine intervention`,
    newState,
    resourceCost: { faith: faithCost },
    effects: {
      unitsAffected: protectedUnits.map(u => u.id)
    }
  };
}

/**
 * Enlightenment Ability - Global Research Boost
 */
export function executeEnlightenment(
  state: GameState,
  casterId: string
): AbilityResult {
  const ability = ABILITIES.enlightenment;
  if (!ability) {
    return { success: false, message: "Enlightenment ability not found" };
  }

  const caster = state.units.find(u => u.id === casterId);
  if (!caster) {
    return { success: false, message: "Caster not found" };
  }

  const player = state.players.find(p => p.id === caster.playerId);
  if (!player) {
    return { success: false, message: "Player not found" };
  }

  const faithCost = ability.requirements?.faith || 80;
  if (player.stats.faith < faithCost) {
    return { 
      success: false, 
      message: `Insufficient faith. Need ${faithCost}, have ${player.stats.faith}` 
    };
  }

  // Grant bonus research points or reduce next tech cost
  const researchBonus = 50; // Percentage of next tech cost
  
  const newState = {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { 
            ...p, 
            stats: { ...p.stats, faith: p.stats.faith - faithCost },
            // Could add enlightenment effect to player state
          }
        : p
    )
  };

  return {
    success: true,
    message: "Ancient wisdom flows through your civilization",
    newState,
    resourceCost: { faith: faithCost },
    effects: {}
  };
}

/**
 * Main Ability Dispatcher
 */
export function executeAbility(
  state: GameState,
  abilityId: string,
  casterId: string,
  parameters?: {
    target?: HexCoordinate | string;
    area?: HexCoordinate;
  }
): AbilityResult {
  const ability = ABILITIES[abilityId];
  if (!ability) {
    return { success: false, message: "Ability not found" };
  }

  switch (abilityId) {
    case 'blessing':
      if (!parameters?.area) {
        return { success: false, message: "Target area required for blessing" };
      }
      return executeBlessing(state, casterId, parameters.area);

    case 'conversion':
      if (!parameters?.target || typeof parameters.target !== 'string') {
        return { success: false, message: "Target unit required for conversion" };
      }
      return executeConversion(state, casterId, parameters.target);

    case 'divine_protection':
      if (!parameters?.area) {
        return { success: false, message: "Target area required for divine protection" };
      }
      return executeDivineProtection(state, casterId, parameters.area);

    case 'enlightenment':
      return executeEnlightenment(state, casterId);

    default:
      return { success: false, message: "Ability not implemented" };
  }
}

/**
 * Check if player has researched the required technology for an ability
 */
export function canUseAbility(
  state: GameState,
  playerId: string,
  abilityId: string
): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  const ability = ABILITIES[abilityId];
  if (!ability) return false;

  // Check if player has the required technology
  const requiredTechs = Object.entries(TECHNOLOGIES).filter(([_, tech]) => 
    tech.unlocks.abilities?.includes(abilityId)
  );

  return requiredTechs.some(([techId, _]) => 
    player.researchedTechs.includes(techId)
  );
}

// Re-export for easier imports
export { ABILITIES } from "../data/abilities";
import { TECHNOLOGIES } from "../data/technologies";