import { useEffect, useRef, useState } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { useAITurn } from "../../hooks/useAITurn";
import { getFaction } from "@shared/data/factions";
import { PlayerHUD } from "../hud/PlayerHUD";
import SelectedUnitPanel from "../ui/SelectedUnitPanel";
import UnitActionsPanel from "../ui/AbilitiesPanel";
<<<<<<< Updated upstream
import { TechPanel } from "../ui/TechPanel";
import { CityPanel } from "../city/CityPanel";
=======
import TechPanel from "../ui/TechPanel";
import CityPanel from "../ui/CityPanel";
>>>>>>> Stashed changes
import { BuildingMenu } from "../ui/BuildingMenu";
import VictoryScreen from "../ui/VictoryScreen";
import SaveLoadMenu from "../ui/SaveLoadMenu";
import { TurnTransition, useTurnTransition } from "../ui/TurnTransition";
import { SaveSystem } from "../ui/SaveSystem";
import { UnitSelectionUI } from "../effects/UnitSelection";
import { ActionTooltip } from "../ui/TooltipSystem";
import { WorldElementPanel } from "../ui/WorldElementPanel";
import MovementControls from "../game/MovementControls";
import { TelemetryPanel } from "./TelemetryPanel";
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from "@shared/types/city";
import { UNIT_DEFINITIONS } from "@shared/data/units";
import { getWorldElement, WORLD_ELEMENTS } from "@shared/data/worldElements";
import type { Unit } from "@shared/types/unit";
import { useToastContext } from "../ui/ToastProvider";
import { AbilityTargetOverlay } from "../ui/AbilityTargetOverlay";
import { ABILITIES } from "@shared/data/abilities";
import { validateAbilityForPlayer } from "../../utils/abilityValidation";
import { hexDistance } from "@shared/utils/hex";
import { getTechnology, canPlayerResearchTechnology, getTechCostDetails, playerHasTechPrerequisites } from "@shared/logic/technologyHelpers";
import { subscribeTelemetry } from "@shared/logic/telemetry";

const TARGETED_FACTION_ABILITIES: Record<string, {
  title: string;
  instructions: string;
  toast: string;
  emptyMessage?: string;
}> = {
  DIVINE_WARD: {
    title: 'Divine Ward',
    instructions: 'Select a covenant unit to shield from negative effects for the next three turns.',
    toast: 'Choose a friendly unit to bless with Divine Ward.',
    emptyMessage: 'You need an active unit to receive the ward.',
  },
  RIGHTEOUS_FURY: {
    title: 'Righteous Fury',
    instructions: 'Pick the rallying unit whose nearby allies will gain +3 attack.',
    toast: 'Select a commander or frontline unit to spark Righteous Fury.',
    emptyMessage: 'Fields are empty—train or move units before invoking Righteous Fury.',
  },
};

const IMPLEMENTED_FACTION_ABILITIES = new Set([
  'TITLE_OF_LIBERTY',
  'RIGHTEOUS_DEFENSE',
  'COVENANT_OF_PEACE',
  'RAMEUMPTOM',
  'MISSIONARY_ZEAL',
  'WARRIOR_RAGE',
  'ANCIENT_KNOWLEDGE',
  'CULTURAL_RECLAMATION',
  'ANCIENT_MIGHT',
  'PROPHETIC_COLLAPSE',
  'DIVINE_WARD',
  'SPIRITUAL_WARFARE',
  'RIGHTEOUS_FURY',
  'lamanite_guerrilla_tactics',
  'zoramite_convert_enemy',
  'zoramite_pride_boost',
  'jaredite_tower_vision',
]);

export default function GameUI() {
  const { gameState, endTurn, useAbility, attackUnit, setGamePhase, resetGame, loadGameState, dispatch } = useLocalGame();
  const { 
    selectedUnit, 
    setSelectedUnit, 
    constructionMode, 
    cancelConstruction, 
    isMovementMode, 
    isAttackMode, 
    setMovementMode, 
    setAttackMode, 
    reachableCoordinates,
    abilityTargetMode,
    startAbilityTargeting,
    cancelAbilityTargeting,
    setAbilityTargetSelection,
  } = useGameState();
  const toast = useToastContext();
  
  // Initialize AI turn handling
  useAITurn();
  const [subscribeKeys] = useKeyboardControls();
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [showConstructionHall, setShowConstructionHall] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);
  const [showAdvancedSaveSystem, setShowAdvancedSaveSystem] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const [selectedWorldElement, setSelectedWorldElement] = useState<{
    elementId: string;
    coordinate: { q: number; r: number; s: number };
  } | null>(null);

  const systemToastRef = useRef<string | null>(null);

  // Turn transition system
  const { isTransitioning, pendingPlayer, startTransition, completeTransition } = useTurnTransition();
  
  if (!gameState) return null;

  // Enhanced end turn with transition  
  const handleEndTurn = () => {
    if (!gameState) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    // Show toast feedback for ending turn
    toast?.info('Turn Ended', `${currentPlayer.name}'s turn is complete. Passing to ${nextPlayer.name}...`);
    
    // Start turn transition animation
    startTransition(nextPlayer);
    
    // Complete turn after transition
    setTimeout(() => {
      endTurn(currentPlayer.id); // Pass the current player's ID
      completeTransition();
      
      // Toast notification for new turn start
      toast?.success('New Turn Started', `It's now ${nextPlayer.name}'s turn!`);
    }, 1000);
  };

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const faction = getFaction(currentPlayer.factionId as any);
  const factionAbilityOptions = faction.abilities
    .filter(ability => ability.type === 'active' && IMPLEMENTED_FACTION_ABILITIES.has(ability.id))
    .map(ability => {
      const definition = ABILITIES[ability.id];
      if (!definition) return null;

      const unmet: string[] = [];
      if (definition.requirements?.faith && currentPlayer.stats.faith < definition.requirements.faith) {
        unmet.push(`Faith ${currentPlayer.stats.faith}/${definition.requirements.faith}`);
      }
      if (definition.requirements?.pride && currentPlayer.stats.pride < definition.requirements.pride) {
        unmet.push(`Pride ${currentPlayer.stats.pride}/${definition.requirements.pride}`);
      }
      if (definition.requirements?.dissent && currentPlayer.stats.internalDissent < definition.requirements.dissent) {
        unmet.push(`Dissent ${currentPlayer.stats.internalDissent}/${definition.requirements.dissent}`);
      }

      const currentCooldown = currentPlayer.abilityCooldowns?.[ability.id] ?? 0;
      if (currentCooldown > 0) {
        unmet.push(`Cooldown ${currentCooldown}`);
      }

      const cooldown = ability.cooldown ?? definition.cooldown;
      const requirementSnapshot = definition.requirements ?? ability.requirements ?? {};

      return {
        id: ability.id,
        name: definition.name,
        description: definition.description,
        canUse: unmet.length === 0,
        disabledReason: unmet.length ? unmet.join(' • ') : undefined,
        requiresTarget: Boolean(TARGETED_FACTION_ABILITIES[ability.id]),
        meta: {
          cooldown,
          cooldownRemaining: currentCooldown,
          cost: ability.cost,
          requirements: requirementSnapshot,
          target: definition.target,
          isToggle: Boolean(definition.isToggle),
        },
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      name: string;
      description: string;
      canUse: boolean;
      disabledReason?: string;
      requiresTarget: boolean;
      meta?: {
        cooldown?: number;
        cooldownRemaining?: number;
        cost?: number;
        requirements?: {
          faith?: number;
          pride?: number;
          dissent?: number;
        };
        target?: string;
        isToggle?: boolean;
      };
    }>;

  // Keyboard controls
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.endTurn,
      (pressed) => {
        if (pressed) {
          handleEndTurn();
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  // Deselect unit with escape
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.cancel,
      (pressed) => {
        if (pressed && selectedUnit) {
          setSelectedUnit(null);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys, selectedUnit, setSelectedUnit]);

  // Save/Load keyboard shortcut
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.save,
      (pressed) => {
        if (pressed) {
          setShowSaveLoadMenu(true);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const unsubscribe = subscribeTelemetry(event => {
      if (event.channel !== 'system') return;

      const key = `${event.timestamp}:${event.reason}:${event.playerId ?? ''}`;
      if (systemToastRef.current === key) return;
      systemToastRef.current = key;

      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      const formatLabel = (value?: unknown) => {
        if (typeof value !== 'string' || value.length === 0) return 'Unknown';
        return value
          .split('_')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      };

      const message = typeof metadata.message === 'string' ? metadata.message : undefined;

      switch (event.reason) {
        case 'construction_started': {
          const building = formatLabel(metadata.buildingType);
          const city = formatLabel(metadata.cityId);
          const buildTime = typeof metadata.buildTime === 'number' ? metadata.buildTime : 1;
          toast.success('Construction Queued', `${building} will complete in ${buildTime} turn${buildTime === 1 ? '' : 's'} at ${city}.`);
          break;
        }
        case 'construction_insufficient_resources': {
          const cost = metadata.cost as { stars?: number; faith?: number; pride?: number } | undefined;
          const parts: string[] = [];
          if (typeof cost?.stars === 'number') parts.push(`${cost.stars}★`);
          if (typeof cost?.faith === 'number' && cost.faith > 0) parts.push(`${cost.faith} faith`);
          if (typeof cost?.pride === 'number' && cost.pride > 0) parts.push(`${cost.pride} pride`);
          toast.warning('Not Enough Resources', parts.length ? `Requires ${parts.join(', ')}.` : 'You need more resources for that project.');
          break;
        }
        case 'construction_insufficient_faith':
        case 'construction_insufficient_pride':
        case 'construction_insufficient_dissent': {
          const required = typeof metadata.required === 'number' ? metadata.required : undefined;
          const statName = event.reason.split('_').pop()?.toUpperCase() ?? 'STAT';
          toast.warning('Requirement Not Met', `Need at least ${required ?? '?'} ${statName}.`);
          break;
        }
        case 'construction_requires_coastal_access':
          toast.warning('Coastal Access Needed', 'Select a coastal city before building ships.');
          break;
        case 'construction_city_not_owned':
          toast.warning('City Not Owned', 'Capture the city before starting construction.');
          break;
        case 'construction_city_not_found':
        case 'construction_player_not_found':
        case 'construction_invalid_improvement':
        case 'construction_invalid_structure':
        case 'construction_invalid_unit':
          toast.error('Construction Failed', message || 'Unable to queue construction.');
          break;
        case 'world_element_harvest_success':
          toast.success('Harvest Complete', message || 'Resources collected successfully.');
          setSelectedWorldElement(null);
          break;
        case 'world_element_build_success':
          toast.success('Stewardship Complete', message || 'Long-term improvement established.');
          setSelectedWorldElement(null);
          break;
        case 'world_element_harvest_blocked':
        case 'world_element_build_blocked':
          toast.warning('Action Unavailable', message || 'Prerequisites not met for this action.');
          break;
        default:
          if (process.env.NODE_ENV !== 'production' && message) {
            console.info('[telemetry] system event', event.reason, metadata);
          }
      }
    });

    return unsubscribe;
  }, [toast, setSelectedWorldElement]);

  // Handle world element actions
  const handleWorldElementAction = (actionType: 'harvest' | 'build') => {
    if (!selectedWorldElement) return;
    
    const elementData = WORLD_ELEMENTS[selectedWorldElement.elementId];
    
    if (!elementData) {
      toast?.error('Action Failed', 'Unknown world element selected.');
      return;
    }

    const techRequirement = elementData.techPrerequisite;
    if (techRequirement && !currentPlayer.researchedTechs.includes(techRequirement)) {
      toast?.warning('Technology Required', `${elementData.displayName} requires ${techRequirement} before you can ${actionType}.`);
      return;
    }

    if (actionType === 'build') {
      const buildInfo = elementData.longTermBuild;
      if (!buildInfo) {
        toast?.warning('Unavailable', `You cannot build on ${elementData.displayName}.`);
        return;
      }
      if (currentPlayer.stars < buildInfo.costStars) {
        toast?.warning('Not Enough Stars', `Need ${buildInfo.costStars}★ to build ${buildInfo.name}.`);
        return;
      }
    }

    
    const action = {
      type: actionType === 'harvest' ? 'WORLD_ELEMENT_HARVEST' : 'WORLD_ELEMENT_BUILD',
      payload: {
        playerId: currentPlayer.id,
        elementId: selectedWorldElement.elementId,
        coordinate: selectedWorldElement.coordinate
      }
    } as any;
    
    try {
      // Dispatch the action through the game reducer
      useLocalGame.getState().dispatch(action);
      
    } catch (error) {
      toast?.error('Action Failed', `Could not ${actionType} ${elementData?.displayName || selectedWorldElement.elementId}. Please try again.`);
    }
  };

  // Detect clicks on world element tiles
  useEffect(() => {
    const handleWorldElementClick = (event: CustomEvent) => {
      if (event.detail?.coordinate && event.detail?.resources) {
        const { coordinate, resources } = event.detail;
        
        // Enhanced logging for debugging
        
        // Check if any resource is a world element
        for (const resource of resources) {
          if (WORLD_ELEMENTS[resource]) {
            setSelectedWorldElement({
              elementId: resource,
              coordinate
            });
            return;
          } else {
          }
        }
      } else {
      }
    };

    // Listen for world element clicks
    window.addEventListener('worldElementClick', handleWorldElementClick as EventListener);
    
    return () => {
      window.removeEventListener('worldElementClick', handleWorldElementClick as EventListener);
    };
  }, []);

  const abilityTargetUnits = abilityTargetMode.isActive
    ? abilityTargetMode.eligibleUnitIds
        .map(unitId => gameState.units.find(unit => unit.id === unitId))
        .filter((unit): unit is Unit => Boolean(unit))
    : [];

  const handleAbilityTargetPick = (unitId: string) => {
    if (!abilityTargetMode.isActive) return;
    if (!abilityTargetMode.eligibleUnitIds.includes(unitId)) return;

    if (abilityTargetMode.onSelectUnit) {
      abilityTargetMode.onSelectUnit(unitId);
    } else {
      setAbilityTargetSelection(unitId);
    }

    const unit = gameState.units.find((candidate) => candidate.id === unitId);
    if (unit) {
      setSelectedUnit(unit);
    }
  };

  const handleConfirmAbilityTarget = () => {
    if (!abilityTargetMode.isActive || !abilityTargetMode.abilityId) return;
    if (!abilityTargetMode.selectedUnitId) {
      toast?.info('Select a Unit', 'Choose an eligible unit before confirming this ability.');
      return;
    }

    handleActivateAbility(abilityTargetMode.abilityId, abilityTargetMode.selectedUnitId);
  };

  const activeAbilityDefinition = abilityTargetMode.isActive && abilityTargetMode.abilityId
    ? ABILITIES[abilityTargetMode.abilityId]
    : null;
  const activeFactionAbility = abilityTargetMode.isActive && abilityTargetMode.abilityId
    ? factionAbilityOptions.find(option => option.id === abilityTargetMode.abilityId)
    : undefined;

  // Victory conditions are automatically checked in the game reducer during END_TURN
  // The VictoryScreen component will render when gameState.winner is set

  // Determine victory type based on winner's stats
  const getVictoryType = (): 'faith' | 'territorial' | 'elimination' | 'domination' => {
    if (!gameState?.winner) return 'faith';
    
    const winner = gameState.players.find(p => p.id === gameState.winner);
    if (!winner) return 'faith';

    // Check faith victory
    if (winner.stats.faith >= 100 && winner.stats.internalDissent < 10) {
      return 'faith';
    }

    // Check territorial victory
    const totalCities = gameState.map.tiles.filter(tile => tile.hasCity).length;
    const playerCities = winner.citiesOwned.length;
    if (totalCities > 0 && playerCities / totalCities >= 0.75) {
      return 'territorial';
    }

    // Check elimination (only one player with units)
    const playersWithUnits = new Set(gameState.units.map(unit => unit.playerId));
    if (playersWithUnits.size === 1) {
      return 'elimination';
    }

    // Default to domination
    return 'domination';
  };

  const handleUseAbility = (abilityId: string) => {
    const definition = ABILITIES[abilityId];
    const validation = validateAbilityForPlayer(definition, abilityId, currentPlayer);
    if (!validation.ok) {
      switch (validation.reason) {
        case 'missing':
          toast?.error('Ability Unavailable', 'Ability definition not found.');
          break;
        case 'cooldown':
          toast?.info('Cooling Down', `Available in ${validation.cooldownRemaining} turn${validation.cooldownRemaining && validation.cooldownRemaining > 1 ? 's' : ''}.`);
          break;
        case 'requirements':
          toast?.info('Requirements Not Met', validation.unmetRequirements?.join(' • ') || '');
          break;
      }
      return;
    }
    useAbility(currentPlayer.id, abilityId);
  };

  const handleActivateAbility = (abilityId: string, targetId?: string) => {
    if (abilityTargetMode.isActive && abilityTargetMode.abilityId !== abilityId) {
      cancelAbilityTargeting();
    }

    const targetedMeta = TARGETED_FACTION_ABILITIES[abilityId];
    if (targetedMeta && !targetId) {
      const eligibleUnits = gameState.units.filter(unit => unit.playerId === currentPlayer.id);
      if (eligibleUnits.length === 0) {
        toast?.warning('No Eligible Units', targetedMeta.emptyMessage || 'You need an active unit to use this ability.');
        return;
      }
      if (eligibleUnits.length === 1) {
        handleActivateAbility(abilityId, eligibleUnits[0].id);
        return;
      }

      setSelectedUnit(null); // Require a fresh selection to avoid accidental triggers
      startAbilityTargeting({
        abilityId,
        title: targetedMeta.title,
        instructions: targetedMeta.instructions,
        eligibleUnitIds: eligibleUnits.map(unit => unit.id),
        onSelectUnit: (unitId) => setAbilityTargetSelection(unitId),
      });
      setAbilityTargetSelection(null);
      toast?.info('Select Unit', targetedMeta.toast);
      return;
    }

    cancelAbilityTargeting();

    const definition = ABILITIES[abilityId];
    const validation = validateAbilityForPlayer(definition, abilityId, currentPlayer);
    if (!validation.ok) {
      switch (validation.reason) {
        case 'missing':
          toast?.error('Ability Unavailable', 'Ability definition not found.');
          break;
        case 'cooldown':
          toast?.info('Cooling Down', `Available in ${validation.cooldownRemaining} turn${validation.cooldownRemaining && validation.cooldownRemaining > 1 ? 's' : ''}.`);
          break;
        case 'requirements':
          toast?.info('Requirements Not Met', validation.unmetRequirements?.join(' • ') || '');
          break;
      }
      return;
    }

    const action = {
      type: 'USE_ABILITY' as const,
      payload: {
        playerId: currentPlayer.id,
        abilityId,
        targetUnitId: targetId
      }
    };
    
    const { dispatch } = useLocalGame.getState();
    dispatch(action);
  };

  const handleAttackUnit = (attackerId: string, targetId: string) => {
    if (!gameState) return;

    const attackerUnit = gameState.units.find(unit => unit.id === attackerId);
    const defenderUnit = gameState.units.find(unit => unit.id === targetId);

    if (attackerUnit && defenderUnit) {
      const distance = hexDistance(attackerUnit.coordinate, defenderUnit.coordinate);
      const isRangedAttack = distance > 1 && attackerUnit.attackRange > 1;
      const isUndeployedCatapult = attackerUnit.type === 'catapult' && isRangedAttack && attackerUnit.status !== 'siege_mode';

      if (isUndeployedCatapult) {
        toast?.warning('Deploy Siege Mode', 'Deploy your catapult into siege mode before bombardment. Use the siege ability first, then fire.');
        return;
      }
    }

    attackUnit(attackerId, targetId);
    setAttackMode(false);

    const latestState = useLocalGame.getState().gameState;
    const updatedUnit = latestState?.units.find(u => u.id === attackerId);
    setSelectedUnit(updatedUnit || null);
  };

  const handleUnitAction = (action: string) => {
    if (!selectedUnit) return;
    
    switch (action) {
      case 'attack':
        // Enter attack mode - show attack indicators
        setAttackMode(true);
        break;
      case 'move':
        // Enter move mode - show movement indicators
        setMovementMode(true);
        break;
      case 'ability':
        // Use unit ability
        break;
    }
  };

  const handleShowCityPanel = () => {
    const playerCity = gameState.cities?.find(city => 
      currentPlayer.citiesOwned.includes(city.id)
    );
    if (playerCity) {
      setSelectedCityId(playerCity.id);
      setShowCityPanel(true);
    }
  };

  const handleShowConstructionHall = () => {
    const playerCity = gameState.cities?.find(city => 
      currentPlayer.citiesOwned.includes(city.id)
    );
    if (playerCity) {
      setSelectedCityId(playerCity.id);
      setShowConstructionHall(true);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Construction Mode Indicator - Positioned in top-right corner */}
      {constructionMode.isActive && (
        <div className="absolute top-4 right-4 pointer-events-auto z-50">
          <div className="bg-black/90 text-white px-4 py-3 rounded-lg border-2 border-yellow-400 shadow-lg backdrop-blur-sm max-w-xs">
            <div className="text-center">
              <h3 className="text-sm font-bold mb-1">Construction Mode</h3>
              <p className="text-xs mb-2">Select a tile to build: <span className="font-semibold text-yellow-300">{constructionMode.buildingType}</span></p>
              <button 
                onClick={cancelConstruction}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Mode Controls */}
      {isMovementMode && selectedUnit && (
        <MovementControls 
          selectedUnit={selectedUnit}
          reachableCount={reachableCoordinates.length}
        />
      )}

      {/* Player HUD */}
      <PlayerHUD
        player={currentPlayer}
        gameState={gameState}
        onShowTechPanel={() => setShowTechPanel(true)}
        onShowConstructionHall={handleShowConstructionHall}
<<<<<<< Updated upstream
        onEndTurn={handleEndTurn}
        abilities={factionAbilityOptions}
        onActivateAbility={handleActivateAbility}
=======
>>>>>>> Stashed changes
      />

      {/* Selected Unit Panel - Unified interface with all unit actions */}
      {selectedUnit && (
        <SelectedUnitPanel unit={selectedUnit} />
      )}

      {/* Combat Panel removed - all functionality consolidated into SelectedUnitPanel */}

      {/* NOTE: Faction Abilities Panel removed - consolidated into unit-specific UnitActionsPanel */}

      {/* Tech Panel Modal */}
      <TechPanel
        isOpen={showTechPanel}
        onClose={() => setShowTechPanel(false)}
        gameState={gameState}
        currentPlayer={currentPlayer}
        onResearchTech={(techId) => {
          const tech = getTechnology(techId);
          if (!tech) {
            toast?.error('Technology unavailable', 'That discovery is not currently part of this build.');
            return;
          }

          if (currentPlayer.researchedTechs.includes(techId)) {
            toast?.info('Already researched', `${tech.name} is already part of your civilization's knowledge.`);
            return;
          }

          if (!playerHasTechPrerequisites(currentPlayer, tech)) {
            const missingNames = tech.prerequisites
              .filter(prereq => !currentPlayer.researchedTechs.includes(prereq))
              .map(prereq => getTechnology(prereq)?.name ?? prereq.replace(/_/g, ' '))
              .join(', ');
            toast?.warning(
              'Prerequisites missing',
              missingNames
                ? `Research ${missingNames} first.`
                : 'Meet the prerequisite technologies before unlocking this.'
            );
            return;
          }

          const { baseCost, discount, finalCost } = getTechCostDetails(tech, currentPlayer);
          if (currentPlayer.stars < finalCost) {
            toast?.error(
              'Not enough stars',
              `Requires ${finalCost} stars, but you only have ${currentPlayer.stars}.`
            );
            return;
          }

          if (!canPlayerResearchTechnology(currentPlayer, tech)) {
            toast?.error('Research blocked', 'This technology cannot be researched right now.');
            return;
          }

          dispatch({
            type: 'RESEARCH_TECHNOLOGY',
            payload: { playerId: currentPlayer.id, technologyId: techId },
          });

          toast?.success(
            'Technology researched',
            discount > 0
              ? `${tech.name} unlocked! Saved ${discount} star${discount === 1 ? '' : 's'} from inspiration (cost ${finalCost}/${baseCost}).`
              : `${tech.name} unlocked for ${finalCost} star${finalCost === 1 ? '' : 's'}.`
          );
        }}
      />

      {/* City Panel Modal */}
      {selectedCityId && (
        <CityPanel
          isOpen={showCityPanel}
          onClose={() => setShowCityPanel(false)}
          city={gameState.cities?.find(c => c.id === selectedCityId)!}
          gameState={gameState}
          currentPlayer={currentPlayer}
        />
      )}

      {/* Construction Hall */}
      {showConstructionHall && selectedCityId && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto"
          style={{ touchAction: 'pan-y pinch-zoom' }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowConstructionHall(false);
            }
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowConstructionHall(false);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <BuildingMenu
              city={gameState.cities?.find(c => c.id === selectedCityId)!}
              player={currentPlayer}
              gameState={gameState}
              onBuild={(optionId) => {
                // Handle construction logic
                // Determine building category
                let category: 'improvements' | 'structures' | 'units';
                
                if (Object.values(STRUCTURE_DEFINITIONS).some(s => s.id === optionId)) {
                  category = 'structures';
                } else if (Object.values(UNIT_DEFINITIONS).some(u => u.type === optionId)) {
                  category = 'units';
                } else {
                  category = 'improvements';
                }
                
                // Use the game state construction system
                const { startConstruction } = useGameState.getState();
                startConstruction(optionId, category, selectedCityId, currentPlayer.id);
                setShowConstructionHall(false);
              }}
              onClose={() => setShowConstructionHall(false)}
              onShowCities={() => {
                setShowConstructionHall(false);
                setShowCityPanel(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Victory Screen */}
      {gameState?.winner && (
        <VictoryScreen
          winnerId={gameState.winner}
          victoryType={getVictoryType()}
          onPlayAgain={() => {
            resetGame();
            setGamePhase('menu');
          }}
          onMainMenu={() => {
            resetGame();
            setGamePhase('menu');
          }}
        />
      )}

      {/* Save/Load Menu */}
      {showSaveLoadMenu && (
        <SaveLoadMenu
          onClose={() => setShowSaveLoadMenu(false)}
        />
      )}

      {/* World Element Panel */}
      {selectedWorldElement && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm pointer-events-auto"
          style={{ touchAction: 'pan-y pinch-zoom' }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setSelectedWorldElement(null);
            }
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setSelectedWorldElement(null);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <WorldElementPanel
              gameState={gameState}
              playerId={currentPlayer.id}
              elementId={selectedWorldElement.elementId}
              coordinate={selectedWorldElement.coordinate}
              onAction={handleWorldElementAction}
              onClose={() => setSelectedWorldElement(null)}
            />
          </div>
        </div>
      )}

      {/* Advanced Save System */}
      {showAdvancedSaveSystem && (
        <SaveSystem
          currentGameState={gameState}
          onLoadGame={(loadedState) => {
            loadGameState(loadedState);
            setShowAdvancedSaveSystem(false);
          }}
          onClose={() => setShowAdvancedSaveSystem(false)}
        />
      )}

      {/* Turn Transition Animation */}
      <TurnTransition
        isVisible={isTransitioning}
        currentPlayer={pendingPlayer || currentPlayer}
        onComplete={completeTransition}
      />

      {/* Enhanced Unit Selection UI */}
      <UnitSelectionUI
        selectedUnit={selectedUnit}
        onUnitAction={handleUnitAction}
      />

      <AbilityTargetOverlay
        isOpen={abilityTargetMode.isActive && Boolean(abilityTargetMode.abilityId)}
        title={abilityTargetMode.title || 'Select Unit'}
        instructions={abilityTargetMode.instructions || 'Choose an eligible unit to continue.'}
        units={abilityTargetUnits}
        selectedUnitId={abilityTargetMode.selectedUnitId}
        abilityDefinition={activeAbilityDefinition || undefined}
        abilityMeta={activeFactionAbility?.meta}
        onSelectUnit={handleAbilityTargetPick}
        onConfirm={handleConfirmAbilityTarget}
        onCancel={cancelAbilityTargeting}
      />

      {showTelemetry && (
        <div className="fixed bottom-28 right-6 z-[120] pointer-events-auto">
          <TelemetryPanel limit={40} />
        </div>
      )}

      {/* Action Buttons - Bottom Right */}
      <div className="pointer-events-auto fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          className={`px-3 py-2 rounded-lg border transition-colors shadow-lg text-sm ${
            showTelemetry
              ? 'bg-purple-700/70 border-purple-400 text-white hover:bg-purple-600/80'
              : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
          }`}
          onClick={() => setShowTelemetry(prev => !prev)}
          title={showTelemetry ? "Hide Combat Log" : "Show Combat Log"}
        >
          📜 {showTelemetry ? 'Hide Combat Log' : 'Combat Log'}
        </button>
        <button
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-all shadow-lg text-sm"
          onClick={() => setShowAdvancedSaveSystem(true)}
          title="Advanced Save System"
        >
          💾 Advanced Save
        </button>
      </div>
    </div>
  );
}
