import { GameState, GameAction, PlayerState } from "../types/game";
import { Unit, UnitType } from "../types/unit";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { getActiveModifiers, getUnitModifiers, GameModifier } from "../data/modifiers";
import { TECHNOLOGIES, calculateResearchCost } from "../data/technologies";
import { GAME_RULES, GameRuleHelpers } from "../data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../types/city";
import { ABILITIES, AbilityDefinition } from "../data/abilities";
import { getFaction } from "../data/factions";
import { executeUnitAction } from "./unitActions";
import { executeAbility } from "./abilitySystem";

// Tech Research Handler
function handleResearchTech(
  state: GameState,
  payload: { playerId: string; techId: string }
): GameState {
  const { playerId, techId } = payload;
  
  const tech = TECHNOLOGIES[techId];
  if (!tech) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  const cost = calculateResearchCost(tech, player.researchedTechs.length);
  
  // Check if player can afford and prerequisites are met
  if (player.stars < cost) return state;
  if (!tech.prerequisites.every(prereq => player.researchedTechs.includes(prereq))) return state;
  if (player.researchedTechs.includes(techId)) return state;
  
  return {
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
}

// Start Construction Handler - adds to construction queue
function handleStartConstruction(
  state: GameState,
  payload: { 
    playerId: string; 
    buildingType: string; 
    category: 'improvements' | 'structures' | 'units';
    coordinate?: any; 
    cityId: string; 
  }
): GameState {
  const { playerId, buildingType, category, coordinate, cityId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Get building cost and time based on category
  let cost = { stars: 0, faith: 0, pride: 0 };
  let buildTime = 1;
  
  if (category === 'improvements') {
    const improvement = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvement) return state;
    cost.stars = improvement.cost;
    buildTime = improvement.constructionTime;
  } else if (category === 'structures') {
    const structure = STRUCTURE_DEFINITIONS[buildingType as keyof typeof STRUCTURE_DEFINITIONS];
    if (!structure) return state;
    cost.stars = structure.cost;
    buildTime = 3; // Default build time for structures
  } else if (category === 'units') {
    const unitDef = getUnitDefinition(buildingType as any);
    if (!unitDef) {
      console.log(`Unit definition not found for ${buildingType}`);
      return state;
    }
    cost.stars = unitDef.cost; // Units have direct cost number
    cost.faith = unitDef.requirements?.faith || 0;
    cost.pride = unitDef.requirements?.pride || 0;
    buildTime = 1; // Units build quickly
    
    // Special validation for boats - they need coastal access
    if (buildingType === 'boat') {
      const city = state.cities?.find(c => c.id === cityId);
      if (city) {
        // Check if city has coastal access (adjacent to water)
        const cityTile = state.map.tiles.find(t => 
          t.coordinate.q === city.coordinate.q && 
          t.coordinate.r === city.coordinate.r
        );
        
        if (cityTile && cityTile.terrain === 'water') {
          // City is on water, allow boat building
        } else {
          // Check for adjacent water tiles
          const adjacentWater = state.map.tiles.some(tile => {
            const distance = Math.abs(tile.coordinate.q - city.coordinate.q) + 
                           Math.abs(tile.coordinate.r - city.coordinate.r) + 
                           Math.abs(tile.coordinate.s - city.coordinate.s);
            return distance === 2 && tile.terrain === 'water'; // Adjacent hex distance is 2 in cube coordinates
          });
          
          if (!adjacentWater) {
            console.log(`Cannot build boat: city ${cityId} has no coastal access`);
            return state;
          }
        }
      }
    }
  }
  
  // Check if player can afford
  if (player.stars < cost.stars || 
      player.stats.faith < (cost.faith || 0) || 
      player.stats.pride < (cost.pride || 0)) {
    console.log(`Cannot afford ${buildingType}: need ${cost.stars} stars, ${cost.faith} faith, ${cost.pride} pride. Have ${player.stars} stars, ${player.stats.faith} faith, ${player.stats.pride} pride`);
    return state;
  }
  
  console.log(`Starting construction of ${buildingType} (${category}) for player ${playerId}`);
  console.log(`Construction details:`, { buildingType, category, coordinate, cityId, cost, buildTime });
  
  // Create construction item
  const constructionId = `${buildingType}_${cityId}_${Date.now()}`;
  const constructionItem = {
    id: constructionId,
    type: buildingType,
    category,
    coordinate: coordinate || undefined,
    cityId,
    playerId,
    turnsRemaining: buildTime,
    totalTurns: buildTime,
    cost,
  };
  
  console.log(`Adding construction item to queue:`, constructionItem);
  
  // Deduct costs and add to construction queue
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { 
            ...p, 
            stars: p.stars - cost.stars,
            stats: {
              ...p.stats,
              faith: p.stats.faith - (cost.faith || 0),
              pride: p.stats.pride - (cost.pride || 0),
            },
            constructionQueue: [...(p.constructionQueue || []), constructionItem]
          }
        : p
    ),
  };
}

// Build Improvement Handler
function handleBuildImprovement(
  state: GameState,
  payload: { playerId: string; coordinate: any; improvementType: string; cityId: string }
): GameState {
  const { playerId, coordinate, improvementType, cityId } = payload;
  
  const improvementDef = IMPROVEMENT_DEFINITIONS[improvementType as keyof typeof IMPROVEMENT_DEFINITIONS];
  if (!improvementDef) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Check if player can afford the improvement
  if (player.stars < improvementDef.cost) return state;
  
  // Check if player has required technology
  if (!player.researchedTechs.includes(improvementDef.requiredTech)) return state;
  
  // Find the target tile
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === coordinate.q &&
    tile.coordinate.r === coordinate.r
  );
  if (!targetTile) return state;
  
  // Validate terrain compatibility
  if (!improvementDef.validTerrain.includes(targetTile.terrain)) return state;
  
  // Check if tile is explored by player
  if (!targetTile.exploredBy.includes(playerId)) return state;
  
  // Check if tile already has an improvement
  const existingImprovement = state.improvements?.find(imp => 
    imp.coordinate.q === coordinate.q && imp.coordinate.r === coordinate.r
  );
  if (existingImprovement) return state;
  
  // Create new improvement with proper typing
  const newImprovement = {
    id: `${improvementType}_${coordinate.q}_${coordinate.r}_${Date.now()}`,
    type: improvementType as keyof typeof IMPROVEMENT_DEFINITIONS,
    coordinate,
    ownerId: playerId,
    starProduction: improvementDef.starProduction,
    cityId,
    constructionTurns: 0 // Built immediately for now
  };
  
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - improvementDef.cost }
        : p
    ),
    improvements: [...(state.improvements || []), newImprovement]
  };
}

// Build Structure Handler
function handleBuildStructure(
  state: GameState,
  payload: { playerId: string; cityId: string; structureType: string }
): GameState {
  const { playerId, cityId, structureType } = payload;
  
  const structureDef = STRUCTURE_DEFINITIONS[structureType as keyof typeof STRUCTURE_DEFINITIONS];
  if (!structureDef) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Check if player can afford the structure
  if (player.stars < structureDef.cost) return state;
  
  // Check if player has required technology
  if (!player.researchedTechs.includes(structureDef.requiredTech)) return state;
  
  // Find the target city
  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;
  
  // Check if player owns the city
  if (!player.citiesOwned.includes(cityId)) return state;
  
  // Check if city already has this structure type
  const existingStructure = state.structures?.find(structure => 
    structure.cityId === cityId && structure.type === structureType
  );
  if (existingStructure) return state;
  
  // Create new structure with proper typing
  const newStructure = {
    id: `${structureType}_${cityId}_${Date.now()}`,
    type: structureType as keyof typeof STRUCTURE_DEFINITIONS,
    cityId,
    ownerId: playerId,
    constructionTurns: 0, // Built immediately for now
    effects: structureDef.effects
  };
  
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - structureDef.cost }
        : p
    ),
    structures: [...(state.structures || []), newStructure]
  };
}

// Capture City Handler
function handleCaptureCity(
  state: GameState,
  payload: { playerId: string; cityId: string }
): GameState {
  const { playerId, cityId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Find the target city
  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;
  
  // Check if city is already owned by this player
  if (player.citiesOwned.includes(cityId)) return state;
  
  // Find city tile to verify player can reach it
  const cityTile = state.map.tiles.find(tile => 
    tile.coordinate.q === targetCity.coordinate.q &&
    tile.coordinate.r === targetCity.coordinate.r &&
    tile.hasCity
  );
  if (!cityTile) return state;
  
  // Check if player has a unit adjacent to or on the city tile
  const playerUnits = state.units.filter(unit => unit.playerId === playerId);
  const canCapture = playerUnits.some(unit => {
    const distance = Math.max(
      Math.abs(unit.coordinate.q - targetCity.coordinate.q),
      Math.abs(unit.coordinate.r - targetCity.coordinate.r),
      Math.abs(unit.coordinate.s - targetCity.coordinate.s)
    );
    return distance <= 1; // Adjacent or on the tile
  });
  
  if (!canCapture) return state;
  
  // Remove city from previous owner and add to new owner
  const updatedPlayers = state.players.map(p => {
    if (p.citiesOwned.includes(cityId)) {
      // Remove from previous owner
      return {
        ...p,
        citiesOwned: p.citiesOwned.filter(id => id !== cityId)
      };
    } else if (p.id === playerId) {
      // Add to new owner
      return {
        ...p,
        citiesOwned: [...p.citiesOwned, cityId]
      };
    }
    return p;
  });
  
  // Update city ownership
  const updatedCities = state.cities?.map(city =>
    city.id === cityId
      ? { ...city, playerId }
      : city
  );
  
  // Apply capture rules for structures based on game configuration
  let updatedStructures = state.structures || [];
  if (GAME_RULES.capture.destroyAllStructures) {
    // Destroy all structures in captured city
    updatedStructures = updatedStructures.filter(structure => 
      structure.cityId !== cityId
    );
  } else if (GAME_RULES.capture.transferStructures) {
    // Transfer structures to new owner
    updatedStructures = updatedStructures.map(structure =>
      structure.cityId === cityId
        ? { ...structure, playerId }
        : structure
    );
  }

  // Apply capture rules for improvements
  let updatedImprovements = state.improvements || [];
  if (GAME_RULES.capture.destroyImprovements) {
    // Destroy improvements near captured city
    updatedImprovements = updatedImprovements.filter(improvement =>
      improvement.cityId !== cityId
    );
  } else if (GAME_RULES.capture.transferImprovements) {
    // Transfer improvements to new owner
    updatedImprovements = updatedImprovements.map(improvement =>
      improvement.cityId === cityId
        ? { ...improvement, playerId }
        : improvement
    );
  }
  
  return {
    ...state,
    players: updatedPlayers,
    cities: updatedCities,
    structures: updatedStructures,
    improvements: updatedImprovements
  };
}

// Recruit Unit Handler
function handleRecruitUnit(
  state: GameState,
  payload: { playerId: string; cityId: string; unitType: string }
): GameState {
  const { playerId, cityId, unitType } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Get unit definition and validate
  const unitDef = getUnitDefinition(unitType as any);
  if (!unitDef) return state;
  
  // Check if player can afford the unit
  if (player.stars < unitDef.cost) return state;
  
  // Find the target city
  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;
  
  // Check if player owns the city
  if (!player.citiesOwned.includes(cityId)) return state;
  
  // Check unit requirements (faith, pride, etc.)
  if (unitDef.requirements) {
    if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return state;
    if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return state;
    if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) return state;
  }
  
  // Check faction restrictions
  const playerFaction = state.players.find(p => p.id === playerId)?.factionId;
  if (unitDef.factionSpecific.length > 0 && (!playerFaction || !unitDef.factionSpecific.includes(playerFaction))) {
    return state;
  }
  
  // Check if city has space for new units (max units rule)
  const existingCityUnits = state.units.filter(unit => 
    unit.coordinate.q === targetCity.coordinate.q &&
    unit.coordinate.r === targetCity.coordinate.r
  );
  if (existingCityUnits.length >= GAME_RULES.units.maxUnitsPerCity) return state;
  
  // Create new unit with proper typing
  const newUnit = {
    id: `${unitType}_${playerId}_${Date.now()}`,
    type: unitType as UnitType,
    playerId,
    coordinate: targetCity.coordinate,
    hp: unitDef.baseStats.hp,
    maxHp: unitDef.baseStats.hp,
    attack: unitDef.baseStats.attack,
    defense: unitDef.baseStats.defense,
    movement: unitDef.baseStats.movement,
    remainingMovement: unitDef.baseStats.movement,
    status: 'active' as const,
    abilities: unitDef.abilities,
    level: 1,
    experience: 0,
    visionRadius: unitDef.baseStats.visionRadius,
    attackRange: unitDef.baseStats.attackRange,
    hasAttacked: false
  };
  
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - unitDef.cost }
        : p
    ),
    units: [...state.units, newUnit]
  };
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
    
    case 'START_CONSTRUCTION':
      return handleStartConstruction(state, action.payload);
    
    case 'BUILD_STRUCTURE':
      return handleBuildStructure(state, action.payload);
    
    case 'CAPTURE_CITY':
      return handleCaptureCity(state, action.payload);
    
    case 'RECRUIT_UNIT':
      return handleRecruitUnit(state, action.payload);
    
    case 'ESTABLISH_TRADE_ROUTE':
      return handleEstablishTradeRoute(state, action.payload);
    
    case 'DECLARE_WAR':
      return handleDeclareWar(state, action.payload);
    
    case 'FORM_ALLIANCE':
      return handleFormAlliance(state, action.payload);
    
    case 'CONVERT_CITY':
      return handleConvertCity(state, action.payload);
    
    case 'UPGRADE_UNIT':
      return handleUpgradeUnit(state, action.payload);
    
    case 'UNIT_ACTION':
      return handleUnitAction(state, action.payload);
    
    case 'HARVEST_RESOURCE':
      return handleHarvestResource(state, action.payload);
    
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

  // Check if target tile is passable using centralized logic
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === payload.targetCoordinate.q &&
    tile.coordinate.r === payload.targetCoordinate.r
  );
  
  console.log('Target tile:', targetTile);
  if (!targetTile) {
    console.log('Target tile not found');
    return state;
  }

  // Check basic terrain passability
  if (GAME_RULES.terrain.impassableTypes.includes(targetTile.terrain)) {
    console.log('Target tile terrain is impassable');
    return state;
  }
  
  // Allow units to move and explore - no additional blocking logic needed

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

  // Use unit's actual vision radius from definition
  const unitDef = getUnitDefinition(unit.type);
  const visionRadius = unitDef.baseStats.visionRadius;
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
          visibilityMask: Array.from(new Set([...player.visibilityMask, ...visibleTiles])),
          exploredTiles: Array.from(new Set([...player.exploredTiles, ...visibleTiles]))
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

  // Prevent friendly fire - cannot attack units from the same player
  if (attacker.playerId === target.playerId) return state;

  // Check if unit has already attacked this turn
  if (attacker.hasAttacked) return state;

  // Check if units are within attack range
  const distance = hexDistance(attacker.coordinate, target.coordinate);
  if (distance > attacker.attackRange) return state;

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

  let updatedUnits = state.units.map((u: Unit) => {
    if (u.id === payload.targetId) {
      return { ...u, hp: newHp };
    }
    if (u.id === payload.attackerId) {
      return { ...u, hasAttacked: true };
    }
    return u;
  });

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
  payload: { playerId: string; abilityId: string; target?: any; unitId?: string; targetCoordinate?: any; targetUnitId?: string }
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const ability = ABILITIES[payload.abilityId];
  if (!ability) return state;

  // Check resource requirements
  if (ability.requirements) {
    if (ability.requirements.faith && player.stats.faith < ability.requirements.faith) return state;
    if (ability.requirements.pride && player.stats.pride < ability.requirements.pride) return state;
    if (ability.requirements.dissent && player.stats.internalDissent < ability.requirements.dissent) return state;
  }

  console.log(`Player ${player.name} using ability: ${ability.name}`);

  // Implement specific ability effects
  switch (payload.abilityId) {
    case 'TITLE_OF_LIBERTY':
      return applyTitleOfLiberty(state, player);
    case 'RAMEUMPTOM':
      return applyRameumptom(state, player);
    case 'COVENANT_OF_PEACE':
      return applyCovenantOfPeace(state, player);
    
    // Nephite faction abilities
    case 'nephite_righteous_charge':
      return applyRighteousCharge(state, payload);
    case 'nephite_faith_healing':
      return applyFaithHealing(state, payload);
    
    // Lamanite faction abilities  
    case 'lamanite_guerrilla_tactics':
      return applyGuerrillaTactics(state, payload);
    case 'lamanite_ancestral_rage':
      return applyAncestralRage(state, payload);
    
    // Zoramite faction abilities
    case 'zoramite_convert_enemy':
      return applyConvertEnemy(state, payload);
    case 'zoramite_pride_boost':
      return applyPrideBoost(state, payload);
    
    // Jaredite faction abilities
    case 'jaredite_tower_vision':
      return applyTowerVision(state, payload);
    case 'jaredite_ancient_knowledge':
      return applyAncientKnowledge(state, payload);
    
    // Anti-Nephi-Lehi faction abilities
    case 'anti_nephi_lehi_pacify':
      return applyPacify(state, payload);
    case 'anti_nephi_lehi_conversion':
      return applyConversion(state, payload);
    
    // Mulekite faction abilities
    case 'mulekite_trade_network':
      return applyTradeNetwork(state, payload);
    case 'mulekite_maritime_expansion':
      return applyMaritimeExpansion(state, payload);
    
    default:
      console.warn(`Ability ${payload.abilityId} not implemented yet`);
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

      // Resource generation from cities and improvements using centralized rules
      const playerCities = player.citiesOwned.length;
      
      // Calculate base income from cities using Polytopia-style mechanics
      const faithGeneration = GameRuleHelpers.calculateFaithGeneration(playerCities);
      
      // Calculate star income based on city levels and production
      let starIncome = 0;
      const playerCityObjects = state.cities?.filter(city => city.ownerId === player.id) || [];
      playerCityObjects.forEach(city => {
        starIncome += city.starProduction;
      });
      
      // Add base star income if no cities (fallback)
      if (playerCityObjects.length === 0) {
        starIncome = GameRuleHelpers.calculateStarIncome(playerCities);
      }
      
      // Add income from improvements
      const playerImprovements = state.improvements?.filter(imp => imp.ownerId === player.id) || [];
      
      playerImprovements.forEach(improvement => {
        const improvementDef = IMPROVEMENT_DEFINITIONS[improvement.type as keyof typeof IMPROVEMENT_DEFINITIONS];
        if (improvementDef && improvement.constructionTurns === 0) {
          starIncome += improvement.starProduction;
        }
      });
      
      // Add income from structures
      const playerStructures = state.structures?.filter(struct => struct.ownerId === player.id) || [];
      
      playerStructures.forEach(structure => {
        const structureDef = STRUCTURE_DEFINITIONS[structure.type as keyof typeof STRUCTURE_DEFINITIONS];
        if (structureDef && structure.constructionTurns === 0) {
          starIncome += structure.effects.starProduction;
        }
      });
      
      updatedStats.faith = Math.min(100, updatedStats.faith + faithGeneration);
      
      // Process construction queue
      const updatedConstructionQueue = (player.constructionQueue || []).map(item => ({
        ...item,
        turnsRemaining: item.turnsRemaining - 1
      }));
      
      // Complete finished constructions
      const completedConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining <= 0);
      const ongoingConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining > 0);
      
      return { 
        ...player, 
        stats: updatedStats,
        stars: player.stars + starIncome,
        constructionQueue: ongoingConstructions,
        completedConstructions // We'll handle this below
      };
    }
    return player;
  });

  // Process completed constructions and add to game state
  let updatedUnits = [...state.units];
  let updatedImprovements = [...(state.improvements || [])];
  let updatedStructures = [...(state.structures || [])];
  
  updatedPlayers.forEach(player => {
    if ((player as any).completedConstructions) {
      (player as any).completedConstructions.forEach((construction: any) => {
        if (construction.category === 'units') {
          // Create new unit at city location
          const city = state.cities?.find(c => c.id === construction.cityId);
          if (city) {
            const newUnit = {
              id: `unit_${Date.now()}_${Math.random()}`,
              type: construction.type,
              playerId: construction.playerId,
              coordinate: city.coordinate,
              remainingMovement: getUnitDefinition(construction.type as any).movement,
              hasAttacked: false,
              baseStats: getUnitDefinition(construction.type as any).baseStats,
              requirements: getUnitDefinition(construction.type as any).requirements,
            };
            updatedUnits.push(newUnit);
          }
        } else if (construction.category === 'improvements') {
          // Create new improvement
          const newImprovement = {
            id: construction.id,
            type: construction.type,
            coordinate: construction.coordinate,
            ownerId: construction.playerId,
            starProduction: IMPROVEMENT_DEFINITIONS[construction.type as keyof typeof IMPROVEMENT_DEFINITIONS]?.starProduction || 0,
            cityId: construction.cityId,
            constructionTurns: 0,
          };
          updatedImprovements.push(newImprovement);
        } else if (construction.category === 'structures') {
          // Create new structure
          const structureDef = STRUCTURE_DEFINITIONS[construction.type as keyof typeof STRUCTURE_DEFINITIONS];
          const newStructure = {
            id: construction.id,
            type: construction.type,
            coordinate: construction.coordinate,
            ownerId: construction.playerId,
            effects: structureDef?.effects || { starProduction: 0, defenseBonus: 0, unitProduction: 0 },
            cityId: construction.cityId,
            constructionTurns: 0,
          };
          updatedStructures.push(newStructure);
        }
      });
      
      // Remove completedConstructions from player
      delete (player as any).completedConstructions;
    }
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

  // Reset movement and attack status for next player's units at start of their turn
  updatedUnits = updatedUnits.map((u: Unit) => 
    u.playerId === nextPlayer.id 
      ? { ...u, remainingMovement: u.movement, hasAttacked: false }
      : u
  );

  // Check for victory conditions
  const winner = checkVictoryConditions(state, updatedPlayers);

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    currentPlayerIndex: nextPlayerIndex,
    turn: isNewTurn ? state.turn + 1 : state.turn,
    winner
  };
}

// Polytopia-style resource harvesting
function handleHarvestResource(
  state: GameState,
  payload: { unitId: string; resourceCoordinate: any; cityId: string }
): GameState {
  const { unitId, resourceCoordinate, cityId } = payload;
  
  // Find the unit
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return state;
  
  // Find the city
  const city = state.cities.find(c => c.id === cityId);
  if (!city || city.ownerId !== unit.playerId) return state;
  
  // Find the resource tile
  const resourceTile = state.map.tiles.find(tile => 
    tile.coordinate.q === resourceCoordinate.q &&
    tile.coordinate.r === resourceCoordinate.r &&
    (tile.terrain === 'forest' || tile.terrain === 'mountain' || tile.resources?.length)
  );
  
  if (!resourceTile) return state;
  
  // Check if resource is within city borders (adjacent to city)
  const distance = hexDistance(city.coordinate, resourceCoordinate);
  if (distance > 2) return state; // Cities control tiles within 2 hex distance
  
  // Check if resource has already been harvested
  const resourceId = `${resourceCoordinate.q},${resourceCoordinate.r}`;
  if (city.harvestedResources.includes(resourceId)) return state;
  
  // Check if player has required technology
  const player = state.players.find(p => p.id === unit.playerId);
  if (!player) return state;
  
  let canHarvest = false;
  if (resourceTile.terrain === 'forest' && player.researchedTechs.includes('forestry')) {
    canHarvest = true;
  } else if (resourceTile.terrain === 'mountain' && player.researchedTechs.includes('mining')) {
    canHarvest = true;
  } else if (resourceTile.resources?.includes('animals') && player.researchedTechs.includes('hunting')) {
    canHarvest = true;
  }
  
  if (!canHarvest) return state;
  
  // Harvest the resource - add population to city
  const updatedCities = state.cities.map(c => {
    if (c.id === cityId) {
      const newPopulation = c.population + 1;
      const shouldLevelUp = newPopulation >= c.maxPopulation;
      
      return {
        ...c,
        population: shouldLevelUp ? 1 : newPopulation, // Reset to 1 when leveling up
        level: shouldLevelUp ? c.level + 1 : c.level,
        maxPopulation: shouldLevelUp ? c.maxPopulation + 2 : c.maxPopulation, // Increase requirement
        starProduction: shouldLevelUp ? c.starProduction + 1 : c.starProduction, // Increase production
        harvestedResources: [...c.harvestedResources, resourceId]
      };
    }
    return c;
  });
  
  // Exhaust the unit after harvesting
  const updatedUnits = state.units.map(u => 
    u.id === unitId 
      ? { ...u, remainingMovement: 0 }
      : u
  );
  
  return {
    ...state,
    cities: updatedCities,
    units: updatedUnits
  };
}

function checkVictoryConditions(state: GameState, players: PlayerState[]): string | undefined {
  // Check if any player has achieved dominance
  for (const player of players) {
    const { faith, pride, internalDissent } = player.stats;
    
    // Faith Victory: Using centralized rules
    if (GameRuleHelpers.hasFaithVictory(faith) && internalDissent < 10) {
      return player.id;
    }
    
    // Territorial Victory: Using centralized rules
    const totalCities = state.map.tiles.filter(tile => tile.hasCity).length;
    const playerCities = player.citiesOwned.length;
    
    if (totalCities > 0 && GameRuleHelpers.hasTerritorialVictory(playerCities, totalCities)) {
      return player.id;
    }
  }
  
  // Elimination Victory: Only one player with units left
  if (GAME_RULES.victory.eliminationRequired) {
    const playersWithUnits = new Set(state.units.map(unit => unit.playerId));
    if (playersWithUnits.size === 1) {
      return Array.from(playersWithUnits)[0];
    }
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

// Nephite Faction Abilities
function applyRighteousCharge(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || !payload.targetUnitId) return state;

  const target = state.units.find(u => u.id === payload.targetUnitId);
  if (!target || target.playerId === unit.playerId) return state;

  // Righteous Charge: Gain significant attack bonus when charging at enemy
  const distance = hexDistance(unit.coordinate, target.coordinate);
  if (distance <= 2) {
    return {
      ...state,
      units: state.units.map(u => 
        u.id === unit.id 
          ? { ...u, attack: u.attack + GAME_RULES.abilities.attackBonuses.righteousCharge, remainingMovement: Math.max(0, u.remainingMovement - 1) }
          : u
      )
    };
  }
  return state;
}

function applyFaithHealing(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player || player.stats.faith < GAME_RULES.abilities.resourceCosts.faithHealing) return state;

  // Faith Healing: Restore HP to nearby friendly units
  const healRadius = GAME_RULES.abilities.healRadius;
  const nearbyAllies = state.units.filter(u => {
    if (u.playerId !== unit.playerId) return false;
    const distance = hexDistance(unit.coordinate, u.coordinate);
    return distance <= healRadius;
  });

  const healAmount = GAME_RULES.units.healingAmount;
  return {
    ...state,
    units: state.units.map(u => {
      if (nearbyAllies.some(ally => ally.id === u.id)) {
        const unitDef = getUnitDefinition(u.type);
        return { ...u, hp: Math.min(unitDef.baseStats.hp, u.hp + healAmount) };
      }
      return u;
    }),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - GAME_RULES.abilities.resourceCosts.faithHealing) } }
        : p
    )
  };
}

// Lamanite Faction Abilities
function applyGuerrillaTactics(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  // Guerrilla Tactics: Hide in forest/jungle terrain for defense bonus
  const unitTile = state.map.tiles.find(tile => 
    tile.coordinate.q === unit.coordinate.q && 
    tile.coordinate.r === unit.coordinate.r
  );
  
  if (unitTile && (unitTile.terrain === 'plains' || unitTile.terrain === 'swamp')) {
    return {
      ...state,
      units: state.units.map(u => 
        u.id === unit.id 
          ? { ...u, defense: u.defense + GAME_RULES.abilities.attackBonuses.guerrillaBonus, status: 'active' as const }
          : u
      )
    };
  }
  return state;
}

function applyAncestralRage(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player || player.stats.pride < 15) return state;

  // Ancestral Rage: All units gain attack bonus for several turns
  return {
    ...state,
    units: state.units.map(u => 
      u.playerId === player.id 
        ? { ...u, attack: u.attack + GAME_RULES.abilities.attackBonuses.ancestralRage }
        : u
    ),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.max(0, p.stats.pride - 15) } }
        : p
    )
  };
}

// Zoramite Faction Abilities
function applyConvertEnemy(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || !payload.targetUnitId) return state;

  const target = state.units.find(u => u.id === payload.targetUnitId);
  if (!target || target.playerId === unit.playerId) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player || player.stats.pride < 20) return state;

  // Convert Enemy: Turn enemy unit to your faction
  const distance = hexDistance(unit.coordinate, target.coordinate);
  if (distance <= GAME_RULES.abilities.conversionRadius) {
    return {
      ...state,
      units: state.units.map(u => 
        u.id === payload.targetUnitId 
          ? { ...u, playerId: unit.playerId }
          : u
      ),
      players: state.players.map(p =>
        p.id === player.id
          ? { ...p, stats: { ...p.stats, pride: Math.max(0, p.stats.pride - 20) } }
          : p
      )
    };
  }
  return state;
}

function applyPrideBoost(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Pride Boost: Gain pride from nearby structures/cities
  const playerCities = state.cities?.filter(city => 
    player.citiesOwned.includes(city.id)
  ) || [];

  const prideGain = playerCities.length * 3;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.min(100, p.stats.pride + prideGain) } }
        : p
    )
  };
}

// Jaredite Faction Abilities
function applyTowerVision(state: GameState, payload: any): GameState {
  if (!payload.targetCoordinate) return state;

  const player = state.players.find(p => p.id === payload.playerId);
  if (!player || player.stats.faith < 15) return state;

  // Tower Vision: Reveal large area of the map
  const revealRadius = GAME_RULES.abilities.visionRevealRadius;
  const tilesToReveal: string[] = [];
  
  for (let q = payload.targetCoordinate.q - revealRadius; q <= payload.targetCoordinate.q + revealRadius; q++) {
    for (let r = payload.targetCoordinate.r - revealRadius; r <= payload.targetCoordinate.r + revealRadius; r++) {
      const s = -q - r;
      const distance = Math.max(
        Math.abs(q - payload.targetCoordinate.q),
        Math.abs(r - payload.targetCoordinate.r),
        Math.abs(s - payload.targetCoordinate.s)
      );
      
      if (distance <= revealRadius) {
        tilesToReveal.push(`${q},${r}`);
      }
    }
  }

  return {
    ...state,
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        if (tilesToReveal.includes(tileKey) && !tile.exploredBy.includes(player.id)) {
          return {
            ...tile,
            exploredBy: [...tile.exploredBy, player.id]
          };
        }
        return tile;
      })
    },
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - 15) } }
        : p
    )
  };
}

function applyAncientKnowledge(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Ancient Knowledge: Gain research progress or unlock random tech
  const availableTechs = Object.keys(TECHNOLOGIES).filter(techId => 
    !player.researchedTechs.includes(techId)
  );

  if (availableTechs.length > 0) {
    const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
    return {
      ...state,
      players: state.players.map(p =>
        p.id === player.id
          ? { 
              ...p, 
              researchedTechs: [...p.researchedTechs, randomTech],
              stats: { ...p.stats, faith: Math.max(0, p.stats.faith - 25) }
            }
          : p
      )
    };
  }
  return state;
}

// Anti-Nephi-Lehi Faction Abilities
function applyPacify(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  // Pacify: Reduce attack of nearby enemy units
  const pacifyRadius = GAME_RULES.abilities.pacifyRadius;
  const nearbyEnemies = state.units.filter(u => {
    if (u.playerId === unit.playerId) return false;
    const distance = hexDistance(unit.coordinate, u.coordinate);
    return distance <= pacifyRadius;
  });

  return {
    ...state,
    units: state.units.map(u => {
      if (nearbyEnemies.some(enemy => enemy.id === u.id)) {
        return { ...u, attack: Math.max(1, u.attack - 3) };
      }
      return u;
    })
  };
}

function applyConversion(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Conversion: Increase faith, reduce internal dissent
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

// Mulekite Faction Abilities
function applyTradeNetwork(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  // Trade Network: Gain stars from nearby cities
  const tradeRadius = GAME_RULES.abilities.tradeRadius;
  const nearbyCities = state.cities?.filter(city => {
    const distance = hexDistance(unit.coordinate, city.coordinate);
    return distance <= tradeRadius;
  }) || [];

  const starGain = nearbyCities.length * 3;
  const player = state.players.find(p => p.id === unit.playerId);
  if (!player) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stars: p.stars + starGain }
        : p
    )
  };
}

function applyMaritimeExpansion(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Maritime Expansion: Reveal coastlines and gain movement bonus for water units
  return {
    ...state,
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile => {
        if ((tile.terrain === 'water') && 
            !tile.exploredBy.includes(player.id)) {
          return {
            ...tile,
            exploredBy: [...tile.exploredBy, player.id]
          };
        }
        return tile;
      })
    },
    units: state.units.map(u => 
      u.playerId === player.id && u.type === 'scout' // Scouts can act as naval units
        ? { ...u, movement: u.movement + 1, remainingMovement: u.remainingMovement + 1 }
        : u
    )
  };
}

// Advanced Diplomacy and Trade Mechanics
function handleEstablishTradeRoute(
  state: GameState,
  payload: { playerId: string; fromCityId: string; toCityId: string }
): GameState {
  const { playerId, fromCityId, toCityId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const fromCity = state.cities?.find(city => city.id === fromCityId);
  const toCity = state.cities?.find(city => city.id === toCityId);
  
  if (!fromCity || !toCity) return state;
  if (!player.citiesOwned.includes(fromCityId)) return state;

  // Establish trade route between cities
  const distance = hexDistance(fromCity.coordinate, toCity.coordinate);
  const tradeValue = Math.max(1, Math.floor(10 - distance / 2));

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars + tradeValue }
        : p
    )
  };
}

function handleDeclareWar(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);
  
  if (!player || !targetPlayer) return state;
  if (playerId === targetPlayerId) return state;

  console.log(`${player.name} declares war on ${targetPlayer.name}!`);

  // Declaring war increases pride but also internal dissent
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          stats: {
            ...p.stats,
            pride: Math.min(100, p.stats.pride + 15),
            internalDissent: Math.min(100, p.stats.internalDissent + 5)
          }
        };
      }
      return p;
    })
  };
}

function handleFormAlliance(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId: allyPlayerId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  const ally = state.players.find(p => p.id === allyPlayerId);
  
  if (!player || !ally) return state;
  if (playerId === allyPlayerId) return state;

  console.log(`${player.name} forms alliance with ${ally.name}!`);

  // Forming alliances boosts faith and reduces internal dissent
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId || p.id === allyPlayerId) {
        return {
          ...p,
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 10)
          }
        };
      }
      return p;
    })
  };
}

function handleConvertCity(
  state: GameState,
  payload: { playerId: string; cityId: string; conversionType: 'faith' | 'pride' | 'peace' }
): GameState {
  const { playerId, cityId, conversionType } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const city = state.cities?.find(c => c.id === cityId);
  if (!city) return state;

  // Check if player has a unit near the city
  const playerUnits = state.units.filter(unit => unit.playerId === playerId);
  const canConvert = playerUnits.some(unit => {
    const distance = hexDistance(unit.coordinate, city.coordinate);
    return distance <= GAME_RULES.abilities.conversionRadius && unit.type === 'missionary';
  });

  if (!canConvert) return state;

  let resourceCost = 0;
  let statChanges = {};

  switch (conversionType) {
    case 'faith':
      resourceCost = 20;
      if (player.stats.faith < resourceCost) return state;
      statChanges = { faith: player.stats.faith - resourceCost };
      break;
    case 'pride':
      resourceCost = 15;
      if (player.stats.pride < resourceCost) return state;
      statChanges = { pride: player.stats.pride - resourceCost };
      break;
    case 'peace':
      resourceCost = 10;
      statChanges = { 
        faith: Math.min(100, player.stats.faith + 5),
        internalDissent: Math.max(0, player.stats.internalDissent - 10)
      };
      break;
  }

  // Convert city to player's control
  const currentOwner = state.players.find(p => p.citiesOwned.includes(cityId));
  
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          citiesOwned: [...p.citiesOwned, cityId],
          stats: { ...p.stats, ...statChanges }
        };
      } else if (currentOwner && p.id === currentOwner.id) {
        return {
          ...p,
          citiesOwned: p.citiesOwned.filter(id => id !== cityId)
        };
      }
      return p;
    })
  };
}

function handleUnitAction(
  state: GameState,
  payload: { unitId: string; actionType: string; playerId: string; target?: any }
): GameState {
  const { unitId, actionType, playerId, target } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  switch (actionType) {
    case 'stealth':
      // Implement stealth mode for scouts
      if (unit.type === 'scout' && unit.remainingMovement >= 2) {
        return {
          ...state,
          units: state.units.map(u =>
            u.id === unitId
              ? { ...u, remainingMovement: u.remainingMovement - 2, status: 'stealth' as any }
              : u
          )
        };
      }
      break;
      
    case 'heal':
      // Implement healing for missionaries
      if (unit.type === 'missionary' && player.stats.faith >= 5) {
        const nearbyUnits = state.units.filter(u => 
          u.playerId === playerId && 
          hexDistance(u.coordinate, unit.coordinate) <= GAME_RULES.abilities.healRadius &&
          u.hp < u.maxHp
        );
        
        if (nearbyUnits.length > 0) {
          return {
            ...state,
            players: state.players.map(p =>
              p.id === playerId
                ? { ...p, stats: { ...p.stats, faith: p.stats.faith - 5 } }
                : p
            ),
            units: state.units.map(u => {
              if (nearbyUnits.some(nu => nu.id === u.id)) {
                return { ...u, hp: Math.min(u.maxHp, u.hp + GAME_RULES.units.healingAmount) };
              }
              return u;
            })
          };
        }
      }
      break;
      
    case 'reconnaissance':
      // Implement reconnaissance for scouts
      if (unit.type === 'scout') {
        const revealRadius = GAME_RULES.abilities.visionRevealRadius;
        const tilesToReveal: string[] = [];
        
        // Generate coordinates around the unit
        for (let q = -revealRadius; q <= revealRadius; q++) {
          for (let r = -revealRadius; r <= revealRadius; r++) {
            const s = -q - r;
            if (Math.abs(q) <= revealRadius && Math.abs(r) <= revealRadius && Math.abs(s) <= revealRadius) {
              const tileCoord = { q: unit.coordinate.q + q, r: unit.coordinate.r + r, s };
              tilesToReveal.push(`${tileCoord.q},${tileCoord.r}`);
            }
          }
        }
        
        return {
          ...state,
          players: state.players.map(p =>
            p.id === playerId
              ? { 
                  ...p, 
                  exploredTiles: [...p.exploredTiles, ...tilesToReveal.filter(tile => !p.exploredTiles.includes(tile))]
                }
              : p
          )
        };
      }
      break;
      
    default:
      console.log(`Unit action ${actionType} not implemented yet`);
      break;
  }
  
  return state;
}

function handleUpgradeUnit(
  state: GameState,
  payload: { playerId: string; unitId: string; upgradeType?: 'attack' | 'defense' | 'movement' | 'vision' }
): GameState {
  const { playerId, unitId, upgradeType = 'attack' } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  // Check upgrade costs
  const upgradeCost = GAME_RULES.units.upgradeBaseCost;
  if (player.stars < upgradeCost) return state;

  let unitUpgrades = {};
  switch (upgradeType) {
    case 'attack':
      unitUpgrades = { attack: unit.attack + 2 };
      break;
    case 'defense':
      unitUpgrades = { defense: unit.defense + 2 };
      break;
    case 'movement':
      unitUpgrades = { 
        movement: unit.movement + 1,
        remainingMovement: unit.remainingMovement + 1
      };
      break;
    case 'vision':
      unitUpgrades = { visionRadius: unit.visionRadius + 1 };
      break;
  }

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - upgradeCost }
        : p
    ),
    units: state.units.map(u =>
      u.id === unitId
        ? { ...u, ...unitUpgrades }
        : u
    )
  };
}
