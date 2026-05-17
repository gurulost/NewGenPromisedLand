export const MULTIPLAYER_AUTHORITY_MODES = {
  privateDemoHosted: "private_demo_hosted",
  publicAuthoritative: "public_authoritative",
} as const;

export type MultiplayerAuthorityMode =
  (typeof MULTIPLAYER_AUTHORITY_MODES)[keyof typeof MULTIPLAYER_AUTHORITY_MODES];

export const DEFAULT_MULTIPLAYER_AUTHORITY_MODE: MultiplayerAuthorityMode =
  MULTIPLAYER_AUTHORITY_MODES.privateDemoHosted;

export function normalizeMultiplayerAuthorityMode(value: unknown): MultiplayerAuthorityMode {
  return value === MULTIPLAYER_AUTHORITY_MODES.publicAuthoritative
    ? MULTIPLAYER_AUTHORITY_MODES.publicAuthoritative
    : DEFAULT_MULTIPLAYER_AUTHORITY_MODE;
}

export function isPublicAuthoritativeMultiplayer(value: unknown): boolean {
  return normalizeMultiplayerAuthorityMode(value) === MULTIPLAYER_AUTHORITY_MODES.publicAuthoritative;
}
