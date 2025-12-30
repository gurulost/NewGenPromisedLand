export function nextSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

export function nextFloat(seed: number): { seed: number; value: number } {
  const updatedSeed = nextSeed(seed);
  return { seed: updatedSeed, value: updatedSeed / 4294967296 };
}

export function nextInt(seed: number, maxExclusive: number): { seed: number; value: number } {
  const { seed: updatedSeed, value } = nextFloat(seed);
  return { seed: updatedSeed, value: Math.floor(value * maxExclusive) };
}

export function nextId(seed: number, prefix: string): { seed: number; id: string } {
  const { seed: updatedSeed, value } = nextFloat(seed);
  const token = Math.floor(value * 1e9).toString(36);
  return { seed: updatedSeed, id: `${prefix}_${token}` };
}
