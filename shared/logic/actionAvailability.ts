import type { GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";
import { getUnitActionsRemaining, getValidAttackTargets, calculateReachableTiles } from "./unitLogic";
import { getUnitDefinition } from "../data/units";
import { GAME_RULES } from "../data/gameRules";

export interface ActionAvailabilityResult {
  canMove: boolean;
  canAttack: boolean;
  canAct: boolean;
  canHarvest: boolean;
  canBuild: boolean;
  canUseAbilities: boolean;
  hasAbilities: boolean;
  actionReasons: {
    move?: string;
    attack?: string;
    act?: string;
    harvest?: string;
    build?: string;
  };
  reachableTilesCount: number;
  attackTargetsCount: number;
}

const normalizeAbility = (abilityId: string) => String(abilityId).toUpperCase();
const ACTIVE_ABILITIES = new Set([
  'HEAL',
  'CONVERT',
  'STEALTH',
  'RECONNAISSANCE',
  'RALLY',
  'RALLY_TROOPS',
  'BOMBARDMENT',
  'SIEGE',
  'FORMATION_FIGHTING',
  'BUILD',
  'HARVEST',
  'CLEAR_FOREST',
  'BUILD_ROAD',
  'COASTAL_EXPLORATION',
  'NAVAL_COMMAND',
]);

function getAbilityAvailability(unit: Unit, player: PlayerState, _gameState: GameState): boolean {
  const unitDef = getUnitDefinition(unit.type);
  const abilities = (unit.abilities?.length ? unit.abilities : unitDef?.abilities || []).map(normalizeAbility);
  if (abilities.length === 0) return false;

  const abilitySet = new Set(abilities);
  const hasActiveAbility = abilities.some(ability => ACTIVE_ABILITIES.has(ability));
  if (!hasActiveAbility) return false;

  let available = false;

  if (abilitySet.has('HEAL') || abilitySet.has('CONVERT')) {
    if (player.stats.faith >= GAME_RULES.abilities.resourceCosts.missionaryHeal) {
      available = true;
    }
    if (player.stats.faith >= GAME_RULES.conversion.costs.unit) {
      available = true;
    }
  }

  if (abilitySet.has('RALLY') || abilitySet.has('RALLY_TROOPS')) {
    if ((player.abilityCooldowns?.[`${unit.id}_rally_troops`] ?? 0) <= 0) {
      available = true;
    }
  }

  if (abilitySet.has('BUILD_ROAD')) {
    if (player.stars >= 3 && player.researchedTechs?.includes('organization')) {
      available = true;
    }
  }

  if (abilitySet.has('CLEAR_FOREST')) {
    if (player.researchedTechs?.includes('forestry')) {
      available = true;
    }
  }

  if (
    abilitySet.has('STEALTH') ||
    abilitySet.has('RECONNAISSANCE') ||
    abilitySet.has('BOMBARDMENT') ||
    abilitySet.has('SIEGE') ||
    abilitySet.has('FORMATION_FIGHTING') ||
    abilitySet.has('BUILD') ||
    abilitySet.has('HARVEST') ||
    abilitySet.has('COASTAL_EXPLORATION') ||
    abilitySet.has('NAVAL_COMMAND')
  ) {
    available = true;
  }

  return available;
}

export function getActionAvailabilityForUnit(
  unit: Unit,
  player: PlayerState,
  gameState: GameState
): ActionAvailabilityResult {
  const isPlayerTurn = gameState.players[gameState.currentPlayerIndex]?.id === player.id;
  const actionsRemaining = getUnitActionsRemaining(unit);

  const hasMovementPoints = unit.remainingMovement > 0;
  const reachableTiles = hasMovementPoints ? calculateReachableTiles(unit, gameState) : [];
  const reachableMoveTiles = reachableTiles.filter(coord =>
    coord.q !== unit.coordinate.q || coord.r !== unit.coordinate.r
  );

  const canMove = isPlayerTurn && hasMovementPoints && reachableMoveTiles.length > 0;
  const canAttackTargets = isPlayerTurn && actionsRemaining > 0
    ? getValidAttackTargets(unit, gameState)
    : [];
  const canAttack = canAttackTargets.length > 0 && actionsRemaining > 0 && isPlayerTurn;

  const unitDef = getUnitDefinition(unit.type);
  const hasAbilities = (unitDef.abilities || []).length > 0;
  const canUseAbilities =
    isPlayerTurn &&
    actionsRemaining > 0 &&
    hasAbilities &&
    getAbilityAvailability(unit, player, gameState);
  const canAct = isPlayerTurn && actionsRemaining > 0 && (canAttack || canMove || canUseAbilities);

  const currentTile = gameState.map.tiles.find(tile =>
    tile.coordinate.q === unit.coordinate.q && tile.coordinate.r === unit.coordinate.r
  );
  const canHarvest = isPlayerTurn && actionsRemaining > 0 && !!(currentTile?.resources && currentTile.resources.length > 0);
  const hasImprovement = (gameState.improvements || []).some(imp =>
    imp.coordinate.q === unit.coordinate.q && imp.coordinate.r === unit.coordinate.r
  );
  const hasStructure = (gameState.structures || []).some(structure =>
    structure.coordinate &&
    structure.coordinate.q === unit.coordinate.q &&
    structure.coordinate.r === unit.coordinate.r
  );
  const hasQueuedConstruction = gameState.players.some(p =>
    (p.constructionQueue || []).some(item =>
      item.coordinate &&
      item.coordinate.q === unit.coordinate.q &&
      item.coordinate.r === unit.coordinate.r
    )
  );
  const canBuild =
    isPlayerTurn &&
    actionsRemaining > 0 &&
    unit.type === 'worker' &&
    !!currentTile &&
    !currentTile.hasCity &&
    !hasImprovement &&
    !hasStructure &&
    !hasQueuedConstruction &&
    currentTile.feature !== 'village';

  return {
    canMove,
    canAttack,
    canAct,
    canHarvest,
    canBuild,
    canUseAbilities,
    hasAbilities,
    actionReasons: {
      move: !isPlayerTurn ? 'Not your turn' : !hasMovementPoints ? 'No movement remaining' : undefined,
      attack: !isPlayerTurn ? 'Not your turn' : actionsRemaining <= 0 ? 'No actions remaining' : undefined,
      act: !isPlayerTurn ? 'Not your turn' : actionsRemaining <= 0 ? 'No actions remaining' : !canUseAbilities ? 'Insufficient resources' : undefined,
      harvest: !isPlayerTurn ? 'Not your turn' : actionsRemaining <= 0 ? 'No actions remaining' : !canHarvest ? 'No resources on tile' : undefined,
      build: !isPlayerTurn ? 'Not your turn' : actionsRemaining <= 0 ? 'No actions remaining' : !canBuild ? 'Cannot build here' : undefined,
    },
    reachableTilesCount: reachableMoveTiles.length,
    attackTargetsCount: canAttackTargets.length,
  };
}
