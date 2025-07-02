import { GameState, GameAction, PlayerState } from "../types/game";
import { Unit } from "../types/unit";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE_UNIT':
      return handleMoveUnit(state, action.payload);
    
    case 'ATTACK_UNIT':
      return handleAttackUnit(state, action.payload);
    
    case 'USE_ABILITY':
      return handleUseAbility(state, action.payload);
    
    case 'END_TURN':
      return handleEndTurn(state, action.payload);
    
    case 'BUILD_UNIT':
      return handleBuildUnit(state, action.payload);
    
    default:
      return state;
  }
}

function handleMoveUnit(
  state: GameState, 
  payload: { unitId: string; targetCoordinate: any }
): GameState {
  const unit = state.units.find((u: Unit) => u.id === payload.unitId);
  if (!unit) {
    console.log('Unit not found:', payload.unitId);
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) {
    console.log('Unit does not belong to current player');
    return state;
  }

  // Check if movement is valid
  const distance = hexDistance(unit.coordinate, payload.targetCoordinate);
  console.log('Movement distance:', distance, 'Remaining movement:', unit.remainingMovement);
  if (distance > unit.remainingMovement) {
    console.log('Not enough movement');
    return state;
  }

  // Check if target tile is passable
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === payload.targetCoordinate.q &&
    tile.coordinate.r === payload.targetCoordinate.r
  );
  
  console.log('Target tile:', targetTile);
  if (!targetTile || targetTile.terrain === 'water' || targetTile.terrain === 'mountain') {
    console.log('Target tile is not passable');
    return state;
  }

  // Update unit position and movement
  const updatedUnits = state.units.map((u: Unit) => 
    u.id === payload.unitId 
      ? { 
          ...u, 
          coordinate: payload.targetCoordinate,
          remainingMovement: u.remainingMovement - distance
        }
      : u
  );

  // Update visibility for the player - add vision radius around the unit
  const visionRadius = 2; // Units can see 2 tiles around them
  const visibleTiles: string[] = [];
  
  // Get all tiles within vision radius
  for (let q = payload.targetCoordinate.q - visionRadius; q <= payload.targetCoordinate.q + visionRadius; q++) {
    for (let r = payload.targetCoordinate.r - visionRadius; r <= payload.targetCoordinate.r + visionRadius; r++) {
      const s = -q - r;
      const distance = Math.max(Math.abs(q - payload.targetCoordinate.q), 
                               Math.abs(r - payload.targetCoordinate.r), 
                               Math.abs(s - payload.targetCoordinate.s));
      
      if (distance <= visionRadius) {
        visibleTiles.push(`${q},${r}`);
      }
    }
  }
  
  const updatedPlayers = state.players.map(player => 
    player.id === currentPlayer.id
      ? {
          ...player,
          visibilityMask: Array.from(new Set([...player.visibilityMask, ...visibleTiles]))
        }
      : player
  );

  // Update explored tiles - explore all visible tiles
  const updatedTiles = state.map.tiles.map(tile => {
    const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
    if (visibleTiles.includes(tileKey)) {
      return {
        ...tile,
        exploredBy: Array.from(new Set([...tile.exploredBy, currentPlayer.id]))
      };
    }
    return tile;
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    map: {
      ...state.map,
      tiles: updatedTiles
    }
  };
}

function handleAttackUnit(
  state: GameState,
  payload: { attackerId: string; targetId: string }
): GameState {
  const attacker = state.units.find((u: Unit) => u.id === payload.attackerId);
  const target = state.units.find((u: Unit) => u.id === payload.targetId);
  
  if (!attacker || !target) return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (attacker.playerId !== currentPlayer.id) return state;

  // Check if units are adjacent (attack range)
  const distance = hexDistance(attacker.coordinate, target.coordinate);
  if (distance > 1) return state; // Most units have range 1 for now

  // Calculate damage with faction bonuses
  let attackPower = attacker.attack;
  let defensePower = target.defense;

  // Apply faction-specific combat bonuses
  const attackerPlayer = state.players.find(p => p.id === attacker.playerId);
  const targetPlayer = state.players.find(p => p.id === target.playerId);

  if (attackerPlayer?.factionId === 'NEPHITES') {
    // Nephites gain +1 attack when fighting for Faith
    if (attackerPlayer.stats.faith > 70) {
      attackPower += 1;
    }
  }

  if (attackerPlayer?.factionId === 'LAMANITES') {
    // Lamanites deal +2 damage when Pride is high
    if (attackerPlayer.stats.pride > 60) {
      attackPower += 2;
    }
  }

  if (targetPlayer?.factionId === 'ANTI_NEPHI_LEHIES') {
    // Anti-Nephi-Lehies have +1 defense due to pacifism
    defensePower += 1;
  }

  // Calculate final damage
  const damage = Math.max(1, attackPower - defensePower);
  const newHp = Math.max(0, target.hp - damage);

  console.log(`Combat: ${attacker.type} (${attackPower} attack) vs ${target.type} (${defensePower} defense) = ${damage} damage`);

  let updatedUnits = state.units.map((u: Unit) => 
    u.id === payload.targetId ? { ...u, hp: newHp } : u
  );

  // Remove unit if killed
  if (newHp <= 0) {
    updatedUnits = updatedUnits.filter((u: Unit) => u.id !== payload.targetId);
    
    // Trigger faction abilities like Blood Feud
    const targetPlayer = state.players.find(p => p.id === target.playerId);
    if (targetPlayer?.factionId === 'LAMANITES') {
      // Apply Blood Feud - nearby Lamanite units gain +2 attack
      const neighbors = hexNeighbors(target.coordinate);
      updatedUnits = updatedUnits.map((u: Unit) => {
        if (u.playerId === target.playerId && 
            neighbors.some(neighbor => 
              neighbor.q === u.coordinate.q && neighbor.r === u.coordinate.r
            )) {
          return { ...u, attack: u.attack + 2 };
        }
        return u;
      });
    }
  }

  return {
    ...state,
    units: updatedUnits
  };
}

function handleUseAbility(
  state: GameState,
  payload: { playerId: string; abilityId: string; target?: any }
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Implement specific ability effects
  switch (payload.abilityId) {
    case 'TITLE_OF_LIBERTY':
      return applyTitleOfLiberty(state, player);
    case 'RAMEUMPTOM':
      return applyRameumptom(state, player);
    // Add other abilities...
    default:
      return state;
  }
}

function handleEndTurn(
  state: GameState,
  payload: { playerId: string }
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== payload.playerId) return state;

  // Reset unit movement for the NEW CURRENT player (not the one ending turn)
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextPlayerIndex];
  const isNewTurn = nextPlayerIndex === 0;

  const updatedUnits = state.units.map((u: Unit) => 
    u.playerId === nextPlayer.id 
      ? { ...u, remainingMovement: u.movement }
      : u
  );

  return {
    ...state,
    units: updatedUnits,
    currentPlayerIndex: nextPlayerIndex,
    turn: isNewTurn ? state.turn + 1 : state.turn
  };
}

function handleBuildUnit(
  state: GameState,
  payload: { unitType: string; coordinate: any; playerId: string }
): GameState {
  // Implementation for building new units
  // This would check resources, valid placement, etc.
  return state;
}

// Helper functions for specific abilities
function applyTitleOfLiberty(state: GameState, player: PlayerState): GameState {
  if (player.stats.faith < 70) return state;

  // Find all units within 3 tiles of any player unit and apply buff
  // Implementation would be more complex in practice
  return {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { ...p, stats: { ...p.stats, faith: p.stats.faith - 50 } }
        : p
    )
  };
}

function applyRameumptom(state: GameState, player: PlayerState): GameState {
  if (player.stats.pride < 70) return state;

  return {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { 
            ...p, 
            stats: { 
              ...p.stats, 
              pride: Math.min(100, p.stats.pride + 30), // Boost Pride significantly
              internalDissent: Math.min(100, p.stats.internalDissent + 20)
            }
          }
        : p
    )
  };
}

function applyCovenantOfPeace(state: GameState, player: PlayerState): GameState {
  // Anti-Nephi-Lehies: Instead of combat, convert nearby enemy units
  console.log('Covenant of Peace activated - nearby enemies may convert');
  
  return {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { 
            ...p, 
            stats: { 
              ...p.stats, 
              faith: Math.min(100, p.stats.faith + 10),
              internalDissent: Math.max(0, p.stats.internalDissent - 15)
            }
          }
        : p
    )
  };
}
