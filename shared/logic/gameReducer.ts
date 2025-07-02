import { GameState, GameAction, PlayerState } from "../types/game";
import { Unit } from "../types/unit";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { getActiveModifiers, getUnitModifiers, GameModifier } from "../data/modifiers";
import { TECHNOLOGIES, calculateResearchCost } from "../data/technologies";

// Tech Research Handler
function handleResearchTech(
  state: GameState,
  payload: { playerId: string; techId: string }
): GameState {
  console.log('=== RESEARCH_TECH reducer called ===');
  const { playerId, techId } = payload;
  console.log('Player ID:', playerId, 'Tech ID:', techId);
  
  const tech = TECHNOLOGIES[techId];
  if (!tech) {
    console.log('Tech not found:', techId);
    return state;
  }
  console.log('Tech found:', tech);
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    console.log('Player not found:', playerId);
    return state;
  }
  console.log('Player found:', player);
  
  const cost = calculateResearchCost(tech, player.researchedTechs.length);
  console.log('Tech cost:', cost, 'Player stars:', player.stars);
  
  // Check if player can afford and prerequisites are met
  if (player.stars < cost) {
    console.log('Player cannot afford tech');
    return state;
  }
  if (!tech.prerequisites.every(prereq => player.researchedTechs.includes(prereq))) {
    console.log('Prerequisites not met:', tech.prerequisites);
    return state;
  }
  if (player.researchedTechs.includes(techId)) {
    console.log('Tech already researched');
    return state;
  }
  
  console.log('All checks passed, researching tech!');
  const newState = {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? {
            ...p,
            stars: p.stars - cost,
            researchedTechs: [...p.researchedTechs, techId],
          }
        : p
    ),
  };
  console.log('New state:', newState);
  return newState;
}

// Build Improvement Handler
function handleBuildImprovement(
  state: GameState,
  payload: { playerId: string; coordinate: any; improvementType: string; cityId: string }
): GameState {
  console.log('Building improvement:', payload.improvementType, 'at', payload.coordinate);
  return state;
}

// Build Structure Handler
function handleBuildStructure(
  state: GameState,
  payload: { playerId: string; cityId: string; structureType: string }
): GameState {
  console.log('Building structure:', payload.structureType, 'in city', payload.cityId);
  return state;
}

// Capture City Handler
function handleCaptureCity(
  state: GameState,
  payload: { playerId: string; cityId: string }
): GameState {
  console.log('Capturing city:', payload.cityId, 'by player', payload.playerId);
  return state;
}

// Recruit Unit Handler
function handleRecruitUnit(
  state: GameState,
  payload: { playerId: string; cityId: string; unitType: string }
): GameState {
  console.log('Recruiting unit:', payload.unitType, 'from city', payload.cityId);
  return state;
}

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
    
    case 'RESEARCH_TECH':
      return handleResearchTech(state, action.payload);
    
    case 'BUILD_IMPROVEMENT':
      return handleBuildImprovement(state, action.payload);
    
    case 'BUILD_STRUCTURE':
      return handleBuildStructure(state, action.payload);
    
    case 'CAPTURE_CITY':
      return handleCaptureCity(state, action.payload);
    
    case 'RECRUIT_UNIT':
      return handleRecruitUnit(state, action.payload);
    
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

  // Calculate damage using data-driven modifier system
  let attackPower = attacker.attack;
  let defensePower = target.defense;

  const attackerPlayer = state.players.find(p => p.id === attacker.playerId);
  const targetPlayer = state.players.find(p => p.id === target.playerId);

  // Apply attacker's combat modifiers
  if (attackerPlayer) {
    const attackModifiers = getActiveModifiers(attackerPlayer, 'on_attack');
    attackModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.stat === 'attack' && effect.target === 'self') {
          attackPower += effect.value;
          console.log(`Applied ${modifier.name}: +${effect.value} attack`);
        }
      });
    });
  }

  // Apply target's defense modifiers
  if (targetPlayer) {
    const defenseModifiers = getActiveModifiers(targetPlayer, 'on_defend');
    defenseModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.stat === 'defense' && effect.target === 'self') {
          defensePower += effect.value;
          console.log(`Applied ${modifier.name}: +${effect.value} defense`);
        }
      });
    });
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
    
    // Apply data-driven death modifiers
    if (targetPlayer) {
      const deathModifiers = getActiveModifiers(targetPlayer, 'on_death');
      deathModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.target === 'nearby' && effect.radius) {
            // Find units within radius
            const affectedUnits = updatedUnits.filter(unit => {
              if (unit.playerId !== target.playerId) return false;
              const distance = hexDistance(unit.coordinate, target.coordinate);
              return distance <= effect.radius!;
            });

            // Apply effect to nearby units
            affectedUnits.forEach(unit => {
              const unitIndex = updatedUnits.findIndex(u => u.id === unit.id);
              if (unitIndex !== -1) {
                updatedUnits[unitIndex] = {
                  ...updatedUnits[unitIndex],
                  [effect.stat]: (updatedUnits[unitIndex][effect.stat as keyof Unit] as number) + effect.value
                };
                console.log(`Applied ${modifier.name} to ${unit.id}: +${effect.value} ${effect.stat}`);
              }
            });
          }
        });
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

  // Apply end-of-turn effects for current player
  let updatedPlayers = state.players.map(player => {
    if (player.id === currentPlayer.id) {
      const endTurnModifiers = getActiveModifiers(player, 'on_turn_end');
      let updatedStats = { ...player.stats };
      
      endTurnModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.stat === 'pride' || effect.stat === 'faith' || effect.stat === 'internalDissent') {
            updatedStats = {
              ...updatedStats,
              [effect.stat]: Math.max(0, Math.min(100, updatedStats[effect.stat as keyof typeof updatedStats] + effect.value))
            };
          }
        });
      });

      // Resource generation from cities
      const playerCities = state.map.tiles.filter(tile => 
        tile.hasCity && tile.exploredBy.includes(player.id)
      ).length;
      
      // Each city generates +2 Faith per turn
      updatedStats.faith = Math.min(100, updatedStats.faith + (playerCities * 2));
      
      return { ...player, stats: updatedStats };
    }
    return player;
  });

  // Calculate next player and turn
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = updatedPlayers[nextPlayerIndex];
  const isNewTurn = nextPlayerIndex === 0;

  // Apply start-of-turn effects for next player
  updatedPlayers = updatedPlayers.map(player => {
    if (player.id === nextPlayer.id) {
      const startTurnModifiers = getActiveModifiers(player, 'on_turn_start');
      let updatedStats = { ...player.stats };
      
      startTurnModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.stat === 'pride' || effect.stat === 'faith' || effect.stat === 'internalDissent') {
            updatedStats = {
              ...updatedStats,
              [effect.stat]: Math.max(0, Math.min(100, updatedStats[effect.stat as keyof typeof updatedStats] + effect.value))
            };
          }
        });
      });
      
      return { ...player, stats: updatedStats };
    }
    return player;
  });

  // Reset movement for next player's units
  const updatedUnits = state.units.map((u: Unit) => 
    u.playerId === nextPlayer.id 
      ? { ...u, remainingMovement: u.movement }
      : u
  );

  // Check for victory conditions
  const winner = checkVictoryConditions(state, updatedPlayers);

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turn: isNewTurn ? state.turn + 1 : state.turn,
    winner
  };
}

function checkVictoryConditions(state: GameState, players: PlayerState[]): string | undefined {
  // Check if any player has achieved dominance
  for (const player of players) {
    const { faith, pride, internalDissent } = player.stats;
    
    // Faith Victory: Faith > 90 and Internal Dissent < 10
    if (faith > 90 && internalDissent < 10) {
      return player.id;
    }
    
    // Military Victory: Control 80% of cities
    const totalCities = state.map.tiles.filter(tile => tile.hasCity).length;
    const playerCities = state.map.tiles.filter(tile => 
      tile.hasCity && tile.exploredBy.includes(player.id)
    ).length;
    
    if (totalCities > 0 && playerCities / totalCities >= 0.8) {
      return player.id;
    }
  }
  
  // Elimination Victory: Only one player with units left
  const playersWithUnits = new Set(state.units.map(unit => unit.playerId));
  if (playersWithUnits.size === 1) {
    return Array.from(playersWithUnits)[0];
  }
  
  return undefined;
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
