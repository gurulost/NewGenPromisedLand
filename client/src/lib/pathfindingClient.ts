import type { HexCoordinate } from "@shared/types/coordinates";
import { findPath, getReachableTiles } from "@shared/logic/pathfinding";

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
  fallback: () => HexCoordinate[];
  timeoutId?: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();

const createPathfindingContext = (
  passableTiles: string[],
  tileCosts: Record<string, number>
) => {
  const passableSet = new Set(passableTiles);
  const isPassable = (coord: HexCoordinate): boolean => {
    const key = `${coord.q},${coord.r}`;
    return passableSet.has(key);
  };
  const getMoveCost = (coord: HexCoordinate): number => {
    const key = `${coord.q},${coord.r}`;
    const cost = tileCosts[key];
    return typeof cost === "number" ? cost : 1;
  };
  return { isPassable, getMoveCost };
};

const runFindPathFallback = (params: {
  start: HexCoordinate;
  goal: HexCoordinate;
  passableTiles: string[];
  tileCosts: Record<string, number>;
  maxCost: number;
}) => {
  const { start, goal, passableTiles, tileCosts, maxCost } = params;
  const { isPassable, getMoveCost } = createPathfindingContext(passableTiles, tileCosts);
  return findPath(start, goal, isPassable, maxCost, getMoveCost);
};

const runReachableFallback = (params: {
  start: HexCoordinate;
  passableTiles: string[];
  tileCosts: Record<string, number>;
  maxCost: number;
}) => {
  const { start, passableTiles, tileCosts, maxCost } = params;
  const { isPassable, getMoveCost } = createPathfindingContext(passableTiles, tileCosts);
  return getReachableTiles(start, maxCost, isPassable, getMoveCost);
};

const ensureWorker = () => {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;

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
      try {
        entry.resolve(entry.fallback());
      } catch {
        entry.reject(error);
      }
      return;
    }

    entry.resolve(result);
  };

  worker.onerror = (error) => {
    console.error("Pathfinding worker error:", error);
    pending.forEach((entry) => {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      try {
        entry.resolve(entry.fallback());
      } catch {
        entry.reject("Pathfinding worker error");
      }
    });
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  worker.onmessageerror = () => {
    pending.forEach((entry) => {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      try {
        entry.resolve(entry.fallback());
      } catch {
        entry.reject("Pathfinding worker message error");
      }
    });
    pending.clear();
    worker?.terminate();
    worker = null;
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

  if (typeof Worker === "undefined") {
    return Promise.resolve(runFindPathFallback({ start, goal, passableTiles, tileCosts, maxCost }));
  }

  const id = makeId("path");
  const request: PathfindingRequest = {
    id,
    type: "findPath",
    data: { start, goal, passableTiles, tileCosts, maxCost },
  };

  return new Promise((resolve, reject) => {
    const fallback = () => runFindPathFallback({ start, goal, passableTiles, tileCosts, maxCost });

    const timeoutId = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      try {
        resolve(fallback());
      } catch {
        reject("Pathfinding request timed out");
      }
    }, Math.max(timeoutMs, 0));

    pending.set(id, { resolve, reject, fallback, timeoutId });

    const activeWorker = ensureWorker();
    if (!activeWorker) {
      pending.delete(id);
      clearTimeout(timeoutId);
      try {
        resolve(fallback());
      } catch {
        reject("Pathfinding worker unavailable");
      }
      return;
    }

    try {
      activeWorker.postMessage(request);
    } catch {
      pending.delete(id);
      clearTimeout(timeoutId);
      try {
        resolve(fallback());
      } catch {
        reject("Pathfinding worker unavailable");
      }
    }
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

  if (typeof Worker === "undefined") {
    return Promise.resolve(runReachableFallback({ start, passableTiles, tileCosts, maxCost }));
  }

  const id = makeId("reachable");
  const request: PathfindingRequest = {
    id,
    type: "getReachable",
    data: { start, passableTiles, tileCosts, maxCost },
  };

  return new Promise((resolve, reject) => {
    const fallback = () => runReachableFallback({ start, passableTiles, tileCosts, maxCost });

    const timeoutId = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      try {
        resolve(fallback());
      } catch {
        reject("Reachable tiles request timed out");
      }
    }, Math.max(timeoutMs, 0));

    pending.set(id, { resolve, reject, fallback, timeoutId });

    const activeWorker = ensureWorker();
    if (!activeWorker) {
      pending.delete(id);
      clearTimeout(timeoutId);
      try {
        resolve(fallback());
      } catch {
        reject("Pathfinding worker unavailable");
      }
      return;
    }

    try {
      activeWorker.postMessage(request);
    } catch {
      pending.delete(id);
      clearTimeout(timeoutId);
      try {
        resolve(fallback());
      } catch {
        reject("Pathfinding worker unavailable");
      }
    }
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
