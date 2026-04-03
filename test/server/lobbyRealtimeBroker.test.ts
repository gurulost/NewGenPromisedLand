import { EventEmitter } from "events";

import { describe, expect, it, vi } from "vitest";

import { openLobbyRealtimeStream, publishLobbyRealtimeEvent } from "../../server/lobbyRealtimeBroker";

class FakeResponse extends EventEmitter {
  writableEnded = false;
  writes: string[] = [];

  status = vi.fn((_code: number) => this);
  setHeader = vi.fn((_name: string, _value: string) => this);
  flushHeaders = vi.fn();
  write = vi.fn((chunk: string) => {
    this.writes.push(chunk);
    return true;
  });
}

describe("lobbyRealtimeBroker", () => {
  it("streams ready, keepalive, and published events to active subscribers", () => {
    const response = new FakeResponse();

    openLobbyRealtimeStream("ROOMA", response as any);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.writes[0]).toContain("retry: 2000");
    expect(response.writes[1]).toContain("\"type\":\"ready\"");

    publishLobbyRealtimeEvent("ROOMA", {
      type: "multiplayer-sync",
      lobbyCode: "ROOMA",
      reason: "action-committed",
    });

    expect(response.writes.some((chunk) => chunk.includes("\"reason\":\"action-committed\""))).toBe(true);
  });

  it("stops delivering events after the stream closes", () => {
    const response = new FakeResponse();

    openLobbyRealtimeStream("ROOMB", response as any);
    const writesBeforeClose = response.writes.length;

    response.emit("close");
    publishLobbyRealtimeEvent("ROOMB", {
      type: "multiplayer-sync",
      lobbyCode: "ROOMB",
      reason: "queue-updated",
    });

    expect(response.writes).toHaveLength(writesBeforeClose);
  });
});
