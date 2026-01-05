import { findPath, getReachableTiles } from "@shared/logic/pathfinding";
import { HexCoordinate } from "@shared/types/coordinates";

interface PathfindingRequest {
  id: string;
  type: 'findPath' | 'getReachable';
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

self.onmessage = function(e: MessageEvent<PathfindingRequest>) {
  const { id, type, data } = e.data;
  
  try {
    const passableSet = new Set(data.passableTiles);
    const isPassable = (coord: HexCoordinate): boolean => {
      const key = `${coord.q},${coord.r}`;
      return passableSet.has(key);
    };
    const getMoveCost = (coord: HexCoordinate): number => {
      const key = `${coord.q},${coord.r}`;
      const cost = data.tileCosts[key];
      return typeof cost === 'number' ? cost : 1;
    };

    let result: HexCoordinate[];

    if (type === 'findPath' && data.goal) {
      result = findPath(data.start, data.goal, isPassable, data.maxCost, getMoveCost);
    } else if (type === 'getReachable') {
      result = getReachableTiles(data.start, data.maxCost, isPassable, getMoveCost);
    } else {
      throw new Error('Invalid pathfinding request type');
    }

    const response: PathfindingResponse = { id, result };
    self.postMessage(response);
    
  } catch (error) {
    const response: PathfindingResponse = { 
      id, 
      result: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    self.postMessage(response);
  }
};
