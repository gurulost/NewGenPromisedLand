/**
 * Village Action Definitions
 * 
 * Defines the two moral choices when encountering unclaimed villages:
 * - Conquer: Military takeover (fast, free, but morally costly)
 * - Convert: Peaceful integration (costs Faith, but better long-term)
 */

export interface VillageActionDefinition {
    id: 'conquer' | 'convert';
    name: string;
    description: string;
    summary: string;
    buttonColor: 'red' | 'blue';
    requirements: {
        faith: number;
        stars: number;
    };
    immediateRewards: {
        stars: number;
        population: number;
    };
    ongoingRewards: {
        starsPerTurn?: number;
    };
    moralImpact: {
        pride: number;
        faith: number;
        dissent: number;
    };
}

export const VILLAGE_ACTIONS: Record<'conquer' | 'convert', VillageActionDefinition> = {
    conquer: {
        id: 'conquer',
        name: 'Conquer',
        description: 'Military takeover - establish dominance through force',
        summary: 'Quick conquest - free but increases instability',
        buttonColor: 'red',
        requirements: {
            faith: 0,
            stars: 0
        },
        immediateRewards: {
            stars: 5,
            population: 1
        },
        ongoingRewards: {},
        moralImpact: {
            pride: 2,
            faith: 0,
            dissent: 1
        }
    },
    convert: {
        id: 'convert',
        name: 'Convert',
        description: 'Peaceful integration through faith and diplomacy',
        summary: 'Peaceful integration - invest Faith for lasting prosperity',
        buttonColor: 'blue',
        requirements: {
            faith: 8,
            stars: 0
        },
        immediateRewards: {
            stars: 2,
            population: 2
        },
        ongoingRewards: {
            starsPerTurn: 1
        },
        moralImpact: {
            pride: 0,
            faith: 2,
            dissent: 0
        }
    }
};

/**
 * Helper to check if player has resources for an action
 */
export function canAffordVillageAction(
    action: VillageActionDefinition,
    playerStats: { faith: number; stars: number }
): boolean {
    return (
        playerStats.faith >= action.requirements.faith &&
        playerStats.stars >= action.requirements.stars
    );
}

/**
 * Helper to get action availability reason
 */
export function getVillageActionAvailabilityReason(
    action: VillageActionDefinition,
    playerStats: { faith: number; stars: number }
): string {
    if (playerStats.faith < action.requirements.faith) {
        return `Insufficient Faith (need ${action.requirements.faith})`;
    }
    if (playerStats.stars < action.requirements.stars) {
        return `Insufficient Stars (need ${action.requirements.stars})`;
    }
    return 'Available';
}
