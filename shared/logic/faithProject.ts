import type { HexCoordinate } from "../types/coordinates";
import type { City } from "../types/city";
import type { FaithProjectState, GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";
import { GAME_RULES } from "../data/gameRules";
import { getUnitDefinition } from "../data/units";
import { hexDistance } from "../utils/hex";

export const FAITH_PROJECT_EVENTS = {
  started: "FAITH_PROJECT_STARTED",
  progress: "FAITH_PROJECT_PROGRESS",
  paused: "FAITH_PROJECT_PAUSED",
  interrupted: "FAITH_PROJECT_INTERRUPTED",
  completed: "FAITH_PROJECT_COMPLETED",
  lossShock: "FAITH_LOSS_SHOCK",
} as const;

export type FaithProjectEvent = {
  type: typeof FAITH_PROJECT_EVENTS[keyof typeof FAITH_PROJECT_EVENTS];
  payload: Record<string, unknown>;
};

export type FaithProjectValidation = {
  ok: boolean;
  reasons: string[];
  holyCityIds: [string, string, string] | null;
};

export type FaithProjectResolution = {
  state: GameState;
  events: FaithProjectEvent[];
  completed: boolean;
};

function getFaithVictoryRules() {
  return GAME_RULES.victory.faithVictory;
}

function asHolyCityTuple(cityIds: readonly string[]): [string, string, string] | null {
  if (cityIds.length !== getFaithVictoryRules().holyCitiesRequired) return null;
  const uniqueIds = Array.from(new Set(cityIds));
  if (uniqueIds.length !== getFaithVictoryRules().holyCitiesRequired) return null;
  return [uniqueIds[0], uniqueIds[1], uniqueIds[2]];
}

export function getActiveFaithProject(player: PlayerState | undefined): FaithProjectState | null {
  return player?.faithProject?.active ? player.faithProject : null;
}

function getOwnedCities(state: GameState, playerId: string): City[] {
  return (state.cities || []).filter(city => city.ownerId === playerId);
}

function getCompletedCityStructureCount(
  state: GameState,
  playerId: string,
  cityIds: readonly string[],
  structureType: string,
): number {
  const cityIdSet = new Set(cityIds);
  return (state.structures || []).filter(structure =>
    structure.ownerId === playerId &&
    cityIdSet.has(structure.cityId) &&
    structure.type === structureType &&
    (structure.constructionTurns ?? 0) <= 0
  ).length;
}

export function cityHasCompletedStructure(
  state: GameState,
  playerId: string,
  cityId: string,
  structureType: string,
): boolean {
  return getCompletedCityStructureCount(state, playerId, [cityId], structureType) > 0;
}

function getSelectedCities(
  state: GameState,
  playerId: string,
  holyCityIds: readonly string[],
): City[] {
  const selected = new Set(holyCityIds);
  return getOwnedCities(state, playerId).filter(city => selected.has(city.id));
}

export function isEnemyMilitaryUnit(unit: Unit, playerId: string): boolean {
  if (unit.playerId === playerId) return false;
  const definition = getUnitDefinition(unit.type);
  const tags = definition?.tags ?? [];
  return !tags.includes("civilian") && !tags.includes("influence") && !tags.includes("diplomat");
}

export function getHolyCityContestState(
  state: GameState,
  playerId: string,
  holyCityIds: readonly string[],
): {
  contestedCityIds: string[];
  enemyUnitIds: string[];
} {
  const radius = getFaithVictoryRules().militaryContestRadius;
  const holyCities = getSelectedCities(state, playerId, holyCityIds);
  const contestedCityIds = new Set<string>();
  const enemyUnitIds = new Set<string>();

  for (const unit of state.units || []) {
    if (!isEnemyMilitaryUnit(unit, playerId)) continue;
    for (const city of holyCities) {
      if (hexDistance(unit.coordinate, city.coordinate) <= radius) {
        contestedCityIds.add(city.id);
        enemyUnitIds.add(unit.id);
      }
    }
  }

  return {
    contestedCityIds: Array.from(contestedCityIds),
    enemyUnitIds: Array.from(enemyUnitIds),
  };
}

function validateHolyCityCoverage(
  state: GameState,
  playerId: string,
  holyCityIds: readonly string[],
): string[] {
  const rules = getFaithVictoryRules();
  const reasons: string[] = [];
  const selectedCities = getSelectedCities(state, playerId, holyCityIds);

  if (selectedCities.length !== rules.holyCitiesRequired) {
    reasons.push(`Select ${rules.holyCitiesRequired} owned cities.`);
  }

  const templeCount = getCompletedCityStructureCount(state, playerId, holyCityIds, "temple");
  if (templeCount < rules.templeCitiesRequired) {
    reasons.push(`All ${rules.templeCitiesRequired} holy cities need completed Temples.`);
  }

  const cathedralCount = getCompletedCityStructureCount(state, playerId, holyCityIds, "cathedral");
  if (cathedralCount < rules.cathedralCitiesRequired) {
    reasons.push(`At least ${rules.cathedralCitiesRequired} holy city needs a completed Cathedral.`);
  }

  return reasons;
}

export function validateFaithProjectStart(
  state: GameState,
  playerId: string,
  holyCityIds: readonly string[],
): FaithProjectValidation {
  const rules = getFaithVictoryRules();
  const player = state.players.find(candidate => candidate.id === playerId);
  const tuple = asHolyCityTuple(holyCityIds);
  const reasons: string[] = [];

  if (!rules.enabled) reasons.push("Consecration Victory is disabled.");
  if (!player) reasons.push("Player not found.");
  if (!tuple) reasons.push(`Choose exactly ${rules.holyCitiesRequired} different holy cities.`);

  if (!player || !tuple) {
    return { ok: false, reasons, holyCityIds: null };
  }

  if (getActiveFaithProject(player)) {
    reasons.push("A Faith Project is already active.");
  }
  if (state.turn < rules.minTurnToStart) {
    reasons.push(`Available on turn ${rules.minTurnToStart}.`);
  }
  if (player.citiesOwned.length < rules.minCities) {
    reasons.push(`Own at least ${rules.minCities} cities.`);
  }
  if (player.stats.faith < rules.minFaithToStart) {
    reasons.push(`Need ${rules.minFaithToStart} Faith.`);
  }
  if (player.stats.internalDissent > rules.maxDissentToStart) {
    reasons.push(`Dissent must be ${rules.maxDissentToStart} or lower.`);
  }
  if (player.stars < rules.startStarsCost) {
    reasons.push(`Need ${rules.startStarsCost} Stars.`);
  }

  reasons.push(...validateHolyCityCoverage(state, playerId, tuple));

  return {
    ok: reasons.length === 0,
    reasons,
    holyCityIds: tuple,
  };
}

export function canStartFaithProject(
  state: GameState,
  playerId: string,
  holyCityIds: readonly string[],
): boolean {
  return validateFaithProjectStart(state, playerId, holyCityIds).ok;
}

export function getFaithProjectStartOptions(state: GameState, playerId: string): City[] {
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return [];
  return getOwnedCities(state, playerId).filter(city =>
    cityHasCompletedStructure(state, playerId, city.id, "temple")
  );
}

export function startFaithProject(
  state: GameState,
  payload: { playerId: string; holyCityIds: [string, string, string] },
): FaithProjectResolution {
  const validation = validateFaithProjectStart(state, payload.playerId, payload.holyCityIds);
  if (!validation.ok || !validation.holyCityIds) {
    return { state, events: [], completed: false };
  }

  const rules = getFaithVictoryRules();
  const holyCityIds = validation.holyCityIds;
  const nextState: GameState = {
    ...state,
    players: state.players.map(player => {
      if (player.id !== payload.playerId) return player;
      return {
        ...player,
        stars: Math.max(0, player.stars - rules.startStarsCost),
        stats: {
          ...player.stats,
          faith: Math.max(0, player.stats.faith - rules.startFaithCost),
        },
        faithProject: {
          active: true,
          progress: 0,
          holyCityIds,
          startedTurn: state.turn,
          pausedReason: null,
        },
      };
    }),
  };

  return {
    state: nextState,
    completed: false,
    events: [{
      type: FAITH_PROJECT_EVENTS.started,
      payload: {
        playerId: payload.playerId,
        holyCityIds,
        progress: 0,
      },
    }],
  };
}

export function getFaithProjectResetReasons(
  state: GameState,
  playerId: string,
  project: FaithProjectState,
): string[] {
  const rules = getFaithVictoryRules();
  const player = state.players.find(candidate => candidate.id === playerId);
  const reasons: string[] = [];
  if (!player) return ["Player no longer exists."];

  const selectedCities = getSelectedCities(state, playerId, project.holyCityIds);
  if (rules.resetOnHolyCityLoss && selectedCities.length !== project.holyCityIds.length) {
    reasons.push("A holy city was lost.");
  }

  const buildingReasons = validateHolyCityCoverage(state, playerId, project.holyCityIds);
  if (rules.resetOnHolyBuildingLoss && buildingReasons.length > 0) {
    reasons.push("Holy city Temple/Cathedral coverage was lost.");
  }

  if (player.stats.faith < rules.minFaithToMaintain) {
    reasons.push(`Faith fell below ${rules.minFaithToMaintain}.`);
  }
  if (player.stats.internalDissent > rules.maxDissentToMaintain) {
    reasons.push(`Dissent rose above ${rules.maxDissentToMaintain}.`);
  }

  return reasons;
}

export function getFaithProjectPauseReasons(
  state: GameState,
  playerId: string,
  project: FaithProjectState,
): string[] {
  const rules = getFaithVictoryRules();
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return ["Player no longer exists."];

  const reasons: string[] = [];
  if (rules.pauseIfAtWar && (player.atWarWith || []).length > 0) {
    reasons.push("At war.");
  }

  if (rules.pauseIfEnemyAdjacentToHolyCity) {
    const contested = getHolyCityContestState(state, playerId, project.holyCityIds);
    if (contested.contestedCityIds.length > 0) {
      reasons.push("Enemy military adjacent to a holy city.");
    }
  }

  if (player.stats.faith < rules.faithCostPerProgress || player.stars < rules.starsCostPerProgress) {
    reasons.push(`Cannot pay upkeep (${rules.faithCostPerProgress} Faith, ${rules.starsCostPerProgress} Stars).`);
  }

  return reasons;
}

function setFaithProjectForPlayer(
  state: GameState,
  playerId: string,
  faithProject: FaithProjectState | null,
): GameState {
  return {
    ...state,
    players: state.players.map(player =>
      player.id === playerId ? { ...player, faithProject } : player
    ),
  };
}

export function resolveFaithProjectOnEndTurn(
  state: GameState,
  playerId: string,
): FaithProjectResolution {
  const rules = getFaithVictoryRules();
  if (!rules.enabled) return { state, events: [], completed: false };

  const player = state.players.find(candidate => candidate.id === playerId);
  const project = getActiveFaithProject(player);
  if (!player || !project) return { state, events: [], completed: false };

  const resetReasons = getFaithProjectResetReasons(state, playerId, project);
  if (resetReasons.length > 0) {
    const interruptedState = setFaithProjectForPlayer(state, playerId, null);
    return {
      state: interruptedState,
      completed: false,
      events: [{
        type: FAITH_PROJECT_EVENTS.interrupted,
        payload: {
          playerId,
          holyCityIds: project.holyCityIds,
          reason: resetReasons[0],
          reasons: resetReasons,
        },
      }],
    };
  }

  const pauseReasons = getFaithProjectPauseReasons(state, playerId, project);
  if (pauseReasons.length > 0) {
    const pausedProject = { ...project, pausedReason: pauseReasons[0] };
    return {
      state: setFaithProjectForPlayer(state, playerId, pausedProject),
      completed: false,
      events: [{
        type: FAITH_PROJECT_EVENTS.paused,
        payload: {
          playerId,
          holyCityIds: project.holyCityIds,
          progress: project.progress,
          reason: pauseReasons[0],
          reasons: pauseReasons,
        },
      }],
    };
  }

  const nextProgress = project.progress + 1;
  const completed = nextProgress >= rules.progressToWin;
  const nextProject: FaithProjectState = {
    ...project,
    active: !completed,
    progress: Math.min(nextProgress, rules.progressToWin),
    pausedReason: null,
  };

  const progressedState: GameState = {
    ...state,
    players: state.players.map(candidate => {
      if (candidate.id !== playerId) return candidate;
      return {
        ...candidate,
        stars: Math.max(0, candidate.stars - rules.starsCostPerProgress),
        stats: {
          ...candidate.stats,
          faith: Math.max(0, candidate.stats.faith - rules.faithCostPerProgress),
        },
        faithProject: nextProject,
      };
    }),
  };

  const progressEvent: FaithProjectEvent = {
    type: completed ? FAITH_PROJECT_EVENTS.completed : FAITH_PROJECT_EVENTS.progress,
    payload: {
      playerId,
      holyCityIds: project.holyCityIds,
      progress: nextProject.progress,
      requiredProgress: rules.progressToWin,
      faithCost: rules.faithCostPerProgress,
      starsCost: rules.starsCostPerProgress,
    },
  };

  return {
    state: progressedState,
    events: [progressEvent],
    completed,
  };
}

export function applyFaithLossShock(
  state: GameState,
  playerId: string | undefined,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {},
): FaithProjectResolution {
  if (!playerId || amount <= 0) {
    return { state, events: [], completed: false };
  }

  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return { state, events: [], completed: false };

  let nextState: GameState = {
    ...state,
    players: state.players.map(candidate => {
      if (candidate.id !== playerId) return candidate;
      return {
        ...candidate,
        stats: {
          ...candidate.stats,
          faith: Math.max(0, candidate.stats.faith - amount),
        },
      };
    }),
  };

  const events: FaithProjectEvent[] = [{
    type: FAITH_PROJECT_EVENTS.lossShock,
    payload: {
      playerId,
      faithLoss: amount,
      reason,
      ...metadata,
    },
  }];

  const refreshedPlayer = nextState.players.find(candidate => candidate.id === playerId);
  const project = getActiveFaithProject(refreshedPlayer);
  if (project) {
    const resetReasons = getFaithProjectResetReasons(nextState, playerId, project);
    if (resetReasons.length > 0) {
      nextState = setFaithProjectForPlayer(nextState, playerId, null);
      events.push({
        type: FAITH_PROJECT_EVENTS.interrupted,
        payload: {
          playerId,
          holyCityIds: project.holyCityIds,
          reason: resetReasons[0],
          reasons: resetReasons,
        },
      });
    }
  }

  return { state: nextState, events, completed: false };
}

export function applyUnitDeathFaithShock(state: GameState, unit: Unit): FaithProjectResolution {
  const rules = getFaithVictoryRules();
  if (unit.type === "missionary") {
    return applyFaithLossShock(state, unit.playerId, rules.missionaryDeathFaithLoss, "Missionary was killed.", {
      unitId: unit.id,
      unitType: unit.type,
    });
  }

  if (unit.type === "converted_missionary") {
    return applyFaithLossShock(state, unit.playerId, rules.convertedMissionaryDeathFaithLoss, "Converted Missionary was killed.", {
      unitId: unit.id,
      unitType: unit.type,
    });
  }

  return { state, events: [], completed: false };
}

export function applyCityLossFaithShock(
  state: GameState,
  previousOwnerId: string | undefined,
  cityId: string,
  options?: { hadTemple?: boolean; hadCathedral?: boolean },
): FaithProjectResolution {
  const rules = getFaithVictoryRules();
  if (!previousOwnerId) return { state, events: [], completed: false };

  const faithLoss =
    (options?.hadTemple ? rules.templeCityLossFaithLoss : 0) +
    (options?.hadCathedral ? rules.cathedralCityLossFaithLoss : 0);

  const shock = faithLoss > 0
    ? applyFaithLossShock(state, previousOwnerId, faithLoss, "A holy building city was lost.", {
        cityId,
        hadTemple: Boolean(options?.hadTemple),
        hadCathedral: Boolean(options?.hadCathedral),
      })
    : { state, events: [], completed: false };

  const player = shock.state.players.find(candidate => candidate.id === previousOwnerId);
  const project = getActiveFaithProject(player);
  if (!project || !project.holyCityIds.includes(cityId)) {
    return shock;
  }

  const nextState = setFaithProjectForPlayer(shock.state, previousOwnerId, null);
  return {
    state: nextState,
    completed: false,
    events: [
      ...shock.events,
      {
        type: FAITH_PROJECT_EVENTS.interrupted,
        payload: {
          playerId: previousOwnerId,
          holyCityIds: project.holyCityIds,
          cityId,
          reason: "A holy city was lost.",
          reasons: ["A holy city was lost."],
        },
      },
    ],
  };
}

export function applyCityOwnershipFaithConsequences(
  beforeState: GameState,
  afterState: GameState,
  cityId: string,
  newOwnerId: string,
): FaithProjectResolution {
  const beforeCity = (beforeState.cities || []).find(city => city.id === cityId);
  const previousOwnerId = beforeCity?.ownerId;
  if (!previousOwnerId || previousOwnerId === newOwnerId) {
    return { state: afterState, events: [], completed: false };
  }

  const completedCityStructures = (beforeState.structures || []).filter(structure =>
    structure.cityId === cityId && (structure.constructionTurns ?? 0) <= 0
  );
  const hadTemple = completedCityStructures.some(structure => structure.type === "temple");
  const hadCathedral = completedCityStructures.some(structure => structure.type === "cathedral");

  return applyCityLossFaithShock(afterState, previousOwnerId, cityId, {
    hadTemple,
    hadCathedral,
  });
}

export function isPlayerThreateningFaithVictory(player: PlayerState, state: GameState): boolean {
  const rules = getFaithVictoryRules();
  if (!rules.enabled || player.isEliminated) return false;
  const project = getActiveFaithProject(player);
  if (project) return true;

  if (state.turn < rules.minTurnToStart - 5) return false;
  if (player.citiesOwned.length < rules.minCities) return false;
  if (player.stats.faith < Math.max(rules.minFaithToMaintain, rules.minFaithToStart - 10)) return false;
  if (player.stats.internalDissent > rules.maxDissentToMaintain) return false;

  const templeCities = getOwnedCities(state, player.id).filter(city =>
    cityHasCompletedStructure(state, player.id, city.id, "temple")
  );
  const cathedralCities = templeCities.filter(city =>
    cityHasCompletedStructure(state, player.id, city.id, "cathedral")
  );

  return templeCities.length >= rules.holyCitiesRequired &&
    cathedralCities.length >= rules.cathedralCitiesRequired;
}

export function getFaithProjectHolyCityCoordinates(
  state: GameState,
  project: FaithProjectState | null | undefined,
): HexCoordinate[] {
  if (!project?.active) return [];
  const ids = new Set(project.holyCityIds);
  return (state.cities || [])
    .filter(city => ids.has(city.id))
    .map(city => city.coordinate);
}
