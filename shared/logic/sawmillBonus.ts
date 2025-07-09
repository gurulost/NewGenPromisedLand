/**
 * Sawmill Bonus Calculation - Polytopia-style lumber economy
 * Sawmills provide +1 population for each adjacent Lumber Hut
 */

import { GameState, HexCoordinate } from '../types/game';
import { hexDistance } from '../utils/hexCoordinates';

/**
 * Calculate the population bonus for a sawmill based on adjacent lumber huts
 */
export function calculateSawmillBonus(
  state: GameState,
  sawmillCoordinate: HexCoordinate
): number {
  const improvements = state.improvements || [];
  
  // Find all lumber huts adjacent to this sawmill (within 1 hex)
  const adjacentLumberHuts = improvements.filter(improvement => {
    return improvement.type === 'lumber_hut' && 
           hexDistance(improvement.coordinate, sawmillCoordinate) === 1;
  });
  
  return adjacentLumberHuts.length; // +1 population per adjacent lumber hut
}

/**
 * Get total population bonus for all sawmills in a city's territory
 */
export function getCitySawmillBonus(
  state: GameState,
  cityCoordinate: HexCoordinate
): number {
  const improvements = state.improvements || [];
  
  // Find all sawmills within 2 tiles of the city
  const citySawmills = improvements.filter(improvement => {
    return improvement.type === 'sawmill' && 
           hexDistance(improvement.coordinate, cityCoordinate) <= 2;
  });
  
  // Calculate total bonus from all sawmills
  return citySawmills.reduce((total, sawmill) => {
    return total + calculateSawmillBonus(state, sawmill.coordinate);
  }, 0);
}

/**
 * Update city population growth based on lumber huts and sawmill bonuses
 */
export function updateCityLumberEconomy(
  state: GameState,
  cityId: string
): number {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return 0;
  
  const improvements = state.improvements || [];
  
  // Base lumber hut bonus (+1 per lumber hut)
  const lumberHuts = improvements.filter(improvement => {
    return improvement.type === 'lumber_hut' && 
           hexDistance(improvement.coordinate, city.coordinate) <= 2;
  });
  
  // Sawmill bonus (+1 per adjacent lumber hut for each sawmill)
  const sawmillBonus = getCitySawmillBonus(state, city.coordinate);
  
  return lumberHuts.length + sawmillBonus;
}