export type MultiplayerPlayerMeta = {
  playerId?: string;
  userId?: number | null;
  seatIndex?: number;
  factionId?: string | null;
  isAI?: boolean;
  turnOrder?: number;
  lastSeenAt?: number;
};

export function getPlayersInTurnOrder(lobbyState: any): MultiplayerPlayerMeta[] {
  const playersMeta = (Array.isArray(lobbyState?.players) ? lobbyState.players : []) as MultiplayerPlayerMeta[];
  return [...playersMeta].sort((a, b) => (a.turnOrder ?? 0) - (b.turnOrder ?? 0));
}

export function getExpectedActorId(lobbyState: any): string | null {
  const expected = lobbyState?.expectedActorId;
  if (typeof expected === "string" && expected.length > 0) {
    return expected;
  }
  const ordered = getPlayersInTurnOrder(lobbyState);
  const first = ordered.find((entry) => typeof entry.playerId === "string" && entry.playerId.length > 0);
  return first?.playerId ?? null;
}

export function getExpectedActorIdFromSnapshot(snapshot: any): string | null {
  if (!snapshot || !Array.isArray(snapshot.players)) return null;
  const currentIndex = Number(snapshot.currentPlayerIndex ?? 0);
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= snapshot.players.length) {
    return null;
  }
  const player = snapshot.players[currentIndex];
  if (!player || typeof player.id !== "string" || !player.id) return null;
  return player.id;
}

export function getNextExpectedActorId(lobbyState: any, actorId: string): string | null {
  const ordered = getPlayersInTurnOrder(lobbyState)
    .filter((entry): entry is MultiplayerPlayerMeta & { playerId: string } => typeof entry.playerId === "string" && entry.playerId.length > 0);
  if (ordered.length === 0) return null;
  const currentIndex = ordered.findIndex((entry) => entry.playerId === actorId);
  if (currentIndex === -1) {
    return ordered[0].playerId;
  }
  return ordered[(currentIndex + 1) % ordered.length].playerId;
}

export function needsSnapshotCatchup(since: number, actionLogBaseVersion: number): boolean {
  return Number.isFinite(since) && since < actionLogBaseVersion;
}
