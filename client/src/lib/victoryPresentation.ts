import { GAME_RULES, GameRuleHelpers } from "@shared/data/gameRules";
import { TECHNOLOGIES } from "@shared/data/technologies";
import { STRUCTURE_DEFINITIONS, type City, type Improvement, type Structure } from "@shared/types/city";
import type { GameState, PlayerState } from "@shared/types/game";
import { coerceFactionId } from "@shared/types/factionId";
import { areCitiesConnectedByRoad } from "@shared/logic/tradeRoutes";
import { computeUnitPassiveEffectsForPlayer } from "@shared/logic/unitPassiveEffects";
import { hexNeighbors } from "@shared/utils/hex";

export type VictoryType = NonNullable<GameState["victoryType"]>;

export interface VictoryLogEntry {
  id: string;
  turn: number;
  playerId: string;
  playerName: string;
  type: string;
  message: string;
  timestamp: number;
}

export interface VictoryTheme {
  title: string;
  shortTitle: string;
  banner: string;
  revealLine: string;
  description: string;
  accentColor: string;
  accentSoft: string;
  particleTone: "faith" | "capture" | "reward" | "discovery";
  pulseTone: "conversion" | "capture" | "tech" | "construction";
  glowClass: string;
  badgeClass: string;
  heroClass: string;
  edgeClass: string;
}

export interface VictoryMetricCard {
  key: string;
  label: string;
  value: string;
  detail: string;
  progress: number;
}

export interface FinalStat {
  label: string;
  value: string;
  tone: string;
}

export interface RankedPlayer {
  player: PlayerState;
  unitsRemaining: number;
  population: number;
  score: number;
  isWinner: boolean;
}

export interface PowerPoint {
  label: string;
  winnerValue: number;
  runnerUpValue: number;
  scaleMax: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const VICTORY_THEMES: Record<VictoryType, VictoryTheme> = {
  faith: {
    title: "Consecration Victory",
    shortTitle: "Consecration",
    banner: "Covenant Fulfilled",
    revealLine: "Holy radiance travels between the three consecrated cities as the land answers the covenant.",
    description:
      "Through sustained faith, low dissent, and protected holy cities, you completed the Consecration project.",
    accentColor: "#8dd8ff",
    accentSoft: "rgba(141, 216, 255, 0.22)",
    particleTone: "faith",
    pulseTone: "conversion",
    glowClass: "from-sky-300/35 via-cyan-300/10 to-transparent",
    badgeClass: "border-sky-300/30 bg-sky-400/10 text-sky-100",
    heroClass: "from-slate-950/95 via-sky-950/35 to-amber-950/85",
    edgeClass: "border-sky-300/25",
  },
  territorial: {
    title: "Territorial Conquest",
    shortTitle: "Conquest",
    banner: "Banners Across The Frontier",
    revealLine: "Standards rise over the captured cities and the frontier hardens under one rule.",
    description:
      "By controlling the majority of cities and territories, you have established your dominion over the promised land.",
    accentColor: "#c7a4ff",
    accentSoft: "rgba(199, 164, 255, 0.22)",
    particleTone: "capture",
    pulseTone: "capture",
    glowClass: "from-violet-300/35 via-fuchsia-300/10 to-transparent",
    badgeClass: "border-violet-300/30 bg-violet-400/10 text-violet-100",
    heroClass: "from-slate-950/95 via-violet-950/35 to-amber-950/80",
    edgeClass: "border-violet-300/25",
  },
  elimination: {
    title: "Total Domination",
    shortTitle: "Domination",
    banner: "The Last Rival Fell",
    revealLine: "The field falls silent as the final rival banners disappear from the world.",
    description:
      "Through strategic warfare and tactical brilliance, you have eliminated all opposing forces.",
    accentColor: "#ff9c8a",
    accentSoft: "rgba(255, 156, 138, 0.24)",
    particleTone: "capture",
    pulseTone: "capture",
    glowClass: "from-rose-300/35 via-orange-300/10 to-transparent",
    badgeClass: "border-rose-300/30 bg-rose-400/10 text-rose-100",
    heroClass: "from-slate-950/95 via-rose-950/35 to-orange-950/80",
    edgeClass: "border-rose-300/25",
  },
  economic: {
    title: "Economic Supremacy",
    shortTitle: "Economic",
    banner: "Treasury Unbound",
    revealLine: "Trade routes ignite, markets roar, and the treasury eclipses every rival court.",
    description:
      "Your thriving economy and mastery of commerce have secured prosperity beyond all rivals.",
    accentColor: "#ffd56b",
    accentSoft: "rgba(255, 213, 107, 0.22)",
    particleTone: "reward",
    pulseTone: "tech",
    glowClass: "from-amber-300/35 via-yellow-300/10 to-transparent",
    badgeClass: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    heroClass: "from-slate-950/95 via-amber-950/30 to-yellow-950/80",
    edgeClass: "border-amber-300/25",
  },
  cultural: {
    title: "Cultural Ascendancy",
    shortTitle: "Cultural",
    banner: "Festival Of The Ages",
    revealLine: "Sacred sites shine, plazas awaken, and the people answer with celebration.",
    description:
      "Your people have forged a lasting legacy of learning, worship, and civic harmony.",
    accentColor: "#89f0c6",
    accentSoft: "rgba(137, 240, 198, 0.22)",
    particleTone: "discovery",
    pulseTone: "construction",
    glowClass: "from-emerald-300/35 via-teal-300/10 to-transparent",
    badgeClass: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    heroClass: "from-slate-950/95 via-emerald-950/32 to-teal-950/80",
    edgeClass: "border-emerald-300/25",
  },
  domination: {
    title: "Strategic Supremacy",
    shortTitle: "Strategic",
    banner: "The Final Reckoning",
    revealLine: "When the last turn closes, no rival ledger can match your command of the world.",
    description:
      "Your superior strategy and leadership have led your people to complete victory.",
    accentColor: "#f2c688",
    accentSoft: "rgba(242, 198, 136, 0.22)",
    particleTone: "reward",
    pulseTone: "tech",
    glowClass: "from-orange-300/35 via-amber-300/10 to-transparent",
    badgeClass: "border-orange-300/30 bg-orange-400/10 text-orange-100",
    heroClass: "from-slate-950/95 via-orange-950/32 to-amber-950/80",
    edgeClass: "border-orange-300/25",
  },
};

export function getVictoryTheme(type: VictoryType): VictoryTheme {
  return VICTORY_THEMES[type];
}

export function getWinnerPlayer(gameState: GameState, winnerId: string): PlayerState | undefined {
  return gameState.players.find((player) => player.id === winnerId);
}

export function getWinnerCities(gameState: GameState, winnerId: string): City[] {
  return [...(gameState.cities ?? [])]
    .filter((city) => city.ownerId === winnerId)
    .sort((a, b) =>
      (b.population ?? 0) - (a.population ?? 0) ||
      (b.level ?? 0) - (a.level ?? 0) ||
      (b.starProduction ?? 0) - (a.starProduction ?? 0) ||
      a.name.localeCompare(b.name),
    );
}

export function getVictoryFocusCity(gameState: GameState, winnerId: string): City | null {
  return getWinnerCities(gameState, winnerId)[0] ?? null;
}

function getPlayerUnits(gameState: GameState, playerId: string) {
  return gameState.units.filter((unit) => unit.playerId === playerId);
}

function getPlayerPopulation(gameState: GameState, playerId: string): number {
  return (gameState.cities ?? [])
    .filter((city) => city.ownerId === playerId)
    .reduce((total, city) => total + (city.population ?? 0), 0);
}

function getCulturalSiteCount(gameState: GameState, playerId: string): number {
  const targetRules = GameRuleHelpers.getCulturalVictoryThresholds(gameState.players.length);
  const finishedStructures = (gameState.structures ?? []).filter(
    (structure: Structure) =>
      structure.ownerId === playerId &&
      structure.constructionTurns === 0 &&
      targetRules.structureTypes.includes(structure.type),
  ).length;
  const finishedImprovements = (gameState.improvements ?? []).filter(
    (improvement: Improvement) =>
      improvement.ownerId === playerId &&
      improvement.constructionTurns === 0 &&
      targetRules.improvementTypes.includes(improvement.type),
  ).length;
  return finishedStructures + finishedImprovements;
}

function getValidTradeRoutes(state: GameState, player: PlayerState) {
  return (player.tradeRoutes ?? []).filter((route) => {
    if (!player.citiesOwned.includes(route.fromCityId)) return false;
    if (!player.citiesOwned.includes(route.toCityId)) return false;
    return areCitiesConnectedByRoad(state, player.id, route.fromCityId, route.toCityId);
  });
}

function calculateRoadConnectedCityStarBonus(state: GameState, playerId: string): number {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return 0;

  const ownedCities = (state.cities ?? []).filter((city) => city.ownerId === playerId);
  if (ownedCities.length < 2) return 0;

  const roadKeys = new Set(
    (state.improvements ?? [])
      .filter((improvement) => improvement.ownerId === playerId)
      .filter((improvement) => improvement.type === "road")
      .filter((improvement) => improvement.constructionTurns === 0)
      .map((improvement) => `${improvement.coordinate.q},${improvement.coordinate.r}`),
  );

  if (roadKeys.size === 0) return 0;

  const cityKeys = new Set(ownedCities.map((city) => `${city.coordinate.q},${city.coordinate.r}`));
  const visited = new Set<string>();
  let bonus = 0;

  for (const city of ownedCities) {
    const startKey = `${city.coordinate.q},${city.coordinate.r}`;
    if (visited.has(startKey)) continue;

    const hasAdjacentRoad = hexNeighbors(city.coordinate).some((neighbor) => roadKeys.has(`${neighbor.q},${neighbor.r}`));
    if (!hasAdjacentRoad) {
      visited.add(startKey);
      continue;
    }

    const queue = [city.coordinate];
    const componentCities = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.q},${current.r}`;
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      const isCity = cityKeys.has(currentKey);
      const isRoad = roadKeys.has(currentKey);

      if (isCity) {
        componentCities.add(currentKey);
      }

      for (const neighbor of hexNeighbors(current)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        const canTraverse =
          (isCity && roadKeys.has(neighborKey)) ||
          (isRoad && (roadKeys.has(neighborKey) || cityKeys.has(neighborKey)));

        if (canTraverse && !visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }

    bonus += Math.max(0, componentCities.size - 1);
  }

  return bonus * (player.researchedTechs?.includes("trade") ? 2 : 1);
}

export function getPlayerStarIncome(gameState: GameState, player: PlayerState): number {
  const unitPassive = computeUnitPassiveEffectsForPlayer(gameState, player.id, player.stats);
  const validTradeRoutes = getValidTradeRoutes(gameState, player);
  const ownedCities = (gameState.cities ?? []).filter((city) => city.ownerId === player.id);
  const factionId = coerceFactionId(player.factionId);
  const cityIncome = ownedCities.length > 0
    ? ownedCities.reduce((total, city) => {
        const unrestPenalty = (city.unrestTurns ?? 0) > 0 ? GAME_RULES.morale.unrestIncomePenaltyPerCity : 0;
        return total + Math.max(0, (city.starProduction ?? 0) - unrestPenalty);
      }, 0)
    : GameRuleHelpers.calculateStarIncome(player.citiesOwned.length);

  const improvementIncome = (gameState.improvements ?? [])
    .filter((improvement) => improvement.ownerId === player.id && improvement.constructionTurns === 0)
    .reduce((total, improvement) => {
      let production = Math.max(0, improvement.starProduction ?? 0);
      if (
        improvement.type === "port" &&
        (factionId === "HAGOTHS_MARINERS" || player.researchedTechs?.includes("seafaring"))
      ) {
        production += 1;
      }
      return total + production;
    }, 0);

  const structureIncome = (gameState.structures ?? [])
    .filter((structure) => structure.ownerId === player.id && structure.constructionTurns === 0)
    .reduce((total, structure) => {
      const definition = STRUCTURE_DEFINITIONS[structure.type as keyof typeof STRUCTURE_DEFINITIONS];
      const starProduction = structure.effects.starProduction ?? definition?.effects?.starProduction ?? 0;
      return total + Math.max(0, starProduction);
    }, 0);

  const convertedVillageIncome = gameState.map.tiles
    .filter(
      (tile) =>
        tile.feature === "village" &&
        tile.cityOwner === player.id &&
        tile.captureType === "converted" &&
        tile.starBonus,
    )
    .reduce((total, tile) => total + Math.max(0, tile.starBonus ?? 0), 0);

  return (
    cityIncome +
    improvementIncome +
    structureIncome +
    convertedVillageIncome +
    calculateRoadConnectedCityStarBonus(gameState, player.id) +
    validTradeRoutes.reduce((total, route) => total + Math.max(0, route.starsPerTurn ?? 0), 0) +
    (unitPassive.perTurn.stars ?? 0)
  );
}

export function getRankedPlayers(gameState: GameState, winnerId: string): RankedPlayer[] {
  return [...gameState.players]
    .map((player) => {
      const unitsRemaining = getPlayerUnits(gameState, player.id).length;
      const population = getPlayerPopulation(gameState, player.id);
      const score =
        player.citiesOwned.length * 100 +
        player.stats.faith * 2 +
        player.researchedTechs.length * 30 +
        unitsRemaining * 18 +
        player.stars;

      return {
        player,
        unitsRemaining,
        population,
        score,
        isWinner: player.id === winnerId,
      };
    })
    .sort((a, b) => {
      if (a.isWinner) return -1;
      if (b.isWinner) return 1;
      return (
        b.player.citiesOwned.length - a.player.citiesOwned.length ||
        b.player.stats.faith - a.player.stats.faith ||
        b.player.researchedTechs.length - a.player.researchedTechs.length ||
        b.unitsRemaining - a.unitsRemaining ||
        b.player.stars - a.player.stars
      );
    });
}

export function getFinalStats(gameState: GameState, winnerId: string): FinalStat[] {
  const winner = getWinnerPlayer(gameState, winnerId);
  if (!winner) return [];

  return [
    { label: "Total Turns", value: String(gameState.turn), tone: "text-sky-300" },
    { label: "Cities Controlled", value: String(winner.citiesOwned.length), tone: "text-violet-300" },
    { label: "Units Remaining", value: String(getPlayerUnits(gameState, winnerId).length), tone: "text-emerald-300" },
    { label: "Technologies", value: String(winner.researchedTechs.length), tone: "text-amber-300" },
    { label: "Faith", value: String(winner.stats.faith), tone: "text-sky-200" },
    { label: "Pride", value: String(winner.stats.pride), tone: "text-fuchsia-300" },
    { label: "Stars", value: String(winner.stars), tone: "text-yellow-200" },
    { label: "Population", value: String(getPlayerPopulation(gameState, winnerId)), tone: "text-orange-200" },
  ];
}

export function getVictoryMetricCards(
  gameState: GameState,
  winnerId: string,
  victoryType: VictoryType,
): VictoryMetricCard[] {
  const winner = getWinnerPlayer(gameState, winnerId);
  if (!winner) return [];

  const totalCities = Math.max(1, gameState.players.reduce((sum, player) => sum + player.citiesOwned.length, 0));
  const totalTechs = Math.max(1, Object.keys(TECHNOLOGIES).length);
  const economicTargets = GameRuleHelpers.getEconomicVictoryThresholds(gameState.players.length);
  const culturalTargets = GameRuleHelpers.getCulturalVictoryThresholds(gameState.players.length);
  const income = getPlayerStarIncome(gameState, winner);
  const culturePopulation = getPlayerPopulation(gameState, winnerId);
  const culturalSites = getCulturalSiteCount(gameState, winnerId);
  const territoryTarget = Math.round(GAME_RULES.victory.territoryControlThreshold * 100);
  const territoryShare = Math.round((winner.citiesOwned.length / totalCities) * 100);
  const activeRivals = gameState.players.filter(
    (player) => player.id !== winnerId && player.citiesOwned.length > 0,
  ).length;
  const techPercent = Math.round((winner.researchedTechs.length / totalTechs) * 100);

  switch (victoryType) {
    case "faith":
      const faithProject = winner.faithProject;
      return [
        {
          key: "consecration",
          label: "Consecration",
          value: `${faithProject?.progress ?? GAME_RULES.victory.faithVictory.progressToWin}/${GAME_RULES.victory.faithVictory.progressToWin}`,
          detail: "The three-turn Faith Project was sustained through its final upkeep.",
          progress: clamp01((faithProject?.progress ?? GAME_RULES.victory.faithVictory.progressToWin) / GAME_RULES.victory.faithVictory.progressToWin),
        },
        {
          key: "holyCities",
          label: "Holy Cities",
          value: `${faithProject?.holyCityIds?.length ?? GAME_RULES.victory.faithVictory.holyCitiesRequired}/${GAME_RULES.victory.faithVictory.holyCitiesRequired}`,
          detail: "Three Temple cities anchored the project, with Cathedral support in the network.",
          progress: clamp01((faithProject?.holyCityIds?.length ?? GAME_RULES.victory.faithVictory.holyCitiesRequired) / GAME_RULES.victory.faithVictory.holyCitiesRequired),
        },
        {
          key: "dissent",
          label: "Final Dissent",
          value: `${winner.stats.internalDissent}/${GAME_RULES.victory.faithVictory.maxDissentToMaintain} max`,
          detail: "The project held because unrest stayed within the maintenance limit.",
          progress: winner.stats.internalDissent <= GAME_RULES.victory.faithVictory.maxDissentToMaintain
            ? 1
            : clamp01(GAME_RULES.victory.faithVictory.maxDissentToMaintain / Math.max(1, winner.stats.internalDissent)),
        },
      ];
    case "territorial":
      return [
        {
          key: "territory",
          label: "Territory Share",
          value: `${territoryShare}%/${territoryTarget}%`,
          detail: "The victory was secured by taking a commanding share of the board.",
          progress: clamp01(territoryShare / territoryTarget),
        },
        {
          key: "cities",
          label: "Cities Held",
          value: `${winner.citiesOwned.length}/${totalCities}`,
          detail: "Every captured city pushed the world closer to one banner.",
          progress: clamp01(winner.citiesOwned.length / totalCities),
        },
        {
          key: "rivals",
          label: "Rivals Standing",
          value: `${activeRivals}`,
          detail: "Opponents still lived on, but the frontier belonged to the winner.",
          progress: activeRivals === 0 ? 1 : clamp01(1 - activeRivals / Math.max(1, gameState.players.length - 1)),
        },
      ];
    case "elimination":
      return [
        {
          key: "rivals",
          label: "Rivals Remaining",
          value: `${activeRivals}`,
          detail: "The last opposing kingdom was erased from the map.",
          progress: activeRivals === 0 ? 1 : clamp01(1 - activeRivals / Math.max(1, gameState.players.length - 1)),
        },
        {
          key: "cities",
          label: "Cities Held",
          value: `${winner.citiesOwned.length}`,
          detail: "The final empire stood alone with its cities intact.",
          progress: clamp01(winner.citiesOwned.length / Math.max(2, totalCities)),
        },
        {
          key: "forces",
          label: "Forces Remaining",
          value: `${getPlayerUnits(gameState, winnerId).length}`,
          detail: "Surviving armies remained to enforce the end of the war.",
          progress: clamp01(getPlayerUnits(gameState, winnerId).length / Math.max(3, gameState.units.length || 1)),
        },
      ];
    case "economic":
      return [
        {
          key: "income",
          label: "Income",
          value: `+${income}/${economicTargets.income}`,
          detail: "Trade, production, and routes all hit the required pace.",
          progress: clamp01(income / economicTargets.income),
        },
        {
          key: "treasury",
          label: "Treasury",
          value: `${winner.stars}/${economicTargets.treasury}`,
          detail: "The treasury threshold locked in the supremacy claim.",
          progress: clamp01(winner.stars / economicTargets.treasury),
        },
        {
          key: "research",
          label: "Research",
          value: `${techPercent}%/${Math.round(economicTargets.techPercent * 100)}%`,
          detail: "Economic victory required a modernized civilization, not just a full vault.",
          progress: clamp01(techPercent / Math.round(economicTargets.techPercent * 100)),
        },
      ];
    case "cultural":
      return [
        {
          key: "population",
          label: "Population",
          value: `${culturePopulation}/${culturalTargets.population}`,
          detail: "The people reached the population needed to become the cultural center of the world.",
          progress: clamp01(culturePopulation / culturalTargets.population),
        },
        {
          key: "sites",
          label: "Sacred And Civic Sites",
          value: `${culturalSites}/${culturalTargets.structures}`,
          detail: "Temples, cathedrals, libraries, academies, and shrines sealed the legacy.",
          progress: clamp01(culturalSites / culturalTargets.structures),
        },
        {
          key: "dissent",
          label: "Dissent",
          value: `${winner.stats.internalDissent}/${culturalTargets.dissentMax} max`,
          detail: "Cultural ascendancy held because the realm stayed cohesive at the finish.",
          progress: winner.stats.internalDissent <= culturalTargets.dissentMax
            ? 1
            : clamp01(culturalTargets.dissentMax / Math.max(1, winner.stats.internalDissent)),
        },
      ];
    case "domination":
      return [
        {
          key: "turn",
          label: "Final Turn",
          value: `${gameState.turn}/${GAME_RULES.turns.maxTurnsPerGame}`,
          detail: "The match hit the final reckoning and the winner led on the board state.",
          progress: clamp01(gameState.turn / GAME_RULES.turns.maxTurnsPerGame),
        },
        {
          key: "cities",
          label: "Cities Controlled",
          value: `${winner.citiesOwned.length}`,
          detail: "City control carried the winner through the final tiebreakers.",
          progress: clamp01(winner.citiesOwned.length / Math.max(2, totalCities)),
        },
        {
          key: "research",
          label: "Research Breadth",
          value: `${winner.researchedTechs.length}/${totalTechs}`,
          detail: "Strategic supremacy came from having the broadest command when time ran out.",
          progress: clamp01(winner.researchedTechs.length / totalTechs),
        },
      ];
  }
}

export function getVictoryDecisiveMoment(
  gameState: GameState,
  winnerId: string,
  victoryType: VictoryType,
  entries: VictoryLogEntry[] = [],
): string {
  const winner = getWinnerPlayer(gameState, winnerId);
  if (!winner) return `Final victory secured on Turn ${gameState.turn}.`;

  const focusCity = getVictoryFocusCity(gameState, winnerId);
  const latestWinnerEntry = [...entries].reverse().find((entry) => entry.playerId === winnerId);
  if (latestWinnerEntry) {
    return `Turn ${latestWinnerEntry.turn}: ${latestWinnerEntry.message}.`;
  }

  switch (victoryType) {
    case "faith":
      return `Turn ${gameState.turn}: ${winner.name} completed the Consecration project through three holy cities.`;
    case "territorial":
      return `Turn ${gameState.turn}: ${focusCity?.name ?? "The frontier capital"} anchored control of ${winner.citiesOwned.length} cities.`;
    case "elimination":
      return `Turn ${gameState.turn}: the final rival kingdom vanished from the map.`;
    case "economic":
      return `Turn ${gameState.turn}: the treasury reached ${winner.stars} Stars and never looked back.`;
    case "cultural":
      return `Turn ${gameState.turn}: ${focusCity?.name ?? "The great capital"} became the center of a lasting cultural order.`;
    case "domination":
      return `Turn ${gameState.turn}: the final reckoning favored ${winner.name}'s empire.`;
  }
}

export function getCampaignChronicle(
  gameState: GameState,
  winnerId: string,
  victoryType: VictoryType,
  entries: VictoryLogEntry[] = [],
): VictoryLogEntry[] {
  const theme = getVictoryTheme(victoryType);
  const finalEntry: VictoryLogEntry = {
    id: `victory-final-${winnerId}-${gameState.turn}`,
    turn: gameState.turn,
    playerId: winnerId,
    playerName: getWinnerPlayer(gameState, winnerId)?.name ?? "Winner",
    type: "victory",
    message: `${theme.title} declared`,
    timestamp: Date.now(),
  };

  const recentEntries = [...entries]
    .sort((a, b) => a.turn - b.turn || a.timestamp - b.timestamp)
    .slice(-6);

  return [...recentEntries, finalEntry];
}

export function getPowerProfile(gameState: GameState, winnerId: string): PowerPoint[] {
  const ranked = getRankedPlayers(gameState, winnerId);
  const winner = ranked[0];
  const runnerUp = ranked[1];
  if (!winner) return [];

  const winnerPlayer = winner.player;
  const runnerUpPlayer = runnerUp?.player;

  const metrics = [
    {
      label: "Cities",
      winnerValue: winnerPlayer.citiesOwned.length,
      runnerUpValue: runnerUpPlayer?.citiesOwned.length ?? 0,
    },
    {
      label: "Faith",
      winnerValue: winnerPlayer.stats.faith,
      runnerUpValue: runnerUpPlayer?.stats.faith ?? 0,
    },
    {
      label: "Stars",
      winnerValue: winnerPlayer.stars,
      runnerUpValue: runnerUpPlayer?.stars ?? 0,
    },
    {
      label: "Techs",
      winnerValue: winnerPlayer.researchedTechs.length,
      runnerUpValue: runnerUpPlayer?.researchedTechs.length ?? 0,
    },
  ];

  return metrics.map((metric) => ({
    ...metric,
    scaleMax: Math.max(1, metric.winnerValue, metric.runnerUpValue),
  }));
}
