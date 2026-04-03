import type { PlayerState } from "../types/game";

export function isTurnEligiblePlayer(player: PlayerState | null | undefined): boolean {
  if (!player) return false;
  if (player.isEliminated) return false;
  // Treat live city ownership as the source of truth for turn eligibility.
  // This keeps turn order stable if an older save or intermediate state has a stale isEliminated flag.
  return player.citiesOwned.length > 0;
}

export function normalizeTurnPlayerIndex(players: PlayerState[], currentPlayerIndex: number): number {
  if (players.length === 0) return -1;

  for (let offset = 0; offset < players.length; offset += 1) {
    const candidateIndex = ((currentPlayerIndex + offset) % players.length + players.length) % players.length;
    if (isTurnEligiblePlayer(players[candidateIndex])) {
      return candidateIndex;
    }
  }

  return players[0] ? 0 : -1;
}

export function findNextTurnPlayerIndex(players: PlayerState[], currentPlayerIndex: number): number {
  if (players.length === 0) return -1;

  const normalizedCurrentIndex = normalizeTurnPlayerIndex(players, currentPlayerIndex);
  if (normalizedCurrentIndex < 0) return -1;

  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidateIndex = (normalizedCurrentIndex + offset) % players.length;
    if (isTurnEligiblePlayer(players[candidateIndex])) {
      return candidateIndex;
    }
  }

  return normalizedCurrentIndex;
}

export function getTurnPlayer(
  players: PlayerState[],
  currentPlayerIndex: number,
): PlayerState | null {
  const normalizedIndex = normalizeTurnPlayerIndex(players, currentPlayerIndex);
  if (normalizedIndex < 0) return null;
  return players[normalizedIndex] ?? null;
}
