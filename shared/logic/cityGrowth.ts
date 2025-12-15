import type { City } from '../types/city';

export function applyPopulationGain(city: City, gain: number): City {
  if (!gain || gain <= 0) return city;

  let population = city.population ?? 1;
  let maxPopulation = city.maxPopulation ?? 4;
  let level = city.level ?? 1;
  let starProduction = city.starProduction ?? 0;

  for (let i = 0; i < gain; i++) {
    population += 1;
    if (population >= maxPopulation) {
      level += 1;
      maxPopulation += 2;
      starProduction += 1;
      population = 1;
    }
  }

  return {
    ...city,
    population,
    maxPopulation,
    level,
    starProduction,
  };
}

