import { describe, it, expect, beforeEach } from 'vitest';
import { getRandomRuinsReward } from '../shared/data/ruinsRewards';

describe('Ruins System', () => {

    it('generates deterministic rewards with seed', () => {
        const seed = 0.5;
        const reward1 = getRandomRuinsReward(seed);
        const reward2 = getRandomRuinsReward(seed);

        expect(reward1.id).toBe(reward2.id); // Same seed = same reward
    });

    it('generates different rewards with different seeds', () => {
        // Note: This relies on the weights. 0.0 might be 'treasure', 0.9 might be 'curse' or 'artifact'
        // This assumes the distribution creates differences.
        // Given the weights, 0 should be 'small_treasure' (30/100)
        // 0.95 should be a rare/legendary one.

        // Total weight is approx sum of all. 
        // small_treasure: 30
        // ancient_wisdom: 25 (cum 55)
        // healing_spring: 20 (cum 75)
        // ...
        // total ~120-130

        const rewardLow = getRandomRuinsReward(0.01); // 0.01 * ~130 = 1.3 -> small_treasure
        const rewardHigh = getRandomRuinsReward(0.99); // 0.99 * ~130 = ~128 -> likely curse or artifact

        expect(rewardLow.id).not.toBe(rewardHigh.id);
    });
});
