import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Alert, AlertDescription } from "./alert";
import {
  Star, Target, Heart, Swords, Eye, Shield,
  X, Hammer, Bomb, Crown, Move, Coins, Sparkles, AlertTriangle
} from "lucide-react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getUnitDefinition } from "@shared/data/units";
import { GAME_RULES } from "@shared/data/gameRules";
import { WORLD_ELEMENTS } from "@shared/data/worldElements";
import { getActionAvailability } from "../../lib/helpers/actionAvailabilityHelpers";
import { getCapturableCitiesForUnit } from "@shared/logic/cityCapture";
import { CITY_WORK_RADIUS } from "@shared/logic/constructionValidation";
import type { Unit } from "@shared/types/unit";
import { IMPROVEMENT_DEFINITIONS } from "@shared/types/city";
import { hexDistance } from "@shared/utils/hex";
import { useMobileUI } from "../../hooks/useMobileUI";

interface UnitActionsPanelProps {
  unit: Unit;
  onClose: () => void;
}

interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  cost: string;
  starCost?: number;
  faithCost?: number;
  prideCost?: number;
  available: boolean;
  irreversible?: boolean;
  rangeType?: 'movement' | 'attack' | 'ability';
  range?: number;
  consequences?: string[];
}

export default function UnitActionsPanel({ unit, onClose }: UnitActionsPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const { setMovementMode, setAttackMode, startRoadBuild } = useGameState();
  const { isMobileUI } = useMobileUI();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<ActionDefinition | null>(null);

  // Multi-city selection state for missionaries
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [pendingConversionType, setPendingConversionType] = useState<'faith' | 'pride' | 'peace' | null>(null);
  const [adjacentCitiesForConversion, setAdjacentCitiesForConversion] = useState<Array<{ id: string; name: string }>>([]);
  const [showUnitConvertSelector, setShowUnitConvertSelector] = useState(false);
  const [adjacentUnitsForConversion, setAdjacentUnitsForConversion] = useState<Array<{ id: string; name: string }>>([]);

  if (!gameState) return null;

  const unitDef = getUnitDefinition(unit.type);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const gameHasEnded = gameState.phase === 'ended' || Boolean(gameState.winner);
  const isPlayerTurn = !gameHasEnded && currentPlayer.id === unit.playerId;
  const actionAvailability = getActionAvailability(unit, gameState);
  const actionsRemaining = unit.actionsRemaining ?? unit.maxActions ?? 1;

  const currentTile = gameState.map.tiles.find(tile =>
    tile.coordinate.q === unit.coordinate.q &&
    tile.coordinate.r === unit.coordinate.r
  );
  const worldElementIds = (currentTile?.resources || []).filter(resource => WORLD_ELEMENTS[resource]);
  const capturableCities = isPlayerTurn
    ? getCapturableCitiesForUnit(unit, currentPlayer, gameState)
    : [];
  const capturableCity = capturableCities[0];

  const getClosestOwnedCityId = (): string | null => {
    if (!currentTile) return null;
    const ownedCities = (gameState.cities || []).filter(c => c.ownerId === currentPlayer.id);
    if (ownedCities.length === 0) return null;

    let best: (typeof ownedCities)[number] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const city of ownedCities) {
      const distance = hexDistance(city.coordinate, currentTile.coordinate);
      if (distance <= CITY_WORK_RADIUS && distance < bestDistance) {
        best = city;
        bestDistance = distance;
      }
    }
    return best?.id ?? null;
  };

  const getBestImprovementForCurrentTile = (): keyof typeof IMPROVEMENT_DEFINITIONS | null => {
    if (!currentTile) return null;

    const candidates = Object.values(IMPROVEMENT_DEFINITIONS)
      .filter(def =>
        def.validTerrain.includes(currentTile.terrain) &&
        currentPlayer.researchedTechs.includes(def.requiredTech) &&
        currentPlayer.stars >= def.cost
      )
      .sort((a, b) => (b.starProduction - a.starProduction) || (a.cost - b.cost));

    return (candidates[0]?.id as keyof typeof IMPROVEMENT_DEFINITIONS | undefined) ?? null;
  };

  // Generate available actions based on unit type and game state
  const getUnitActions = (): ActionDefinition[] => {
    const actions: ActionDefinition[] = [];

    // Basic movement action
    if (unit.remainingMovement > 0 && isPlayerTurn) {
      actions.push({
        id: 'move',
        name: 'Move',
        description: `Move to adjacent tiles (${actionAvailability.reachableTilesCount} available)`,
        icon: <Move className="w-4 h-4" />,
        cost: 'Movement',
        available: actionAvailability.canMove
      });
    }

    // Basic attack action
    if (unit.attack > 0 && actionsRemaining > 0 && isPlayerTurn) {
      actions.push({
        id: 'attack',
        name: 'Attack',
        description: actionAvailability.canAttack ?
          `Attack adjacent enemy units (${actionAvailability.attackTargetsCount} targets)` :
          actionAvailability.attackReason,
        icon: <Swords className="w-4 h-4" />,
        cost: 'Turn',
        available: actionAvailability.canAttack
      });
    }

    // City capture action - appears when this unit can capture an enemy city
    if (capturableCity) {
      const multipleCaptureNote = capturableCities.length > 1 ? ` (${capturableCities.length} available)` : '';
      actions.push({
        id: 'capture_city',
        name: 'Capture City',
        description: `Capture ${capturableCity.name} with this unit${multipleCaptureNote}`,
        icon: <Crown className="w-4 h-4" />,
        cost: 'Turn',
        available: true
      });
    }

    // Jaredite ruins are a world element resource on the tile (not a map feature).
    const canExploreRuins =
      !!currentTile &&
      worldElementIds.includes('jaredite_ruins') &&
      isPlayerTurn &&
      actionsRemaining > 0;

    if (canExploreRuins) {
      actions.push({
        id: 'explore_ruins',
        name: 'Explore Ruins',
        description: 'Explore Jaredite ruins for a random boon (+1 Faith)',
        icon: <span className="text-lg">🏛️</span>,
        cost: 'Free',
        available: true,
        rangeType: 'ability',
        range: 0
      });
    }

    // Unit-specific abilities based on type
    switch (unit.type) {
      case 'worker':
        const bestImprovement = getBestImprovementForCurrentTile();
        const closestCityId = getClosestOwnedCityId();
        const canClearForest =
          !!currentTile &&
          currentTile.terrain === 'forest' &&
          !currentTile.hasCity &&
          currentPlayer.researchedTechs.includes('forestry') &&
          isPlayerTurn &&
          actionsRemaining > 0;
        actions.push(
          {
            id: 'build_improvement',
            name: 'Build Improvement',
            description: !actionAvailability.canBuild
              ? 'Cannot build on this tile'
              : !closestCityId
                ? `No owned city within ${CITY_WORK_RADIUS} tiles`
                : !bestImprovement
                  ? 'No valid improvement available (check tech/stars/terrain)'
                  : `Build ${IMPROVEMENT_DEFINITIONS[bestImprovement].name} (${IMPROVEMENT_DEFINITIONS[bestImprovement].cost} stars)`,
            icon: <Hammer className="w-4 h-4" />,
            cost: 'Turn',
            available: !!(actionAvailability.canBuild && closestCityId && bestImprovement)
          },
          {
            id: 'harvest_resource',
            name: 'Harvest Resource',
            description: actionAvailability.canHarvest ?
              'Extract resources from this tile' :
              'No resources available',
            icon: <Coins className="w-4 h-4" />,
            cost: 'Turn',
            available: actionAvailability.canHarvest && worldElementIds.length > 0
          },
          {
            id: 'build_road',
            name: 'Build Road',
            description: !currentPlayer.researchedTechs.includes('organization')
              ? 'Requires Organization technology'
              : currentPlayer.stars >= 3
                ? 'Create road infrastructure (3 stars) • Connect cities for +★/turn'
                : 'Insufficient stars (need 3)',
            icon: <Target className="w-4 h-4" />,
            cost: '3 Stars',
            starCost: 3,
            available: currentPlayer.researchedTechs.includes('organization') && currentPlayer.stars >= 3 && isPlayerTurn && !!currentTile && actionsRemaining > 0
          },
          {
            id: 'clear_forest',
            name: 'Clear Forest',
            description: !currentTile
              ? 'No tile selected'
              : currentTile.terrain !== 'forest'
                ? 'Must be standing on a forest tile'
                : !currentPlayer.researchedTechs.includes('forestry')
                  ? 'Requires Forestry technology'
                  : currentTile.hasCity
                    ? 'Cannot clear forest in a city'
                    : 'Clear the forest (+2 Stars, +1 Pride, +1 Dissent) • Convert to plains',
            icon: <AlertTriangle className="w-4 h-4" />,
            cost: 'Gain 2 Stars',
            available: canClearForest
          }
        );
        break;

      case 'missionary':
        const healingCost = GAME_RULES.abilities.resourceCosts.missionaryHeal;
        const unitConversionFaithCost = GAME_RULES.conversion.costs.unit;
        const adjacentEnemyUnits = gameState.units.filter(u => {
          if (u.playerId === currentPlayer.id) return false;
          return hexDistance(unit.coordinate, u.coordinate) <= GAME_RULES.abilities.conversionRadius;
        });
        const damagedAllyInRange = gameState.units.some(candidate =>
          candidate.playerId === currentPlayer.id &&
          candidate.id !== unit.id &&
          candidate.hp < candidate.maxHp &&
          hexDistance(unit.coordinate, candidate.coordinate) <= GAME_RULES.abilities.healRadius
        );

        actions.push(
          {
            id: 'heal',
            name: 'Heal Nearby Units',
            description: damagedAllyInRange
              ? 'Restore health to friendly units'
              : 'No damaged allies in range',
            icon: <Heart className="w-4 h-4" />,
            cost: `${healingCost} Faith`,
            faithCost: healingCost,
            available: isPlayerTurn && damagedAllyInRange && currentPlayer.stats.faith >= healingCost && actionsRemaining > 0,
            rangeType: 'ability',
            range: GAME_RULES.abilities.healRadius
          },
          {
            id: 'convert',
            name: 'Convert Enemy',
            description: adjacentEnemyUnits.length > 0
              ? (adjacentEnemyUnits.length === 1
                ? `Convert nearby ${adjacentEnemyUnits[0].type}`
                : `Convert a nearby enemy unit (${adjacentEnemyUnits.length} targets)`)
              : `No enemy units within ${GAME_RULES.abilities.conversionRadius} tiles to convert`,
            icon: <Star className="w-4 h-4" />,
            cost: `${unitConversionFaithCost} Faith`,
            faithCost: unitConversionFaithCost,
            available: isPlayerTurn && currentPlayer.stats.faith >= unitConversionFaithCost && actionsRemaining > 0 && adjacentEnemyUnits.length > 0,
            rangeType: 'attack',
            range: GAME_RULES.abilities.conversionRadius
          }
        );

        // City conversion actions - find adjacent enemy cities
        const adjacentCities = gameState?.cities?.filter(city => {
          if (currentPlayer.citiesOwned.includes(city.id)) return false;
          const distance = Math.max(
            Math.abs(unit.coordinate.q - city.coordinate.q),
            Math.abs(unit.coordinate.r - city.coordinate.r),
            Math.abs((unit.coordinate.s || -unit.coordinate.q - unit.coordinate.r) - (city.coordinate.s || -city.coordinate.q - city.coordinate.r))
          );
          return distance <= 1;
        });

	        if (adjacentCities && adjacentCities.length > 0) {
	          const targetCity = adjacentCities[0]; // Get first adjacent city
	          const cityName = targetCity.name || 'City';
	          const multipleNote = adjacentCities.length > 1 ? ` (${adjacentCities.length} available)` : '';
	          const canUseCityConversion = isPlayerTurn && actionsRemaining > 0;

	          actions.push(
	            {
	              id: 'convert_city_faith',
	              name: 'Convert City (Faith)',
	              description: `Convert ${cityName} through faith (${GAME_RULES.conversion.costs.cityFaith} Faith)${multipleNote}`,
	              icon: <Heart className="w-4 h-4" />,
	              cost: `${GAME_RULES.conversion.costs.cityFaith} Faith`,
	              faithCost: GAME_RULES.conversion.costs.cityFaith,
	              available: canUseCityConversion && currentPlayer.stats.faith >= GAME_RULES.conversion.costs.cityFaith,
	              rangeType: 'ability',
	              range: 1
	            },
	            {
	              id: 'convert_city_pride',
	              name: 'Convert City (Pride)',
	              description: `Convert ${cityName} through pride (${GAME_RULES.conversion.costs.cityPride} Pride)${multipleNote}`,
	              icon: <Crown className="w-4 h-4" />,
	              cost: `${GAME_RULES.conversion.costs.cityPride} Pride`,
	              prideCost: GAME_RULES.conversion.costs.cityPride,
	              available: canUseCityConversion && currentPlayer.stats.pride >= GAME_RULES.conversion.costs.cityPride,
	              rangeType: 'ability',
	              range: 1
	            },
	            {
	              id: 'convert_city_peace',
	              name: 'Convert City (Peace)',
	              description: `Peaceful conversion of ${cityName} (${GAME_RULES.conversion.costs.cityPeaceFaithCost} Faith → +${GAME_RULES.conversion.costs.cityPeaceFaithRefund} Faith, -${GAME_RULES.conversion.costs.cityPeaceDissentReduction} Dissent)${multipleNote}`,
	              icon: <Star className="w-4 h-4" />,
	              cost: `${GAME_RULES.conversion.costs.cityPeaceFaithCost} Faith`,
	              faithCost: GAME_RULES.conversion.costs.cityPeaceFaithCost,
	              available: canUseCityConversion && currentPlayer.stats.faith >= GAME_RULES.conversion.costs.cityPeaceFaithCost,
	              rangeType: 'ability',
	              range: 1
	            }
	          );
	        }
        break;

      case 'scout':
        actions.push(
          {
            id: 'stealth',
            name: 'Stealth Mode',
            description: 'Become invisible to enemies',
            icon: <Eye className="w-4 h-4" />,
            cost: 'Turn',
            available: isPlayerTurn && actionsRemaining > 0 && unit.status !== 'stealthed'
          },
          {
            id: 'reconnaissance',
            name: 'Reconnaissance',
            description: 'Reveal large area around unit',
            icon: <Target className="w-4 h-4" />,
            cost: 'Turn',
            available: isPlayerTurn && actionsRemaining > 0
          }
        );
        break;

      case 'spearman':
        actions.push({
          id: 'formation_fighting',
          name: 'Formation Fighting',
          description: 'Assume formation for +2 defense until broken',
          icon: <Shield className="w-4 h-4" />,
          cost: 'Turn',
          available: isPlayerTurn && actionsRemaining > 0
        });
        break;

      case 'commander':
        actions.push({
          id: 'rally_troops',
          name: 'Rally Troops',
          description: actionAvailability.hasAbilities ? 'Boost nearby friendly military units (+1 Pride)' : actionAvailability.abilityReason,
          icon: <Crown className="w-4 h-4" />,
          cost: 'Gain +1 Pride',
          available: isPlayerTurn && actionsRemaining > 0 && actionAvailability.hasAbilities,
          rangeType: 'ability',
          range: 2
        });
        break;

      case 'catapult':
        actions.push(
          {
            id: 'siege_mode',
            name: 'Deploy Siege Mode',
            description:
                  unit.status === 'siege_mode'
                    ? 'Already deployed'
                    : unit.remainingMovement !== unit.movement
                      ? 'Must be stationary to deploy'
                      : 'Deploy to enable long-range bombardment (ends after firing or moving)',
            icon: <Target className="w-4 h-4" />,
            cost: 'Turn',
            available:
              isPlayerTurn &&
              actionsRemaining > 0 &&
              unit.remainingMovement === unit.movement &&
              unit.status !== 'siege_mode',
          },
          {
            id: 'bombardment',
            name: 'Artillery Bombardment',
            description:
                  unit.status !== 'siege_mode'
                    ? 'Deploy siege mode first'
                    : unit.remainingMovement !== unit.movement
                      ? 'Must be stationary this turn'
                      : 'Long-range attack (range 2-3; splash on adjacent enemies when firing at range)',
            icon: <Bomb className="w-4 h-4" />,
            cost: 'Turn',
            available:
              isPlayerTurn &&
              actionsRemaining > 0 &&
              unit.status === 'siege_mode' &&
              unit.remainingMovement === unit.movement,
            rangeType: 'attack',
            range: unit.attackRange
          }
        );
        break;
    }

    // Unit upgrades - available to all units
    if (isPlayerTurn && currentPlayer.stars >= 15) {
      actions.push(
        {
          id: 'upgrade_attack',
          name: 'Upgrade Attack',
          description: 'Increase attack power by +2 (15 Stars)',
          icon: <Swords className="w-4 h-4" />,
          cost: '15 Stars',
          starCost: 15,
          available: currentPlayer.stars >= 15
        },
        {
          id: 'upgrade_defense',
          name: 'Upgrade Defense',
          description: 'Increase defense by +2 (15 Stars)',
          icon: <Crown className="w-4 h-4" />,
          cost: '15 Stars',
          starCost: 15,
          available: currentPlayer.stars >= 15
        },
        {
          id: 'upgrade_movement',
          name: 'Upgrade Movement',
          description: 'Increase movement range by +1 (15 Stars)',
          icon: <Move className="w-4 h-4" />,
          cost: '15 Stars',
          starCost: 15,
          available: currentPlayer.stars >= 15
        },
        {
          id: 'upgrade_vision',
          name: 'Upgrade Vision',
          description: 'Increase vision radius by +1 (15 Stars)',
          icon: <Eye className="w-4 h-4" />,
          cost: '15 Stars',
          starCost: 15,
          available: currentPlayer.stars >= 15
        }
      );
    }

    return actions;
  };

  const needsConfirmation = (action: ActionDefinition): boolean => {
    return !!action.irreversible ||
      (!!action.starCost && action.starCost > 5) ||
      (!!action.faithCost && action.faithCost > 10) ||
      (!!action.prideCost && action.prideCost > 10);
  };

  const handleActionSelect = (action: ActionDefinition) => {
    if (!action.available) return;

    // Toggle selection for UI state
    if (selectedAction === action.id) {
      // If already selected, execute the action
      if (needsConfirmation(action)) {
        setActionToConfirm(action);
        setShowConfirmDialog(true);
      } else {
        handleActionExecute(action);
      }
    } else {
      // Select the action to show details
      setSelectedAction(action.id);
    }
  };

  const handleActionExecute = (action: ActionDefinition) => {
    if (!action.available) return;

    // Handle different action types with proper game state updates
    switch (action.id) {
      case 'move':
        setMovementMode(true);
        break;
      case 'attack':
        setAttackMode(true);
        break;
      case 'explore_ruins':
        if (currentTile && (currentTile.resources || []).includes('jaredite_ruins')) {
          dispatch({
            type: 'WORLD_ELEMENT_HARVEST',
            payload: {
              playerId: currentPlayer.id,
              unitId: unit.id,
              elementId: 'jaredite_ruins',
              coordinate: currentTile.coordinate
            }
          });
        }
        break;

      case 'capture_city':
        if (capturableCity) {
          dispatch({
            type: 'CAPTURE_CITY',
            payload: {
              playerId: currentPlayer.id,
              unitId: unit.id,
              cityId: capturableCity.id
            }
          });
        }
        break;
      case 'heal':
        dispatch({
          type: 'HEAL_UNIT',
          payload: { playerId: currentPlayer.id, unitId: unit.id }
        });
        break;
      case 'stealth':
        dispatch({
          type: 'APPLY_STEALTH',
          payload: { playerId: currentPlayer.id, unitId: unit.id }
        });
        break;
      case 'reconnaissance':
        dispatch({
          type: 'RECONNAISSANCE',
          payload: { playerId: currentPlayer.id, unitId: unit.id }
        });
        break;
      case 'rally_troops':
        dispatch({
          type: 'RALLY_TROOPS',
          payload: { playerId: currentPlayer.id, unitId: unit.id }
        });
        break;
      case 'siege_mode':
        dispatch({
          type: 'SIEGE_MODE',
          payload: { playerId: currentPlayer.id, unitId: unit.id }
        });
        break;
      case 'bombardment':
        // Use standard attack targeting (catapult already has extended `attackRange`)
        setAttackMode(true);
        break;
      case 'build_road':
        startRoadBuild(unit.id);
        break;
      case 'clear_forest':
        if (currentTile) {
          dispatch({
            type: 'CLEAR_FOREST',
            payload: { playerId: currentPlayer.id, unitId: unit.id, targetCoordinate: currentTile.coordinate }
          });
        }
        break;
      case 'build_improvement':
        if (currentTile) {
          const bestImprovement = getBestImprovementForCurrentTile();
          const closestCityId = getClosestOwnedCityId();
          if (!bestImprovement || !closestCityId) break;
          dispatch({
            type: 'START_CONSTRUCTION',
            payload: {
              playerId: currentPlayer.id,
              buildingType: bestImprovement,
              category: 'improvements',
              coordinate: currentTile.coordinate,
              cityId: closestCityId,
              builderUnitId: unit.id,
            }
          });
        }
        break;
      case 'harvest_resource':
        if (currentTile && worldElementIds.length > 0) {
          dispatch({
            type: 'WORLD_ELEMENT_HARVEST',
            payload: {
              playerId: currentPlayer.id,
              unitId: unit.id,
              elementId: worldElementIds[0],
              coordinate: currentTile.coordinate
            }
          });
        }
        break;
      case 'convert':
        {
          const enemies = gameState.units.filter(u => {
            if (u.playerId === currentPlayer.id) return false;
            return hexDistance(unit.coordinate, u.coordinate) <= GAME_RULES.abilities.conversionRadius;
          });

          if (enemies.length === 1) {
            dispatch({
              type: 'CONVERT_UNIT',
              payload: { playerId: currentPlayer.id, unitId: unit.id, targetUnitId: enemies[0].id }
            });
          } else if (enemies.length > 1) {
            setAdjacentUnitsForConversion(enemies.map(e => ({ id: e.id, name: e.type })));
            setShowUnitConvertSelector(true);
            return; // keep panel open
          }
        }
        break;
      case 'formation_fighting':
        dispatch({
          type: 'FORMATION_FIGHTING',
          payload: { playerId: currentPlayer.id, unitId: unit.id }
        });
        break;

      // City conversion actions
      case 'convert_city_faith':
      case 'convert_city_pride':
      case 'convert_city_peace': {
        // Find ALL adjacent enemy cities
        const allAdjacentCities = gameState?.cities?.filter(city => {
          if (currentPlayer.citiesOwned.includes(city.id)) return false;
          const distance = Math.max(
            Math.abs(unit.coordinate.q - city.coordinate.q),
            Math.abs(unit.coordinate.r - city.coordinate.r),
            Math.abs((unit.coordinate.s || -unit.coordinate.q - unit.coordinate.r) - (city.coordinate.s || -city.coordinate.q - city.coordinate.r))
          );
          return distance <= 1;
        }) || [];

        const conversionType = action.id === 'convert_city_faith' ? 'faith' :
          action.id === 'convert_city_pride' ? 'pride' : 'peace';

        if (allAdjacentCities.length === 1) {
          // Only one city - convert directly
          dispatch({
            type: 'CONVERT_CITY',
            payload: {
              playerId: currentPlayer.id,
              unitId: unit.id,
              cityId: allAdjacentCities[0].id,
              conversionType
            }
          });
        } else if (allAdjacentCities.length > 1) {
          // Multiple cities - show selection modal
          setAdjacentCitiesForConversion(allAdjacentCities.map(c => ({ id: c.id, name: c.name })));
          setPendingConversionType(conversionType);
          setShowCitySelector(true);
          return; // Don't close panel yet
        }
        break;
      }

      // Unit upgrades
      case 'upgrade_attack':
        dispatch({
          type: 'UPGRADE_UNIT',
          payload: {
            playerId: currentPlayer.id,
            unitId: unit.id,
            upgradeType: 'attack'
          }
        });
        break;
      case 'upgrade_defense':
        dispatch({
          type: 'UPGRADE_UNIT',
          payload: {
            playerId: currentPlayer.id,
            unitId: unit.id,
            upgradeType: 'defense'
          }
        });
        break;
      case 'upgrade_movement':
        dispatch({
          type: 'UPGRADE_UNIT',
          payload: {
            playerId: currentPlayer.id,
            unitId: unit.id,
            upgradeType: 'movement'
          }
        });
        break;
      case 'upgrade_vision':
        dispatch({
          type: 'UPGRADE_UNIT',
          payload: {
            playerId: currentPlayer.id,
            unitId: unit.id,
            upgradeType: 'vision'
          }
        });
        break;

      default:
        console.warn('Action not implemented:', action.id);
        return;
    }

    onClose();
  };

  const actions = getUnitActions();

  return (
    <div
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[var(--z-modal-backdrop)] pointer-events-auto ${isMobileUI ? 'p-0' : 'p-4'}`}
      data-ui-layer="modal"
      data-testid="unit-actions-panel"
    >
      <Card data-ui-layer="modal-content" className={`z-[var(--z-modal-content)] w-full overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20 touch-scroll ${isMobileUI ? 'max-w-full max-h-full rounded-none mobile-safe-top mobile-safe-bottom' : 'max-w-[500px] max-h-[85vh]'}`}>
        <CardHeader className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-amber-100 font-cinzel">
              <Sparkles className="w-6 h-6 text-amber-300" />
              {unitDef.name} Actions
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="min-h-[44px] border-amber-600 text-amber-300 md:hover:bg-amber-800/50 active:bg-amber-900 touch-manipulation"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-sm text-amber-200/80 font-body">
            — Choose Your Path in the Promised Land —
          </div>
        </CardHeader>

        <CardContent className="space-y-4 bg-slate-900/40">
          {/* Unit Status */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-amber-900/20 rounded-lg border border-amber-500/30">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-400">{unit.hp}/{unitDef.baseStats.hp}</div>
              <div className="text-xs text-amber-300">Health</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-400">{unit.remainingMovement}/{unit.movement}</div>
              <div className="text-xs text-amber-300">Movement</div>
            </div>
          </div>

          {/* Resource Display */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-amber-900/10 rounded-lg border border-amber-500/20">
            <div className="text-center">
              <div className="text-amber-400 flex items-center justify-center gap-1">
                <Star className="w-3 h-3" />
                <span className="font-semibold">{currentPlayer.stars}</span>
              </div>
              <div className="text-amber-300 text-xs">Stars</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 flex items-center justify-center gap-1">
                <Heart className="w-3 h-3" />
                <span className="font-semibold">{currentPlayer.stats.faith}</span>
              </div>
              <div className="text-blue-300 text-xs">Faith</div>
            </div>
            <div className="text-center">
              <div className="text-red-400 flex items-center justify-center gap-1">
                <Crown className="w-3 h-3" />
                <span className="font-semibold">{currentPlayer.stats.pride}</span>
              </div>
              <div className="text-red-300 text-xs">Pride</div>
            </div>
          </div>

          <Separator className="bg-amber-500/30" />

          {/* Available Actions */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-amber-100 font-cinzel">Available Actions</h3>

            {actions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-amber-300 mb-2 text-lg">No actions available</div>
                <div className="text-sm text-amber-400/70">
                  This unit has exhausted all available actions this turn.
                </div>
              </div>
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  role="button" tabIndex={action.available ? 0 : -1}
                  aria-disabled={!action.available}
                  aria-label={`${action.name}: ${action.description}`}
                  className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 min-h-[80px] touch-manipulation ${selectedAction === action.id
                    ? 'bg-amber-600/30 border-amber-500/70 ring-2 ring-amber-500/50'
                    : action.available
                      ? 'bg-amber-600/10 border-amber-600/50 md:hover:bg-amber-600/20 active:bg-amber-600/25 md:hover:border-amber-500/70 active:scale-[0.98]'
                      : 'bg-gray-800/20 border-gray-700/50 opacity-50 cursor-not-allowed grayscale'
                    }`}
                  onClick={() => action.available && handleActionSelect(action)}
                  onKeyDown={(event) => {
                    if (!action.available) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleActionSelect(action);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`mt-1 transition-colors duration-200 ${action.available ? 'text-amber-400' : 'text-gray-500'
                        }`}>
                        {action.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-base transition-colors duration-200 ${action.available ? 'text-amber-100' : 'text-gray-400'
                            }`}>{action.name}</h4>
                          {action.irreversible && (
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                          )}
                        </div>
                        <p className={`text-sm mt-1 leading-relaxed transition-colors duration-200 ${action.available ? 'text-amber-200/80' : 'text-gray-500'
                          }`}>{action.description}</p>

                        {/* Enhanced Cost Display with Availability Indicators */}
                        <div className="flex items-center gap-2 mt-3">
                          {/* Base cost badge with dynamic coloring */}
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium transition-colors duration-200 ${action.available
                              ? 'text-green-300 border-green-500/50 bg-green-500/10'
                              : 'text-red-300 border-red-500/50 bg-red-500/10'
                              }`}
                          >
                            {action.cost} {action.available ? '✓' : '✗'}
                          </Badge>

                          {/* Star cost with clear affordability indicator */}
                          {action.starCost && (
                            <Badge
                              variant="outline"
                              className={`text-xs flex items-center gap-1 transition-colors duration-200 ${currentPlayer.stars >= action.starCost
                                ? 'text-yellow-300 border-yellow-500/50 bg-yellow-500/10'
                                : 'text-red-300 border-red-500/50 bg-red-500/10'
                                }`}
                            >
                              <Star className="w-3 h-3" />
                              {action.starCost} {currentPlayer.stars >= action.starCost ? '✓' : '✗'}
                            </Badge>
                          )}

                          {/* Faith cost with clear affordability indicator */}
                          {action.faithCost && (
                            <Badge
                              variant="outline"
                              className={`text-xs flex items-center gap-1 transition-colors duration-200 ${currentPlayer.stats.faith >= action.faithCost
                                ? 'text-blue-300 border-blue-500/50 bg-blue-500/10'
                                : 'text-red-300 border-red-500/50 bg-red-500/10'
                                }`}
                            >
                              <Heart className="w-3 h-3" />
                              {action.faithCost} {currentPlayer.stats.faith >= action.faithCost ? '✓' : '✗'}
                            </Badge>
                          )}

                          {/* Pride cost with clear affordability indicator */}
                          {action.prideCost && (
                            <Badge
                              variant="outline"
                              className={`text-xs flex items-center gap-1 transition-colors duration-200 ${currentPlayer.stats.pride >= action.prideCost
                                ? 'text-red-300 border-red-500/50 bg-red-500/10'
                                : 'text-gray-400 border-gray-600/50 bg-gray-600/10'
                                }`}
                            >
                              <Crown className="w-3 h-3" />
                              {action.prideCost} {currentPlayer.stats.pride >= action.prideCost ? '✓' : '✗'}
                            </Badge>
                          )}

                          {/* Range indicator */}
                          {action.rangeType && action.range && (
                            <Badge variant="outline" className="text-xs text-purple-300 border-purple-500/50 bg-purple-500/10">
                              Range: {action.range}
                            </Badge>
                          )}

                          {!action.available && (
                            <Badge variant="outline" className="text-xs text-red-300 border-red-500/50 bg-red-500/10">
                              Unavailable
                            </Badge>
                          )}
                        </div>

                        {/* Consequences warning for irreversible actions */}
                        {action.consequences && selectedAction === action.id && (
                          <Alert className="mt-3 border-orange-500/50 bg-orange-900/20">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription className="text-xs">
                              <strong>Warning:</strong> This action is irreversible
                              <ul className="mt-2 ml-2 text-orange-300">
                                {action.consequences.map((consequence, idx) => (
                                  <li key={idx} className="text-xs">• {consequence}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Execute Button for Selected Action */}
                  {selectedAction === action.id && action.available && (
                    <div className="mt-4 pt-3 border-t border-purple-700">
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleActionExecute(action);
                        }}
                        className="w-full bg-purple-600 md:hover:bg-purple-700 active:bg-purple-800 text-white min-h-[44px] touch-manipulation"
                        size="sm"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {needsConfirmation(action) ? 'Confirm Action' : 'Execute Action'}
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-purple-950 border-purple-600 text-white max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              Confirm Action
            </DialogTitle>
            <DialogDescription className="text-purple-200">
              {actionToConfirm?.name} - Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>

          {actionToConfirm && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-900/50 rounded-lg">
                <p className="text-sm text-purple-200 mb-2">{actionToConfirm.description}</p>

                {/* Cost Summary */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {actionToConfirm.starCost && (
                    <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-500/50">
                      -{actionToConfirm.starCost} Stars
                    </Badge>
                  )}
                  {actionToConfirm.faithCost && (
                    <Badge className="bg-blue-900/50 text-blue-300 border-blue-500/50">
                      -{actionToConfirm.faithCost} Faith
                    </Badge>
                  )}
                  {actionToConfirm.prideCost && (
                    <Badge className="bg-red-900/50 text-red-300 border-red-500/50">
                      -{actionToConfirm.prideCost} Pride
                    </Badge>
                  )}
                </div>

                {/* Player Resources Check */}
                <div className="text-xs text-purple-300">
                  Current Resources: {currentPlayer.stars} Stars, {currentPlayer.stats.faith} Faith, {currentPlayer.stats.pride} Pride
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  className="border-purple-600 text-purple-300 md:hover:bg-purple-800/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleActionExecute(actionToConfirm);
                    setShowConfirmDialog(false);
                  }}
                  className="bg-purple-600 md:hover:bg-purple-700 text-white"
                >
                  Confirm
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* City Selection Modal for Missionaries */}
      <Dialog open={showCitySelector} onOpenChange={setShowCitySelector}>
        <DialogContent className="bg-amber-950 border-amber-600 text-white max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Crown className="w-5 h-5" />
              Select City to Convert
            </DialogTitle>
            <DialogDescription className="text-amber-200">
              Choose which city to convert using {pendingConversionType}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {adjacentCitiesForConversion.map(city => (
              <button
                key={city.id}
                onClick={() => {
                  if (pendingConversionType) {
                    dispatch({
                      type: 'CONVERT_CITY',
                      payload: {
                        playerId: currentPlayer.id,
                        unitId: unit.id,
                        cityId: city.id,
                        conversionType: pendingConversionType
                      }
                    });
                  }
                  setShowCitySelector(false);
                  setPendingConversionType(null);
                  setAdjacentCitiesForConversion([]);
                  onClose();
                }}
                className="w-full p-3 bg-amber-900/40 hover:bg-amber-700/50 border border-amber-500/40 hover:border-amber-400 rounded-lg transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-amber-100">{city.name}</div>
                  <Badge className="bg-amber-800/50 text-amber-200 border-amber-500/50">
                    Convert
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCitySelector(false);
                setPendingConversionType(null);
                setAdjacentCitiesForConversion([]);
              }}
              className="border-amber-600 text-amber-300 md:hover:bg-amber-800/50"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Selection Modal for Missionaries (Convert Enemy) */}
      <Dialog open={showUnitConvertSelector} onOpenChange={setShowUnitConvertSelector}>
        <DialogContent className="bg-blue-950 border-blue-600 text-white max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-300">
              <Sparkles className="w-5 h-5" />
              Select Unit to Convert
            </DialogTitle>
            <DialogDescription className="text-blue-200">
              Choose which nearby unit to attempt conversion on (costs {GAME_RULES.conversion.costs.unit} Faith).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {adjacentUnitsForConversion.map(enemy => (
              <button
                key={enemy.id}
                onClick={() => {
                  dispatch({
                    type: 'CONVERT_UNIT',
                    payload: { playerId: currentPlayer.id, unitId: unit.id, targetUnitId: enemy.id }
                  });
                  setShowUnitConvertSelector(false);
                  setAdjacentUnitsForConversion([]);
                  onClose();
                }}
                className="w-full p-3 bg-blue-900/40 hover:bg-blue-700/50 border border-blue-500/40 hover:border-blue-400 rounded-lg transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-blue-100">{enemy.name}</div>
                  <Badge className="bg-blue-800/50 text-blue-200 border-blue-500/50">
                    Convert
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUnitConvertSelector(false);
                setAdjacentUnitsForConversion([]);
              }}
              className="border-blue-600 text-blue-200 md:hover:bg-blue-800/50"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
