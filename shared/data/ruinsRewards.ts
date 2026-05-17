/**
 * Ruins Exploration Rewards System
 * 
 * Defines the possible rewards when a unit explores ancient ruins.
 * Rewards are randomly selected based on rarity tiers.
 */

export type RuinsRewardType =
    | 'stars'
    | 'faith'
    | 'tech_boost'
    | 'unit_spawn'
    | 'vision_boost'
    | 'heal'
    | 'curse'
    | 'population'
    | 'reveal';

export interface RuinsReward {
    id: string;
    type: RuinsRewardType;
    name: string;
    description: string;
    scripture?: string;

    // Reward values
    stars?: number;
    faith?: number;
    techBoost?: number; // Research progress
    techName?: string;
    unitType?: string;
    unitName?: string;
    visionTurns?: number; // Temporary vision boost duration
    healAmount?: number;
    population?: number;
    reveal?: string;

    // Curse effects (negative)
    dissent?: number;
    pride?: number;

    // Probability weight (higher = more common)
    weight: number;

    // Rarity tier
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export const RUINS_REWARDS: Record<string, RuinsReward> = {
    // COMMON REWARDS (60% chance combined)
    small_treasure: {
        id: 'small_treasure',
        type: 'stars',
        name: 'Small Treasure',
        description: 'You discover a cache of ancient artifacts',
        scripture: 'Helaman 13:20 – "...your riches are corrupted..."',
        stars: 10,
        weight: 30,
        rarity: 'common'
    },

    ancient_wisdom: {
        id: 'ancient_wisdom',
        name: 'Ancient Wisdom',
        type: 'tech_boost',
        description: 'Ancient scrolls accelerate your research',
        scripture: '2 Nephi 9:28 – "...to be learned is good if they hearken..."',
        techBoost: 5,
        weight: 25,
        rarity: 'common'
    },

    healing_spring: {
        id: 'healing_spring',
        type: 'heal',
        name: 'Healing Spring',
        description: 'A sacred spring restores your unit',
        scripture: 'Alma 37:46 – "...the word of Christ, which will point unto you..."',
        healAmount: 5,
        weight: 20,
        rarity: 'common'
    },

    // UNCOMMON REWARDS (25% chance combined)
    moderate_treasure: {
        id: 'moderate_treasure',
        type: 'stars',
        name: 'Moderate Treasure',
        description: 'A substantial hoard of precious resources',
        stars: 25,
        weight: 15,
        rarity: 'uncommon'
    },

    spiritual_enlightenment: {
        id: 'spiritual_enlightenment',
        type: 'faith',
        name: 'Spiritual Enlightenment',
        description: 'Divine inspiration strengthens your faith',
        scripture: 'Mosiah 4:11 – "...believe that he has all wisdom..."',
        faith: 10,
        weight: 10,
        rarity: 'uncommon'
    },

    temporary_vision: {
        id: 'temporary_vision',
        type: 'vision_boost',
        name: 'Watchtower Vision',
        description: 'The ruins provide a strategic vantage point',
        visionTurns: 5,
        weight: 8,
        rarity: 'uncommon'
    },

    // RARE REWARDS (12% chance combined)
    large_treasure: {
        id: 'large_treasure',
        type: 'stars',
        name: 'Large Treasure',
        description: 'An enormous treasure trove awaits',
        stars: 50,
        weight: 6,
        rarity: 'rare'
    },

    ancient_ally: {
        id: 'ancient_ally',
        type: 'unit_spawn',
        name: 'Ancient Ally',
        description: 'A legendary warrior joins your cause',
        scripture: 'Alma 56:47 – "...they had been taught by their mothers..."',
        unitType: 'warrior',
        weight: 4,
        rarity: 'rare'
    },

    major_research: {
        id: 'major_research',
        type: 'tech_boost',
        name: 'Major Research Breakthrough',
        description: 'Ancient knowledge provides major insights',
        techBoost: 15,
        weight: 3,
        rarity: 'rare'
    },

    // LEGENDARY REWARDS (3% chance combined)
    divine_blessing: {
        id: 'divine_blessing',
        type: 'faith',
        name: 'Divine Blessing',
        description: 'The Spirit fills you with overwhelming faith',
        scripture: 'Enos 1:5 – "...there came a voice unto me, saying: Enos, thy sins are forgiven..."',
        faith: 25,
        stars: 25,
        weight: 2,
        rarity: 'legendary'
    },

    ancient_artifact: {
        id: 'ancient_artifact',
        type: 'stars',
        name: 'Ancient Artifact',
        description: 'A priceless relic of immense value',
        scripture: 'Ether 3:1 – "...did molten out of a rock sixteen small stones..."',
        stars: 100,
        techBoost: 10,
        weight: 1,
        rarity: 'legendary'
    },

    // CURSE (Rare negative event - 5% chance)
    ancient_curse: {
        id: 'ancient_curse',
        type: 'curse',
        name: 'Ancient Curse',
        description: 'You disturbed something that should have remained buried',
        scripture: 'Helaman 13:18 – "...cursed be the land unto you..."',
        dissent: 5,
        pride: 3,
        weight: 5,
        rarity: 'uncommon'
    }
};

/**
 * Get a random reward based on weighted probability
 * @param randomValue - Canonical random value (0-1) supplied by the caller's seeded RNG.
 */
export function getRandomRuinsReward(randomValue: number): RuinsReward {
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue > 1) {
        throw new Error('getRandomRuinsReward requires a deterministic random value between 0 and 1');
    }

    const rewards = Object.values(RUINS_REWARDS);
    const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);

    let selector = randomValue * totalWeight;

    for (const reward of rewards) {
        selector -= reward.weight;
        if (selector <= 0) {
            return reward;
        }
    }

    // Fallback to first reward
    return rewards[0];
}

/**
 * Get reward rarity color for UI
 */
export function getRarityColor(rarity: RuinsReward['rarity']): string {
    switch (rarity) {
        case 'common': return 'text-gray-300';
        case 'uncommon': return 'text-green-300';
        case 'rare': return 'text-blue-300';
        case 'legendary': return 'text-amber-300';
    }
}

/**
 * Get reward icon emoji
 */
export function getRewardIcon(type: RuinsRewardType): string {
    switch (type) {
        case 'stars': return '⭐';
        case 'faith': return '✨';
        case 'tech_boost': return '📜';
        case 'unit_spawn': return '⚔️';
        case 'vision_boost': return '👁️';
        case 'heal': return '💚';
        case 'curse': return '💀';
        case 'population': return '👥';
        case 'reveal': return '🗺️';
    }
}
