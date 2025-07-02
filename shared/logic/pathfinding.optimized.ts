import { HexCoordinate } from "../types/game";
import { hexDistance, hexNeighbors } from "../utils/hex";

interface PathNode {
  coordinate: HexCoordinate;
  gCost: number;
  hCost: number;
  fCost: number;
  parent?: PathNode;
}

// High-performance Priority Queue implementation for A* pathfinding
class PriorityQueue {
  private heap: PathNode[] = [];
  
  push(node: PathNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }
  
  pop(): PathNode | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    
    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }
  
  get length(): number {
    return this.heap.length;
  }
  
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].fCost >= this.heap[parentIndex].fCost) break;
      
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }
  
  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      
      if (leftChild < this.heap.length && this.heap[leftChild].fCost < this.heap[smallest].fCost) {
        smallest = leftChild;
      }
      
      if (rightChild < this.heap.length && this.heap[rightChild].fCost < this.heap[smallest].fCost) {
        smallest = rightChild;
      }
      
      if (smallest === index) break;
      
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

export function findPath(
  start: HexCoordinate,
  goal: HexCoordinate,
  isPassable: (coord: HexCoordinate) => boolean,
  maxDistance: number = Infinity
): HexCoordinate[] {
  
  // Use priority queue for O(log n) operations instead of O(n log n) sorting
  const openSet = new PriorityQueue();
  const openMap = new Map<string, PathNode>(); // O(1) lookups instead of O(n) array searches
  const closedSet = new Set<string>();
  
  const startNode: PathNode = {
    coordinate: start,
    gCost: 0,
    hCost: hexDistance(start, goal),
    fCost: hexDistance(start, goal)
  };
  
  const startKey = coordToKey(start);
  openSet.push(startNode);
  openMap.set(startKey, startNode);
  
  while (openSet.length > 0) {
    // Priority queue automatically gives us the lowest fCost node - O(log n)
    const currentNode = openSet.pop()!;
    const currentKey = coordToKey(currentNode.coordinate);
    
    // Remove from open map and add to closed set
    openMap.delete(currentKey);
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
      
      if (gCost > maxDistance) {
        continue;
      }
      
      // O(1) lookup instead of O(n) array search
      const existingNode = openMap.get(neighborKey);
      
      if (!existingNode || gCost < existingNode.gCost) {
        const newNode: PathNode = {
          coordinate: neighbor,
          gCost,
          hCost: hexDistance(neighbor, goal),
          fCost: gCost + hexDistance(neighbor, goal),
          parent: currentNode
        };
        
        if (existingNode) {
          // Update existing node in place
          Object.assign(existingNode, newNode);
        } else {
          openSet.push(newNode);
          openMap.set(neighborKey, newNode);
        }
      }
    }
  }
  
  return []; // No path found
}

function reconstructPath(node: PathNode): HexCoordinate[] {
  const path: HexCoordinate[] = [];
  let currentNode: PathNode | undefined = node;
  
  while (currentNode) {
    path.unshift(currentNode.coordinate);
    currentNode = currentNode.parent;
  }
  
  return path;
}

function coordToKey(coord: HexCoordinate): string {
  return `${coord.q},${coord.r}`;
}

export function getReachableTiles(
  start: HexCoordinate,
  maxDistance: number,
  isPassable: (coord: HexCoordinate) => boolean
): HexCoordinate[] {
  const reachable: HexCoordinate[] = [];
  const visited = new Set<string>();
  const queue: { coord: HexCoordinate; distance: number }[] = [
    { coord: start, distance: 0 }
  ];
  
  while (queue.length > 0) {
    const { coord, distance } = queue.shift()!;
    const key = coordToKey(coord);
    
    if (visited.has(key) || distance > maxDistance || !isPassable(coord)) {
      continue;
    }
    
    visited.add(key);
    reachable.push(coord);
    
    // Add neighbors for next iteration
    const neighbors = hexNeighbors(coord);
    for (const neighbor of neighbors) {
      const neighborKey = coordToKey(neighbor);
      if (!visited.has(neighborKey)) {
        queue.push({ coord: neighbor, distance: distance + 1 });
      }
    }
  }
  
  return reachable;
}