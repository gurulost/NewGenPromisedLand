import { HexCoordinate } from "../types/coordinates";
import { hexDistance, hexNeighbors } from "../utils/hex";

type MovementCostFn = (coord: HexCoordinate) => number;

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

const defaultMoveCost: MovementCostFn = () => 1;

const normalizeMoveCost = (cost: number): number =>
  Number.isFinite(cost) && cost > 0 ? cost : Infinity;

export function findPath(
  start: HexCoordinate,
  goal: HexCoordinate,
  isPassable: (coord: HexCoordinate) => boolean,
  maxCost: number = Infinity,
  getMoveCost: MovementCostFn = defaultMoveCost
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
      
      const stepCost = normalizeMoveCost(getMoveCost(neighbor));
      if (!Number.isFinite(stepCost)) {
        continue;
      }

      const gCost = currentNode.gCost + stepCost;
      
      if (gCost > maxCost) {
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

export function getPathCost(
  start: HexCoordinate,
  goal: HexCoordinate,
  isPassable: (coord: HexCoordinate) => boolean,
  maxCost: number = Infinity,
  getMoveCost: MovementCostFn = defaultMoveCost
): number | null {
  const openSet = new PriorityQueue();
  const bestCosts = new Map<string, number>();

  const startNode: PathNode = {
    coordinate: start,
    gCost: 0,
    hCost: 0,
    fCost: 0
  };

  openSet.push(startNode);
  bestCosts.set(coordToKey(start), 0);

  while (openSet.length > 0) {
    const currentNode = openSet.pop()!;
    const currentKey = coordToKey(currentNode.coordinate);
    const bestCost = bestCosts.get(currentKey);

    if (bestCost !== undefined && currentNode.gCost > bestCost) {
      continue;
    }

    if (currentNode.gCost > maxCost) {
      continue;
    }

    if (hexDistance(currentNode.coordinate, goal) === 0) {
      return currentNode.gCost;
    }

    const neighbors = hexNeighbors(currentNode.coordinate);
    for (const neighbor of neighbors) {
      if (!isPassable(neighbor)) continue;

      const stepCost = normalizeMoveCost(getMoveCost(neighbor));
      if (!Number.isFinite(stepCost)) continue;

      const nextCost = currentNode.gCost + stepCost;
      if (nextCost > maxCost) continue;

      const neighborKey = coordToKey(neighbor);
      const recordedCost = bestCosts.get(neighborKey);
      if (recordedCost === undefined || nextCost < recordedCost) {
        bestCosts.set(neighborKey, nextCost);
        openSet.push({
          coordinate: neighbor,
          gCost: nextCost,
          hCost: 0,
          fCost: nextCost
        });
      }
    }
  }

  return null;
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
  maxCost: number,
  isPassable: (coord: HexCoordinate) => boolean,
  getMoveCost: MovementCostFn = defaultMoveCost
): HexCoordinate[] {
  const reachable: HexCoordinate[] = [];
  const visited = new Set<string>();
  const bestCosts = new Map<string, number>();
  const queue = new PriorityQueue();

  const startNode: PathNode = {
    coordinate: start,
    gCost: 0,
    hCost: 0,
    fCost: 0
  };

  queue.push(startNode);
  bestCosts.set(coordToKey(start), 0);

  while (queue.length > 0) {
    const { coordinate, gCost } = queue.pop()!;
    const key = coordToKey(coordinate);

    if (visited.has(key)) continue;
    visited.add(key);

    if (gCost > maxCost) continue;
    if (!isPassable(coordinate)) continue;

    reachable.push(coordinate);

    const neighbors = hexNeighbors(coordinate);
    for (const neighbor of neighbors) {
      const neighborKey = coordToKey(neighbor);
      if (visited.has(neighborKey)) continue;
      if (!isPassable(neighbor)) continue;

      const stepCost = normalizeMoveCost(getMoveCost(neighbor));
      if (!Number.isFinite(stepCost)) continue;

      const nextCost = gCost + stepCost;
      if (nextCost > maxCost) continue;

      const recorded = bestCosts.get(neighborKey);
      if (recorded === undefined || nextCost < recorded) {
        bestCosts.set(neighborKey, nextCost);
        queue.push({
          coordinate: neighbor,
          gCost: nextCost,
          hCost: 0,
          fCost: nextCost
        });
      }
    }
  }

  return reachable;
}
