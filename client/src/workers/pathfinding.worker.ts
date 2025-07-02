import { findPath, getReachableTiles } from "@shared/logic/pathfinding";
import { HexCoordinate } from "@shared/types/game";

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

self.onmessage = function(e: MessageEvent<PathfindingRequest>) {
  const { id, type, data } = e.data;
  
  try {
    const isPassable = (coord: HexCoordinate): boolean => {
      const key = `${coord.q},${coord.r}`;
      return data.passableTiles.includes(key);
    };

    let result: HexCoordinate[];

    if (type === 'findPath' && data.goal) {
      result = findPath(data.start, data.goal, isPassable, data.maxDistance);
    } else if (type === 'getReachable') {
      result = getReachableTiles(data.start, data.maxDistance, isPassable);
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
