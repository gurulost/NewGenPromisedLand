import type { Request, Response } from "express";
import {
  COVENANT_MULTIPLAYER_PROTOCOL_VERSION,
  COVENANT_MULTIPLAYER_RULES_VERSION,
  MULTIPLAYER_BUILD_HEADER,
  MULTIPLAYER_BUILD_QUERY,
  MULTIPLAYER_PROTOCOL_HEADER,
  MULTIPLAYER_PROTOCOL_QUERY,
  MULTIPLAYER_RULES_HEADER,
  MULTIPLAYER_RULES_QUERY,
  isStoredMultiplayerVersionCompatible,
} from "@shared/multiplayerVersion";

export const SERVER_MULTIPLAYER_BUILD_ID =
  process.env.MULTIPLAYER_BUILD_ID || undefined;

const REQUIRE_BUILD_ID = process.env.MULTIPLAYER_REQUIRE_BUILD_ID === "true";

type VersionGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string; expected?: Record<string, unknown> };

function getRequestVersionValue(req: Request, headerName: string, queryName: string): string | undefined {
  const headerValue = req.get(headerName);
  if (headerValue) return headerValue;
  const queryValue = req.query[queryName];
  if (typeof queryValue === "string" && queryValue) return queryValue;
  if (Array.isArray(queryValue) && typeof queryValue[0] === "string" && queryValue[0]) return queryValue[0];
  return undefined;
}

export function getServerMultiplayerBuildId(): string | undefined {
  return SERVER_MULTIPLAYER_BUILD_ID;
}

export function validateMultiplayerVersionRequest(req: Request, lobbyState?: unknown): VersionGateResult {
  if (lobbyState !== undefined && !isStoredMultiplayerVersionCompatible(lobbyState)) {
    return {
      ok: false,
      status: 409,
      error: "This lobby was started with an incompatible multiplayer rules version. Create a new lobby.",
      expected: {
        protocolVersion: COVENANT_MULTIPLAYER_PROTOCOL_VERSION,
        rulesVersion: COVENANT_MULTIPLAYER_RULES_VERSION,
      },
    };
  }

  const protocolVersion = Number(getRequestVersionValue(req, MULTIPLAYER_PROTOCOL_HEADER, MULTIPLAYER_PROTOCOL_QUERY));
  if (protocolVersion !== COVENANT_MULTIPLAYER_PROTOCOL_VERSION) {
    return {
      ok: false,
      status: 409,
      error: "Client multiplayer protocol is out of date. Refresh the game and try again.",
      expected: { protocolVersion: COVENANT_MULTIPLAYER_PROTOCOL_VERSION },
    };
  }

  const rulesVersion = getRequestVersionValue(req, MULTIPLAYER_RULES_HEADER, MULTIPLAYER_RULES_QUERY);
  if (rulesVersion !== COVENANT_MULTIPLAYER_RULES_VERSION) {
    return {
      ok: false,
      status: 409,
      error: "Client game rules are out of date. Refresh the game and try again.",
      expected: { rulesVersion: COVENANT_MULTIPLAYER_RULES_VERSION },
    };
  }

  const clientBuildId = getRequestVersionValue(req, MULTIPLAYER_BUILD_HEADER, MULTIPLAYER_BUILD_QUERY);
  if (REQUIRE_BUILD_ID && !SERVER_MULTIPLAYER_BUILD_ID) {
    return {
      ok: false,
      status: 503,
      error: "Server multiplayer build id is not configured.",
    };
  }
  if (SERVER_MULTIPLAYER_BUILD_ID && clientBuildId && clientBuildId !== SERVER_MULTIPLAYER_BUILD_ID) {
    return {
      ok: false,
      status: 409,
      error: "Client build does not match the server build. Refresh the game and try again.",
      expected: { buildId: SERVER_MULTIPLAYER_BUILD_ID },
    };
  }
  if (REQUIRE_BUILD_ID && SERVER_MULTIPLAYER_BUILD_ID && clientBuildId !== SERVER_MULTIPLAYER_BUILD_ID) {
    return {
      ok: false,
      status: 409,
      error: "Client build is missing or out of date. Refresh the game and try again.",
      expected: { buildId: SERVER_MULTIPLAYER_BUILD_ID },
    };
  }

  return { ok: true };
}

export function sendMultiplayerVersionGateError(res: Response, result: Exclude<VersionGateResult, { ok: true }>) {
  return res.status(result.status).json({
    error: result.error,
    expected: result.expected,
  });
}
