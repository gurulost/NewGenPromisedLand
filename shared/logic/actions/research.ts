import { GameState } from "../../types/game";
import { TECHNOLOGIES, calculateResearchCost } from "../../data/technologies";

export function handleResearchTech(
  state: GameState,
  payload: { playerId: string; techId: string }
): GameState {
  const { playerId, techId } = payload;

  const tech = TECHNOLOGIES[techId];
  if (!tech) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const cost = calculateResearchCost(tech, player.researchedTechs.length);

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

export function handleResearchTechnology(
  state: GameState,
  payload: { playerId: string; technologyId: string }
): GameState {
  return handleResearchTech(state, {
    playerId: payload.playerId,
    techId: payload.technologyId
  });
}
