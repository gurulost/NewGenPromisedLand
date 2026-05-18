import type { Page } from "playwright";

import { createInitialGameState } from "../shared/logic/initialGameState";
import { findNextTurnPlayerIndex } from "../shared/logic/turnOrder";

type Severity = "low" | "medium" | "high" | "blocker";

export type LiveMultiplayerSoakAgent = {
  name: string;
  userId?: number;
  playerId?: string;
  faction: string;
  page: Page;
  networkSuppressionReason?: string | null;
};

type ApiResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

type SoakScenarioDeps<Agent extends LiveMultiplayerSoakAgent> = {
  scenarioMode: "smoke" | "soak";
  agents: Agent[];
  versionHeaders: Record<string, string>;
  scenarioResults: Array<Record<string, unknown>>;
  logEvent: (type: string, detail?: Record<string, unknown>) => void;
  addIssue: (severity: Severity, title: string, detail?: Record<string, unknown>) => void;
  getRecord: (value: unknown) => Record<string, unknown>;
  isAgentConnected: (agent: Agent) => boolean;
  api: (
    agent: Agent,
    method: string,
    requestPath: string,
    data?: unknown,
    headers?: Record<string, string>,
  ) => Promise<ApiResult>;
  waitFor: <T>(
    label: string,
    fn: () => Promise<T | false | null | undefined>,
    timeoutMs?: number,
    intervalMs?: number,
  ) => Promise<T>;
  getProjectedState: (agent: Agent, code: string) => Promise<ApiResult>;
  joinStartedLobbyByCode: (agent: Agent, code: string, label: string) => Promise<void>;
  closeAgentContext: (agent: Agent, reason: string) => Promise<void>;
  reconnectAgentToGame: (agent: Agent, code: string, label: string) => Promise<void>;
  waitForActiveTurn: (agent: Agent) => Promise<void>;
  getCurrentHostUserId: () => number | null;
  setCurrentHostUserId: (userId: number | null) => void;
};

export function createLiveMultiplayerSoakScenarios<Agent extends LiveMultiplayerSoakAgent>(deps: SoakScenarioDeps<Agent>) {
  const progress = {
    reloadReconnect: false,
    midTurnDisconnect: false,
    hostLeaveClaim: false,
    eliminatedHandoff: false,
  };

  const findConnectedAgentByUserId = (userId: number | null | undefined) => {
    if (userId == null) return null;
    return deps.agents.find((agent) => agent.userId === userId && deps.isAgentConnected(agent)) ?? null;
  };

  return {
    async performReloadReconnect(code: string, actor: Agent, turnIndex: number) {
      if (progress.reloadReconnect || deps.scenarioMode !== "soak") return;
      if (turnIndex !== 2) return;
      const target = [...deps.agents].reverse().find((candidate) => candidate !== actor && deps.isAgentConnected(candidate));
      if (!target) {
        deps.addIssue("high", "Soak reload/reconnect had no connected non-active target", { turnIndex, actor: actor.name });
        return;
      }

      progress.reloadReconnect = true;
      deps.logEvent("soak_reload_reconnect_started", { agent: target.name, turnIndex, actor: actor.name });
      target.networkSuppressionReason = "soak_reload_navigation";
      try {
        await target.page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch((error) => {
          deps.addIssue("medium", "Soak reload failed before reconnect", {
            agent: target.name,
            turnIndex,
            error: String(error),
          });
        });
        await deps.joinStartedLobbyByCode(target, code, `soak-reload-turn-${turnIndex}`);
        const result = await deps.getProjectedState(target, code);
        const body = deps.getRecord(result.body);
        deps.scenarioResults.push({
          type: "browser_reload_reconnect",
          agent: target.name,
          turnIndex,
          status: result.status,
          actionVersion: body.actionVersion,
          snapshotVersion: body.snapshotVersion,
        });
        deps.logEvent("soak_reload_reconnect_verified", {
          agent: target.name,
          turnIndex,
          actionVersion: body.actionVersion,
          snapshotVersion: body.snapshotVersion,
        });
      } finally {
        target.networkSuppressionReason = null;
      }
    },

    async performMidTurnDisconnect(code: string, actor: Agent, turnIndex: number) {
      if (progress.midTurnDisconnect || deps.scenarioMode !== "soak") return;
      if (turnIndex !== 3) return;

      progress.midTurnDisconnect = true;
      deps.logEvent("soak_mid_turn_disconnect_started", { agent: actor.name, turnIndex });
      await deps.closeAgentContext(actor, "soak_mid_turn_disconnect");
      await deps.reconnectAgentToGame(actor, code, `soak-mid-turn-${turnIndex}`);
      await deps.waitForActiveTurn(actor);
      deps.logEvent("soak_mid_turn_disconnect_recovered", { agent: actor.name, turnIndex });
    },

    async performHostLeaveAndClaim(code: string, completedTurnIndex: number) {
      if (progress.hostLeaveClaim || deps.scenarioMode !== "soak") return;
      if (completedTurnIndex !== 1) return;

      const oldHost = findConnectedAgentByUserId(deps.getCurrentHostUserId()) ?? deps.agents[0];
      const fallbackClaimant = deps.agents.find(
        (candidate) => candidate.userId !== oldHost?.userId && deps.isAgentConnected(candidate),
      );
      if (!oldHost || !fallbackClaimant) {
        deps.addIssue("high", "Soak host-leave scenario had no connected claimant", {
          completedTurnIndex,
          oldHost: oldHost?.name ?? null,
        });
        return;
      }

      progress.hostLeaveClaim = true;
      deps.logEvent("soak_host_leave_started", {
        agent: oldHost.name,
        userId: oldHost.userId,
        completedTurnIndex,
      });
      await deps.closeAgentContext(oldHost, "soak_host_left");

      const expiredStatus = await deps.waitFor("host lease expiry after soak host leave", async () => {
        const result = await deps.api(fallbackClaimant, "GET", `/api/lobbies/${code}/host`, undefined, deps.versionHeaders);
        if (!result.ok) return false;
        const body = deps.getRecord(result.body);
        return body.leaseExpired === true ? body : false;
      }, 45_000, 1000);

      const suggestedHostUserId = Number(expiredStatus.suggestedHostUserId ?? fallbackClaimant.userId);
      const claimant = findConnectedAgentByUserId(suggestedHostUserId) ?? fallbackClaimant;
      const claimResult = await deps.api(claimant, "POST", `/api/lobbies/${code}/host/claim`, {
        hostEpoch: Number(expiredStatus.hostEpoch ?? 0),
      });
      const claimBody = deps.getRecord(claimResult.body);
      if (!claimResult.ok) {
        deps.addIssue("high", "Soak host claim failed after original host left", {
          oldHost: oldHost.name,
          claimant: claimant.name,
          status: claimResult.status,
          body: claimResult.body,
          expiredStatus,
        });
        return;
      }

      deps.setCurrentHostUserId(Number(claimBody.hostUserId ?? claimant.userId ?? deps.getCurrentHostUserId()));
      deps.scenarioResults.push({
        type: "host_leave_claim",
        oldHost: oldHost.name,
        claimant: claimant.name,
        completedTurnIndex,
        status: claimResult.status,
        hostUserId: deps.getCurrentHostUserId(),
        hostEpoch: claimBody.hostEpoch,
      });
      deps.logEvent("soak_host_claim_verified", {
        oldHost: oldHost.name,
        claimant: claimant.name,
        hostUserId: deps.getCurrentHostUserId(),
        hostEpoch: claimBody.hostEpoch,
      });
    },

    verifyEliminatedPlayerHandoffCanary() {
      if (progress.eliminatedHandoff || deps.scenarioMode !== "soak") return;
      if (deps.agents.length < 4 || deps.agents.some((agent) => !agent.playerId)) {
        deps.addIssue("high", "Soak eliminated-player handoff canary needs four assigned players", {
          agents: deps.agents.map((agent) => ({ name: agent.name, playerId: agent.playerId })),
        });
        return;
      }

      const { gameState } = createInitialGameState({
        playerSetup: deps.agents.slice(0, 4).map((agent, index) => ({
          id: agent.playerId!,
          name: agent.name,
          factionId: agent.faction,
          turnOrder: index,
          isAI: false,
        })),
        mapSize: "tiny",
        seed: 20260518,
        gameId: "soak-eliminated-handoff",
      });
      const players = gameState.players.map((player, index) => ({
        ...player,
        citiesOwned: [`city-${index + 1}`],
        isEliminated: false,
      }));
      const eliminatedPlayer = players[2];
      if (!eliminatedPlayer) {
        deps.addIssue("high", "Soak eliminated-player handoff canary missing eliminated player slot", { players });
        return;
      }
      players[2] = { ...eliminatedPlayer, isEliminated: true, citiesOwned: [] };

      const nextIndex = findNextTurnPlayerIndex(players, 1);
      if (nextIndex !== 3) {
        deps.addIssue("high", "Eliminated-player handoff canary did not skip eliminated player", {
          nextIndex,
          expectedIndex: 3,
          players,
        });
        return;
      }

      progress.eliminatedHandoff = true;
      const fromPlayer = players[1];
      const nextPlayer = players[3];
      if (!fromPlayer || !nextPlayer) {
        deps.addIssue("high", "Soak eliminated-player handoff canary missing expected live players", { players });
        return;
      }
      const result = {
        type: "eliminated_player_handoff_canary",
        fromPlayerId: fromPlayer.id,
        skippedPlayerId: eliminatedPlayer.id,
        nextPlayerId: nextPlayer.id,
      };
      deps.scenarioResults.push(result);
      deps.logEvent("soak_eliminated_player_handoff_verified", result);
    },
  };
}
