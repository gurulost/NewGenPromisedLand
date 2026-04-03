import type { ChatTransportEvent } from "./chatEvents";

export type MultiplayerSyncReason =
  | "host-claimed"
  | "queue-updated"
  | "action-committed";

export type LobbyRealtimeEvent =
  | {
      type: "ready";
      lobbyCode: string;
      sentAt: number;
    }
  | {
      type: "chat-event";
      lobbyCode: string;
      event: ChatTransportEvent;
    }
  | {
      type: "multiplayer-sync";
      lobbyCode: string;
      reason: MultiplayerSyncReason;
    };
