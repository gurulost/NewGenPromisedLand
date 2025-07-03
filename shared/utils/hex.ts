import { HexCoordinate } from "../types/coordinates";

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

export function hexToPixel(coord: HexCoordinate, size: number): { x: number; y: number } {
  const x = size * (3/2 * coord.q);
  const y = size * (Math.sqrt(3)/2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

export function pixelToHex(x: number, y: number, size: number): HexCoordinate {
  const q = (2/3 * x) / size;
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size;
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

export function isValidHexCoordinate(coord: HexCoordinate): boolean {
  return Math.abs(coord.q + coord.r + coord.s) < 0.001;
}

export function hexRing(center: HexCoordinate, radius: number): HexCoordinate[] {
  if (radius === 0) return [];
  
  const results: HexCoordinate[] = [];
  const directions = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
  ];
  
  let hex = hexAdd(center, hexMultiply(directions[4], radius));
  
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(hex);
      hex = hexAdd(hex, directions[i]);
    }
  }
  
  return results;
}

function hexMultiply(coord: HexCoordinate, factor: number): HexCoordinate {
  return {
    q: coord.q * factor,
    r: coord.r * factor,
    s: coord.s * factor,
  };
}
