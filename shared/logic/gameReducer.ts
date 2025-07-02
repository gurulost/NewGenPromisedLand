import { GameState, GameAction, PlayerState } from "../types/game";
import { Unit } from "../types/unit";
import { hexDistance, hexNeighbors } from "../utils/hex";

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
  if (!unit) return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) return state;

  // Check if movement is valid
  const distance = hexDistance(unit.coordinate, payload.targetCoordinate);
  if (distance > unit.remainingMovement) return state;

  // Check if target tile is passable
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === payload.targetCoordinate.q &&
    tile.coordinate.r === payload.targetCoordinate.r
  );
  
  if (!targetTile || targetTile.terrain === 'water') return state;

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

  // Update visibility for the player
  const tileKey = `${payload.targetCoordinate.q},${payload.targetCoordinate.r}`;
  const updatedPlayers = state.players.map(player => 
    player.id === currentPlayer.id
      ? {
          ...player,
          visibilityMask: [...new Set([...player.visibilityMask, tileKey])]
        }
      : player
  );

  // Update explored tiles
  const updatedTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === payload.targetCoordinate.q &&
        tile.coordinate.r === payload.targetCoordinate.r) {
      return {
        ...tile,
        exploredBy: [...new Set([...tile.exploredBy, currentPlayer.id])]
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

  // Check if units are adjacent
  const distance = hexDistance(attacker.coordinate, target.coordinate);
  if (distance > 1) return state;

  // Calculate damage
  const damage = Math.max(1, attacker.attack - target.defense);
  const newHp = Math.max(0, target.hp - damage);

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

  // Reset unit movement for current player
  const updatedUnits = state.units.map((u: Unit) => 
    u.playerId === currentPlayer.id 
      ? { ...u, remainingMovement: u.movement }
      : u
  );

  // Move to next player
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const isNewTurn = nextPlayerIndex === 0;

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
              pride: p.stats.pride - 50,
              internalDissent: Math.min(100, p.stats.internalDissent + 20)
            }
          }
        : p
    )
  };
}
