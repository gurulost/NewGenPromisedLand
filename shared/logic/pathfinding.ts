import { HexCoordinate } from "../types/game";
import { hexDistance, hexNeighbors } from "../utils/hex";

interface PathNode {
  coordinate: HexCoordinate;
  gCost: number;
  hCost: number;
  fCost: number;
  parent?: PathNode;
}

export function findPath(
  start: HexCoordinate,
  goal: HexCoordinate,
  isPassable: (coord: HexCoordinate) => boolean,
  maxDistance: number = Infinity
): HexCoordinate[] {
  
  const openSet: PathNode[] = [];
  const closedSet: Set<string> = new Set();
  
  const startNode: PathNode = {
    coordinate: start,
    gCost: 0,
    hCost: hexDistance(start, goal),
    fCost: hexDistance(start, goal)
  };
  
  openSet.push(startNode);
  
  while (openSet.length > 0) {
    // Find node with lowest fCost
    openSet.sort((a, b) => a.fCost - b.fCost);
    const currentNode = openSet.shift()!;
    
    const currentKey = coordToKey(currentNode.coordinate);
    closedSet.add(currentKey);
    
    // Check if we reached the goal
    if (hexDistance(currentNode.coordinate, goal) === 0) {
      return reconstructPath(currentNode);
    }
    
    // Check neighbors
    const neighbors = hexNeighbors(currentNode.coordinate);
    
    for (const neighbor of neighbors) {
      const neighborKey = coordToKey(neighbor);
      
      if (closedSet.has(neighborKey) || !isPassable(neighbor)) {
        continue;
      }
      
      const gCost = currentNode.gCost + 1;
      
      // Skip if too far
      if (gCost > maxDistance) {
        continue;
      }
      
      const hCost = hexDistance(neighbor, goal);
      const fCost = gCost + hCost;
      
      const existingNode = openSet.find(node => 
        coordToKey(node.coordinate) === neighborKey
      );
      
      if (!existingNode) {
        const newNode: PathNode = {
          coordinate: neighbor,
          gCost,
          hCost,
          fCost,
          parent: currentNode
        };
        openSet.push(newNode);
      } else if (gCost < existingNode.gCost) {
        existingNode.gCost = gCost;
        existingNode.fCost = gCost + hCost;
        existingNode.parent = currentNode;
      }
    }
  }
  
  return []; // No path found
}

function reconstructPath(node: PathNode): HexCoordinate[] {
  const path: HexCoordinate[] = [];
  let current: PathNode | undefined = node;
  
  while (current) {
    path.unshift(current.coordinate);
    current = current.parent;
  }
  
  return path;
}

function coordToKey(coord: HexCoordinate): string {
  return `${coord.q},${coord.r}`;
}

export function getReachableTiles(
  start: HexCoordinate,
  movement: number,
  isPassable: (coord: HexCoordinate) => boolean
): HexCoordinate[] {
  const reachable: HexCoordinate[] = [];
  const visited: Set<string> = new Set();
  const queue: { coord: HexCoordinate; distance: number }[] = [
    { coord: start, distance: 0 }
  ];
  
  while (queue.length > 0) {
    const { coord, distance } = queue.shift()!;
    const key = coordToKey(coord);
    
    if (visited.has(key) || distance > movement) {
      continue;
    }
    
    visited.add(key);
    
    if (isPassable(coord)) {
      reachable.push(coord);
      
      // Add neighbors for further exploration
      const neighbors = hexNeighbors(coord);
      for (const neighbor of neighbors) {
        if (!visited.has(coordToKey(neighbor))) {
          queue.push({ coord: neighbor, distance: distance + 1 });
        }
      }
    }
  }
  
  return reachable;
}
