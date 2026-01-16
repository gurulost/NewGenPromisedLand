import type { HexCoordinate } from "@shared/types/coordinates";

interface PathfindingRequest {
  id: string;
  type: "findPath" | "getReachable";
  data: {
    start: HexCoordinate;
    goal?: HexCoordinate;
    passableTiles: string[];
    tileCosts: Record<string, number>;
    maxCost: number;
  };
}

interface PathfindingResponse {
  id: string;
  result: HexCoordinate[];
  error?: string;
}

type PendingRequest = {
  resolve: (result: HexCoordinate[]) => void;
  reject: (error: string) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();

const ensureWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/pathfinding.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<PathfindingResponse>) => {
    const { id, result, error } = e.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    if (error) {
      entry.reject(error);
      return;
    }
    entry.resolve(result);
  };
  worker.onerror = (error) => {
    console.error("Pathfinding worker error:", error);
    pending.forEach((entry) => {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      entry.reject("Pathfinding worker error");
    });
    pending.clear();
  };
  worker.onmessageerror = () => {
    pending.forEach((entry) => {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      entry.reject("Pathfinding worker message error");
    });
    pending.clear();
  };
  return worker;
};

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const findPathAsync = (params: {
  start: HexCoordinate;
  goal: HexCoordinate;
  passableTiles: string[];
  tileCosts: Record<string, number>;
  maxCost: number;
  timeoutMs?: number;
}): Promise<HexCoordinate[]> => {
  const { start, goal, passableTiles, tileCosts, maxCost, timeoutMs = 2000 } = params;
  if (!passableTiles.length) {
    return Promise.resolve([]);
  }
  const id = makeId("path");
  const request: PathfindingRequest = {
    id,
    type: "findPath",
    data: { start, goal, passableTiles, tileCosts, maxCost },
  };
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject("Pathfinding request timed out");
    }, Math.max(timeoutMs, 0));
    pending.set(id, { resolve, reject, timeoutId });
    ensureWorker().postMessage(request);
  });
};

export const getReachableTilesAsync = (params: {
  start: HexCoordinate;
  passableTiles: string[];
  tileCosts: Record<string, number>;
  maxCost: number;
  timeoutMs?: number;
}): Promise<HexCoordinate[]> => {
  const { start, passableTiles, tileCosts, maxCost, timeoutMs = 2000 } = params;
  if (!passableTiles.length) {
    return Promise.resolve([]);
  }
  const id = makeId("reachable");
  const request: PathfindingRequest = {
    id,
    type: "getReachable",
    data: { start, passableTiles, tileCosts, maxCost },
  };
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject("Reachable tiles request timed out");
    }, Math.max(timeoutMs, 0));
    pending.set(id, { resolve, reject, timeoutId });
    ensureWorker().postMessage(request);
  });
};

export const terminatePathfindingWorker = () => {
  if (!worker) return;
  worker.terminate();
  worker = null;
  pending.forEach((entry) => {
    if (entry.timeoutId) clearTimeout(entry.timeoutId);
  });
  pending.clear();
};
