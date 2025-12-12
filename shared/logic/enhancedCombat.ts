import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { calculateCombatDamage, calculateRangedAttack, calculateHealing, calculateConversion } from "./combatSystem";

/**
 * Enhanced Combat Integration - Integrates advanced combat into game reducer
 */

export function handleEnhancedAttack(
  state: GameState,
  payload: { attackerId: string; targetId: string }
): GameState {
  const { attackerId, targetId } = payload;
  
  const attacker = state.units.find(u => u.id === attackerId);
  const target = state.units.find(u => u.id === targetId);
  
  if (!attacker || !target) {
    console.log('Attacker or target not found');
    return state;
  }

  // Get terrain for combat calculations
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === target.coordinate.q &&
    tile.coordinate.r === target.coordinate.r
  );
  
  // Calculate enhanced combat with all bonuses
  const combatResult = calculateCombatDamage(attacker, target, state, targetTile?.terrain);
  
  if (!combatResult.success) {
    console.log('Combat failed:', combatResult.message);
    return state;
  }

  // Apply combat results
  let updatedUnits = state.units.map(unit => {
    if (unit.id === attackerId) {
      return {
        ...unit,
        hp: combatResult.attackerHp,
        hasAttacked: true,
        remainingMovement: 0 // Attacking ends movement
      };
    }
    if (unit.id === targetId) {
      return {
        ...unit,
        hp: combatResult.defenderHp
      };
    }
    return unit;
  });

  // Remove killed units
  if (combatResult.attackerKilled) {
    updatedUnits = updatedUnits.filter(unit => unit.id !== attackerId);
  }
  if (combatResult.defenderKilled) {
    updatedUnits = updatedUnits.filter(unit => unit.id !== targetId);
  }

  console.log('Enhanced combat result:', combatResult.message);
  if (combatResult.specialEffects.length > 0) {
    console.log('Special effects:', combatResult.specialEffects.join(', '));
  }

  return {
    ...state,
    units: updatedUnits
  };
}

export function handleRangedBombardment(
  state: GameState,
  payload: { attackerId: string; targetCoordinate: HexCoordinate }
): GameState {
  const { attackerId, targetCoordinate } = payload;
  
  const attacker = state.units.find(u => u.id === attackerId);
  if (!attacker) {
    return state;
  }

  const bombardmentResult = calculateRangedAttack(attacker, targetCoordinate, state);
  
  if (!bombardmentResult.success) {
    console.log('Bombardment failed:', bombardmentResult.message);
    return state;
  }

  // Apply area damage
  const updatedUnits = state.units.map(unit => {
    const isAffected = bombardmentResult.affectedUnits.some(affected => affected.id === unit.id);
    if (isAffected) {
      const newHp = Math.max(0, unit.hp - bombardmentResult.damage);
      return { ...unit, hp: newHp };
    }
    if (unit.id === attackerId) {
      return { ...unit, hasAttacked: true, remainingMovement: 0 };
    }
    return unit;
  }).filter(unit => {
    // Remove killed units
    const wasAffected = bombardmentResult.affectedUnits.some(affected => affected.id === unit.id);
    return !wasAffected || unit.hp > 0;
  });

  console.log('Bombardment result:', bombardmentResult.message);

  return {
    ...state,
    units: updatedUnits
  };
}

export function handleUnitHealing(
  state: GameState,
  payload: { healerId: string; targetArea: HexCoordinate }
): GameState {
  const { healerId, targetArea } = payload;
  
  const healer = state.units.find(u => u.id === healerId);
  if (!healer) {
    return state;
  }

  const healingResult = calculateHealing(healer, targetArea, state);
  
  if (!healingResult.success) {
    console.log('Healing failed:', healingResult.message);
    return state;
  }

  // Apply healing and reduce faith
  const updatedUnits = state.units.map(unit => {
    const isHealed = healingResult.healedUnits.some(healed => healed.id === unit.id);
    if (isHealed) {
      return { ...unit, hp: Math.min(unit.maxHp, unit.hp + healingResult.healingAmount) };
    }
    return unit;
  });

  const updatedPlayers = state.players.map(player => {
    if (player.id === healer.playerId) {
      return {
        ...player,
        stats: {
          ...player.stats,
          faith: player.stats.faith - healingResult.faithCost
        }
      };
    }
    return player;
  });

  console.log('Healing result:', healingResult.message);

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers
  };
}

export function handleUnitConversion(
  state: GameState,
  payload: { converterId: string; targetId: string }
): GameState {
  const { converterId, targetId } = payload;
  
  const converter = state.units.find(u => u.id === converterId);
  const target = state.units.find(u => u.id === targetId);
  
  if (!converter || !target) {
    return state;
  }

  const conversionResult = calculateConversion(converter, target, state);
  
  if (!conversionResult.success) {
    console.log('Conversion failed:', conversionResult.message);
    return state;
  }

  // Roll for conversion
  const conversionSucceeded = Math.random() < conversionResult.conversionChance;
  
  // Reduce faith cost regardless
  const updatedPlayers = state.players.map(player => {
    if (player.id === converter.playerId) {
      return {
        ...player,
        stats: {
          ...player.stats,
          faith: player.stats.faith - conversionResult.faithCost
        }
      };
    }
    return player;
  });

  if (conversionSucceeded) {
    // Convert the unit
    const updatedUnits = state.units.map(unit => {
      if (unit.id === targetId) {
        return {
          ...unit,
          playerId: converter.playerId,
          hp: Math.min(unit.maxHp, unit.hp + 5) // Small healing upon conversion
        };
      }
      return unit;
    });

    console.log(`Conversion successful! ${target.type} joins your cause.`);

    return {
      ...state,
      units: updatedUnits,
      players: updatedPlayers
    };
  } else {
    console.log(`Conversion failed. ${target.type} resists.`);
    
    return {
      ...state,
      players: updatedPlayers
    };
  }
}