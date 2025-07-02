import { HexCoordinate } from "../types/game";

export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function hexNeighbors(coord: HexCoordinate): HexCoordinate[] {
  const directions = [
    { q: 1, r: 0, s: -1 },   // E
    { q: 1, r: -1, s: 0 },   // NE
    { q: 0, r: -1, s: 1 },   // NW
    { q: -1, r: 0, s: 1 },   // W
    { q: -1, r: 1, s: 0 },   // SW
    { q: 0, r: 1, s: -1 },   // SE
  ];
  
  return directions.map(dir => ({
    q: coord.q + dir.q,
    r: coord.r + dir.r,
    s: coord.s + dir.s,
  }));
}

export function hexAdd(a: HexCoordinate, b: HexCoordinate): HexCoordinate {
  return {
    q: a.q + b.q,
    r: a.r + b.r,
    s: a.s + b.s,
  };
}

export function hexSubtract(a: HexCoordinate, b: HexCoordinate): HexCoordinate {
  return {
    q: a.q - b.q,
    r: a.r - b.r,
    s: a.s - b.s,
  };
}

export function hexToPixel(coord: HexCoordinate, size: number): { x: number; z: number } {
  const x = size * (3/2 * coord.q);
  const z = size * (Math.sqrt(3)/2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, z };
}

export function pixelToHex(x: number, z: number, size: number): HexCoordinate {
  const q = (2/3 * x) / size;
  const r = (-1/3 * x + Math.sqrt(3)/3 * z) / size;
  return hexRound({ q, r, s: -q - r });
}

export function hexRound(coord: HexCoordinate): HexCoordinate {
  let q = Math.round(coord.q);
  let r = Math.round(coord.r);
  let s = Math.round(coord.s);
  
  const qDiff = Math.abs(q - coord.q);
  const rDiff = Math.abs(r - coord.r);
  const sDiff = Math.abs(s - coord.s);
  
  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }
  
  return { q, r, s };
}

export function coordToKey(coord: HexCoordinate): string {
  return `${coord.q},${coord.r}`;
}

export function keyToCoord(key: string): HexCoordinate {
  const [q, r] = key.split(',').map(Number);
  return { q, r, s: -q - r };
}

export function hexesInRange(center: HexCoordinate, range: number): HexCoordinate[] {
  const results: HexCoordinate[] = [];
  
  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      const s = -q - r;
      results.push(hexAdd(center, { q, r, s }));
    }
  }
  
  return results;
}
