import { useToastContext } from '../components/ui/ToastProvider';
import { useFloatingText } from '../components/ui/FloatingText';

/**
 * Game-specific notification hook combining toasts and floating text
 * Provides themed methods for different game event types
 */
export function useGameNotifications() {
    const toast = useToastContext();
    const float = useFloatingText();

    return {
        // === COMBAT NOTIFICATIONS ===
        /**
         * Damage dealt notification - floating text only (no toast spam)
         */
        damage: (amount: number, x: number, y: number, isCritical = false) => {
            if (isCritical) {
                float.critical(`CRITICAL -${amount}!`, x, y);
            } else {
                float.damage(`-${amount}`, x, y);
            }
        },

        /**
         * Unit killed - both toast and floating text
         */
        unitKilled: (unitName: string, x: number, y: number) => {
            float.damage(`💀 ${unitName} SLAIN`, x, y);
            toast.success('Unit Eliminated', `${unitName} has been destroyed`);
        },

        /**
         * Passive ability triggered - floating text only
         */
        passiveTriggered: (abilityName: string, x: number, y: number, bonus?: string) => {
            float.ability(`${abilityName}${bonus ? ` ${bonus}` : ''}`, x, y);
        },

        // === ABILITY NOTIFICATIONS ===
        /**
         * Active ability used - both toast and floating text
         */
        abilityUsed: (abilityName: string, effect: string, x?: number, y?: number) => {
            if (x !== undefined && y !== undefined) {
                float.ability(abilityName.toUpperCase(), x, y);
            }
            toast.info(abilityName, effect);
        },

        /**
         * Healing applied
         */
        heal: (amount: number, x: number, y: number, allies?: number) => {
            float.heal(`+${amount} HP`, x, y);
            if (allies && allies > 1) {
                toast.success('Healing', `Healed ${allies} allies for ${amount} HP each`);
            }
        },

        /**
         * Rally/buff applied to units
         */
        rally: (unitsAffected: number, x: number, y: number) => {
            float.ability('RALLY!', x, y);
            toast.success('Rally Troops', `Inspired ${unitsAffected} units nearby`);
        },

        /**
         * Conversion attempt
         */
        conversion: (success: boolean, unitType: string, x: number, y: number) => {
            if (success) {
                float.faith('CONVERTED!', x, y);
                toast.success('Conversion Success', `${unitType} joined your cause`);
            } else {
                float.damage('RESISTED', x, y);
                toast.warning('Conversion Failed', `${unitType} resisted conversion`);
            }
        },

        // === RESOURCE NOTIFICATIONS ===
        /**
         * Stars gained
         */
        starsGained: (amount: number, x?: number, y?: number, source?: string) => {
            if (x !== undefined && y !== undefined) {
                float.resource(`+${amount}★`, x, y);
            }
            if (source) {
                toast.info('Stars Gained', `+${amount}★ from ${source}`);
            }
        },

        /**
         * Population gained
         */
        populationGained: (amount: number, cityName: string, x?: number, y?: number) => {
            if (x !== undefined && y !== undefined) {
                float.resource(`+${amount} Pop`, x, y);
            }
            toast.success('Population', `${cityName} gained ${amount} population`);
        },

        /**
         * Faith/Pride/Dissent change
         */
        moralChange: (type: 'faith' | 'pride' | 'dissent', delta: number, x?: number, y?: number) => {
            const icons = { faith: '✝️', pride: '👑', dissent: '⚡' };
            const sign = delta > 0 ? '+' : '';
            if (x !== undefined && y !== undefined) {
                if (type === 'faith') {
                    float.faith(`${sign}${delta} Faith`, x, y);
                } else {
                    float.ability(`${icons[type]} ${sign}${delta}`, x, y);
                }
            }
        },

        // === DISCOVERY NOTIFICATIONS ===
        /**
         * Ruin explored with reward
         */
        ruinReward: (rewardType: string, description: string, x: number, y: number) => {
            float.ability(`🏛️ ${rewardType.toUpperCase()}!`, x, y);
            toast.success('Ancient Discovery', description);
        },

        /**
         * Technology researched
         */
        techResearched: (techName: string) => {
            toast.success('Technology Acquired', `${techName} has been researched`);
        },

        /**
         * Resource harvested
         */
        resourceHarvested: (resourceName: string, bonus: string, x: number, y: number) => {
            float.resource(bonus, x, y);
            toast.info('Harvest Complete', `${resourceName}: ${bonus}`);
        },

        // === DIRECT ACCESS ===
        toast,
        float,
    };
}

export type GameNotifications = ReturnType<typeof useGameNotifications>;
