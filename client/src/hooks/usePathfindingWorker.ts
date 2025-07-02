import { useEffect, useRef, useCallback } from 'react';
import { HexCoordinate } from '@shared/types/coordinates';

interface PathfindingRequest {
  id: string;
  type: 'findPath' | 'getReachable';
  data: {
    start: HexCoordinate;
    goal?: HexCoordinate;
    passableTiles: string[];
    maxDistance: number;
  };
}

interface PathfindingResponse {
  id: string;
  result: HexCoordinate[];
  error?: string;
}

type PathfindingCallback = (result: HexCoordinate[], error?: string) => void;

export function usePathfindingWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<string, PathfindingCallback>>(new Map());

  useEffect(() => {
    // Initialize the worker
    workerRef.current = new Worker(
      new URL('../workers/pathfinding.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Set up message handler
    workerRef.current.onmessage = (e: MessageEvent<PathfindingResponse>) => {
      const { id, result, error } = e.data;
      const callback = callbacksRef.current.get(id);
      
      if (callback) {
        callback(result, error);
        callbacksRef.current.delete(id);
      }
    };

    // Set up error handler
    workerRef.current.onerror = (error) => {
      console.error('Pathfinding worker error:', error);
    };

    return () => {
      // Cleanup worker on unmount
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const findPath = useCallback((
    start: HexCoordinate,
    goal: HexCoordinate,
    passableTiles: string[],
    maxDistance: number,
    callback: PathfindingCallback
  ) => {
    if (!workerRef.current) {
      callback([], 'Worker not initialized');
      return;
    }

    const id = `path_${Date.now()}_${Math.random()}`;
    callbacksRef.current.set(id, callback);

    const request: PathfindingRequest = {
      id,
      type: 'findPath',
      data: { start, goal, passableTiles, maxDistance }
    };

    workerRef.current.postMessage(request);
  }, []);

  const getReachableTiles = useCallback((
    start: HexCoordinate,
    maxDistance: number,
    passableTiles: string[],
    callback: PathfindingCallback
  ) => {
    if (!workerRef.current) {
      callback([], 'Worker not initialized');
      return;
    }

    const id = `reachable_${Date.now()}_${Math.random()}`;
    callbacksRef.current.set(id, callback);

    const request: PathfindingRequest = {
      id,
      type: 'getReachable',
      data: { start, passableTiles, maxDistance }
    };

    workerRef.current.postMessage(request);
  }, []);

  return { findPath, getReachableTiles };
}