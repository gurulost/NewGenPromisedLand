export const COVENANT_MULTIPLAYER_PROTOCOL_VERSION = 2;
export const COVENANT_MULTIPLAYER_RULES_VERSION = "2026-05-17-private-demo";
export const COVENANT_MULTIPLAYER_MODE = "private-demo-host-mediated";

export const MULTIPLAYER_PROTOCOL_HEADER = "x-covenant-multiplayer-protocol";
export const MULTIPLAYER_RULES_HEADER = "x-covenant-rules-version";
export const MULTIPLAYER_BUILD_HEADER = "x-covenant-build-id";

export const MULTIPLAYER_PROTOCOL_QUERY = "mpProtocol";
export const MULTIPLAYER_RULES_QUERY = "mpRules";
export const MULTIPLAYER_BUILD_QUERY = "mpBuild";

export type MultiplayerVersionSnapshot = {
  multiplayerProtocolVersion: number;
  multiplayerRulesVersion: string;
  multiplayerMode: typeof COVENANT_MULTIPLAYER_MODE;
  multiplayerBuildId?: string;
};

export function buildMultiplayerVersionSnapshot(buildId?: string): MultiplayerVersionSnapshot {
  return {
    multiplayerProtocolVersion: COVENANT_MULTIPLAYER_PROTOCOL_VERSION,
    multiplayerRulesVersion: COVENANT_MULTIPLAYER_RULES_VERSION,
    multiplayerMode: COVENANT_MULTIPLAYER_MODE,
    ...(buildId ? { multiplayerBuildId: buildId } : {}),
  };
}

export function buildMultiplayerVersionHeaders(buildId?: string): Record<string, string> {
  return {
    [MULTIPLAYER_PROTOCOL_HEADER]: String(COVENANT_MULTIPLAYER_PROTOCOL_VERSION),
    [MULTIPLAYER_RULES_HEADER]: COVENANT_MULTIPLAYER_RULES_VERSION,
    ...(buildId ? { [MULTIPLAYER_BUILD_HEADER]: buildId } : {}),
  };
}

export function buildMultiplayerVersionQuery(buildId?: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set(MULTIPLAYER_PROTOCOL_QUERY, String(COVENANT_MULTIPLAYER_PROTOCOL_VERSION));
  params.set(MULTIPLAYER_RULES_QUERY, COVENANT_MULTIPLAYER_RULES_VERSION);
  if (buildId) {
    params.set(MULTIPLAYER_BUILD_QUERY, buildId);
  }
  return params;
}

export function isStoredMultiplayerVersionCompatible(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.multiplayerProtocolVersion === COVENANT_MULTIPLAYER_PROTOCOL_VERSION &&
    record.multiplayerRulesVersion === COVENANT_MULTIPLAYER_RULES_VERSION
  );
}
