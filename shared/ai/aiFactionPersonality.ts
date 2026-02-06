/**
 * AI Faction Personality System - Brings Book of Mormon factions to life
 * Each faction has unique behaviors, priorities, and decision-making patterns
 */

import { PlayerState } from '../types/game';
import { getFaction } from '../data/factions';
import { coerceFactionId } from '../types/factionId';
import { SeededRNG } from './aiFoundation';

export interface FactionPersonality {
  // Core traits (0-1 scale)
  aggression: number;      // Likelihood to attack
  piety: number;          // Focus on faith/religious buildings
  opportunism: number;    // Willingness to take risks for rewards
  riskTolerance: number;  // Comfort with dangerous situations
  expansionism: number;   // Drive to expand territory
  diplomacy: number;      // Preference for peaceful solutions
  
  // Strategic preferences
  preferredVictory: 'conquest' | 'faith' | 'cultural' | 'economic';
  buildingPriorities: string[];
  techPriorities: string[];
  unitPreferences: string[];
  
  // Behavioral modifiers
  retreatThreshold: number;    // Health % when units retreat
  attackThreshold: number;     // Advantage needed to attack
  settlementSpacing: number;   // Preferred distance between cities
  
  // Mood system (dynamic changes based on game state)
  currentMood: {
    confidence: number;      // Recent military success
    desperation: number;     // How badly losing
    zealotry: number;        // Religious fervor
    pragmatism: number;      // Practical decision making
  };
}

/**
 * Personality templates for each faction based on Book of Mormon lore
 */
const FACTION_PERSONALITIES: Record<string, Partial<FactionPersonality>> = {
  nephites: {
    aggression: 0.4,
    piety: 0.8,
    opportunism: 0.3,
    riskTolerance: 0.5,
    expansionism: 0.6,
    diplomacy: 0.7,
    preferredVictory: 'faith',
    buildingPriorities: ['temple', 'granary', 'academy', 'cathedral'],
    techPriorities: ['organization', 'priesthood', 'philosophy', 'navigation'],
    unitPreferences: ['spearman', 'stripling_warrior', 'missionary'],
    retreatThreshold: 0.4,
    attackThreshold: 0.6,
    settlementSpacing: 4
  },
  
  lamanites: {
    aggression: 0.8,
    piety: 0.3,
    opportunism: 0.7,
    riskTolerance: 0.8,
    expansionism: 0.9,
    diplomacy: 0.2,
    preferredVictory: 'conquest',
    buildingPriorities: ['fortress', 'temple', 'granary', 'academy'],
    techPriorities: ['hunting', 'bronze_working', 'agriculture', 'leadership'],
    unitPreferences: ['warrior', 'spearman', 'guard'],
    retreatThreshold: 0.2,
    attackThreshold: 0.4,
    settlementSpacing: 6
  },
  
  mulekites: {
    aggression: 0.5,
    piety: 0.5,
    opportunism: 0.8,
    riskTolerance: 0.6,
    expansionism: 0.7,
    diplomacy: 0.6,
    preferredVictory: 'economic',
    buildingPriorities: ['lighthouse', 'market', 'granary', 'temple'],
    techPriorities: ['woodcraft', 'seafaring', 'sailing', 'trade'],
    unitPreferences: ['scout', 'boat', 'warrior'],
    retreatThreshold: 0.5,
    attackThreshold: 0.7,
    settlementSpacing: 5
  },
  
  'anti-nephi-lehies': {
    aggression: 0.1,
    piety: 0.9,
    opportunism: 0.2,
    riskTolerance: 0.3,
    expansionism: 0.4,
    diplomacy: 0.9,
    preferredVictory: 'faith',
    buildingPriorities: ['temple', 'granary', 'academy', 'library'],
    techPriorities: ['spirituality', 'agriculture', 'philosophy', 'navigation'],
    unitPreferences: ['missionary', 'stripling_warrior', 'guard', 'worker'],
    retreatThreshold: 0.7,
    attackThreshold: 0.9, // Almost never attack
    settlementSpacing: 3
  },
  
  zoramites: {
    aggression: 0.6,
    piety: 0.4,
    opportunism: 0.9,
    riskTolerance: 0.7,
    expansionism: 0.5,
    diplomacy: 0.3,
    preferredVictory: 'cultural',
    buildingPriorities: ['library', 'academy', 'market', 'temple'],
    techPriorities: ['trade', 'philosophy', 'engineering', 'leadership'],
    unitPreferences: ['commander', 'missionary', 'spearman'],
    retreatThreshold: 0.3,
    attackThreshold: 0.5,
    settlementSpacing: 4
  },
  
  jaredites: {
    aggression: 0.7,
    piety: 0.6,
    opportunism: 0.5,
    riskTolerance: 0.9,
    expansionism: 0.8,
    diplomacy: 0.1,
    preferredVictory: 'conquest',
    buildingPriorities: ['fortress', 'temple', 'academy', 'granary'],
    techPriorities: ['bronze_working', 'engineering', 'leadership', 'navigation'],
    unitPreferences: ['spearman', 'commander', 'catapult'],
    retreatThreshold: 0.1,
    attackThreshold: 0.3,
    settlementSpacing: 7
  },

  'hagoths-mariners': {
    aggression: 0.45,
    piety: 0.65,
    opportunism: 0.75,
    riskTolerance: 0.6,
    expansionism: 0.8,
    diplomacy: 0.6,
    preferredVictory: 'economic',
    buildingPriorities: ['lighthouse', 'granary', 'temple', 'academy'],
    techPriorities: ['hunting', 'sailing', 'seafaring', 'trade', 'navigation'],
    unitPreferences: ['voyager', 'boat', 'scout', 'shipwright'],
    retreatThreshold: 0.45,
    attackThreshold: 0.65,
    settlementSpacing: 5
  },

  amulonites: {
    aggression: 0.65,
    piety: 0.15,
    opportunism: 0.85,
    riskTolerance: 0.75,
    expansionism: 0.7,
    diplomacy: 0.15,
    preferredVictory: 'conquest',
    buildingPriorities: ['fortress', 'granary', 'temple', 'academy'],
    techPriorities: ['organization', 'mining', 'bronze_working', 'trade', 'leadership'],
    unitPreferences: ['amulonite_enforcer', 'taskmaster', 'spearman', 'guard'],
    retreatThreshold: 0.25,
    attackThreshold: 0.5,
    settlementSpacing: 6
  }
};

/**
 * Dynamic personality system that evolves based on game events
 */
export class FactionPersonalityEngine {
  private personality: FactionPersonality;
  private rng: SeededRNG;
  private player: PlayerState;

  constructor(player: PlayerState, seed: number) {
    this.player = player;
    // Generate deterministic seed from player ID - use hash if not numeric
    const playerIdHash = this.hashString(this.player.id);
    this.rng = new SeededRNG(seed + playerIdHash);
    this.personality = this.initializePersonality();
  }

  /**
   * Initialize personality from faction template
   */
  private initializePersonality(): FactionPersonality {
    const factionId = coerceFactionId(this.player.factionId) ?? 'NEPHITES';
    const faction = getFaction(factionId);
    const key = faction.id.toLowerCase().replace(/_/g, '-');
    const template = FACTION_PERSONALITIES[key] || FACTION_PERSONALITIES.nephites;
    
    // Add some randomization to make each AI unique
    const personality: FactionPersonality = {
      aggression: this.randomizeValue(template.aggression ?? 0.5),
      piety: this.randomizeValue(template.piety ?? 0.5),
      opportunism: this.randomizeValue(template.opportunism ?? 0.5),
      riskTolerance: this.randomizeValue(template.riskTolerance ?? 0.5),
      expansionism: this.randomizeValue(template.expansionism ?? 0.5),
      diplomacy: this.randomizeValue(template.diplomacy ?? 0.5),
      
      preferredVictory: template.preferredVictory || 'conquest',
      buildingPriorities: [...(template.buildingPriorities || [])],
      techPriorities: [...(template.techPriorities || [])],
      unitPreferences: [...(template.unitPreferences || [])],
      
      retreatThreshold: template.retreatThreshold ?? 0.4,
      attackThreshold: template.attackThreshold ?? 0.6,
      settlementSpacing: template.settlementSpacing ?? 5,
      
      currentMood: {
        confidence: 0.5,
        desperation: 0.0,
        zealotry: template.piety ?? 0.5,
        pragmatism: 1 - (template.piety ?? 0.5)
      }
    };
    
    return personality;
  }

  /**
   * Add slight randomization to personality values
   */
  private randomizeValue(base: number, variance: number = 0.15): number {
    const min = Math.max(0, base - variance);
    const max = Math.min(1, base + variance);
    return this.rng.nextFloat(min, max);
  }

  /**
   * Update personality based on recent game events
   */
  updateMood(events: {
    recentVictories: number;
    recentDefeats: number;
    territoryLost: number;
    faithGained: number;
    enemyThreat: number;
  }): void {
    const mood = this.personality.currentMood;
    
    // Confidence from military success
    const netVictories = events.recentVictories - events.recentDefeats;
    mood.confidence = Math.max(0, Math.min(1, 
      mood.confidence + netVictories * 0.1 - events.territoryLost * 0.2
    ));
    
    // Desperation from losing
    if (events.recentDefeats > events.recentVictories) {
      mood.desperation = Math.min(1, mood.desperation + 0.15);
    } else {
      mood.desperation = Math.max(0, mood.desperation - 0.05);
    }
    
    // Zealotry from faith gains and threats
    mood.zealotry = Math.max(0, Math.min(1,
      mood.zealotry + events.faithGained * 0.05 + events.enemyThreat * 0.1
    ));
    
    // Pragmatism inversely related to zealotry and desperation
    mood.pragmatism = Math.max(0, Math.min(1,
      1 - (mood.zealotry + mood.desperation) / 2
    ));
  }

  /**
   * Get decision modifier based on personality and mood
   */
  getDecisionModifier(decisionType: string): number {
    const p = this.personality;
    const m = p.currentMood;
    
    switch (decisionType) {
      case 'attack':
        return this.blendValues([
          p.aggression,
          m.confidence * 0.5,
          m.desperation * 0.3
        ]);
        
      case 'retreat':
        return this.blendValues([
          1 - p.riskTolerance,
          (1 - m.confidence) * 0.6,
          m.pragmatism * 0.4
        ]);
        
      case 'expand':
        return this.blendValues([
          p.expansionism,
          m.confidence * 0.4,
          p.opportunism * 0.3
        ]);
        
      case 'tech_faith':
        return this.blendValues([
          p.piety,
          m.zealotry * 0.6,
          (1 - m.pragmatism) * 0.3
        ]);
        
      case 'tech_military':
        return this.blendValues([
          p.aggression,
          (1 - m.confidence) * 0.5,
          m.desperation * 0.4
        ]);
        
      case 'diplomacy':
        return this.blendValues([
          p.diplomacy,
          m.pragmatism * 0.5,
          (1 - p.aggression) * 0.3
        ]);
        
      default:
        return 0.5;
    }
  }

  /**
   * Get building priority based on personality
   */
  getBuildingPriority(buildingType: string): number {
    const basePriority = this.personality.buildingPriorities.indexOf(buildingType);
    if (basePriority === -1) return 0.3; // Default low priority
    
    const priorityScore = 1 - (basePriority / this.personality.buildingPriorities.length);
    
    // Mood modifiers
    const moodModifier = this.getMoodModifier(buildingType);
    
    return Math.max(0, Math.min(1, priorityScore + moodModifier));
  }

  /**
   * Get unit preference based on personality
   */
  getUnitPreference(unitType: string): number {
    const basePriority = this.personality.unitPreferences.indexOf(unitType);
    if (basePriority === -1) return 0.3;
    
    const priorityScore = 1 - (basePriority / this.personality.unitPreferences.length);
    
    // Mood modifiers
    let moodModifier = 0;
    if (unitType.includes('warrior') || unitType.includes('slinger') || unitType.includes('hunter')) {
      moodModifier = this.personality.currentMood.desperation * 0.2;
    }
    if (unitType === 'missionary') {
      moodModifier = this.personality.currentMood.zealotry * 0.3;
    }
    
    return Math.max(0, Math.min(1, priorityScore + moodModifier));
  }

  /**
   * Should AI consider retreat based on personality?
   */
  shouldRetreat(healthPercentage: number, advantage: number): boolean {
    const retreatThreshold = this.personality.retreatThreshold;
    const moodFactor = this.personality.currentMood.desperation * 0.2; // Desperation makes retreat less likely
    
    const adjustedThreshold = Math.max(0.1, retreatThreshold - moodFactor);
    
    return healthPercentage < adjustedThreshold || advantage < -0.5;
  }

  /**
   * Should AI attack based on personality?
   */
  shouldAttack(advantage: number, riskLevel: number): boolean {
    const attackThreshold = this.personality.attackThreshold;
    const aggressionBonus = this.personality.aggression * 0.3;
    const confidenceBonus = this.personality.currentMood.confidence * 0.2;
    const desperationBonus = this.personality.currentMood.desperation * 0.4;
    
    const adjustedThreshold = Math.max(0.1, 
      attackThreshold - aggressionBonus - confidenceBonus - desperationBonus
    );
    
    const riskTolerance = this.personality.riskTolerance;
    const riskAcceptable = riskLevel <= riskTolerance;
    
    return advantage >= adjustedThreshold && riskAcceptable;
  }

  /**
   * Get faction-specific flavor text for AI actions
   */
  getActionFlavor(actionType: string): string {
    const factionId = coerceFactionId(this.player.factionId) ?? 'NEPHITES';
    const faction = getFaction(factionId);
    const factionName = faction.name;
    
    const flavors: Record<string, string[]> = {
      attack: [
        `${factionName} warriors advance with righteous fury!`,
        `The ${factionName} strike with divine purpose!`,
        `${factionName} forces march to battle!`
      ],
      expand: [
        `${factionName} settlers seek new promised lands!`,
        `The ${factionName} expand their territory!`,
        `${factionName} claims new ground for their people!`
      ],
      tech: [
        `${factionName} scholars unlock ancient wisdom!`,
        `The ${factionName} advance their understanding!`,
        `${factionName} discovers new knowledge!`
      ]
    };
    
    const options = flavors[actionType] || [`The ${factionName} take action!`];
    return this.rng.choice(options);
  }

  // Helper methods

  private blendValues(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getMoodModifier(buildingType: string): number {
    const mood = this.personality.currentMood;
    
    if (buildingType === 'temple' || buildingType === 'monastery') {
      return mood.zealotry * 0.3;
    }
    if (buildingType === 'barracks' || buildingType === 'walls') {
      return mood.desperation * 0.2;
    }
    if (buildingType === 'market' || buildingType === 'granary') {
      return mood.pragmatism * 0.2;
    }
    
    return 0;
  }

  /**
   * Get current personality for debugging
   */
  getPersonality(): FactionPersonality {
    return { ...this.personality };
  }

  /**
   * Generate deterministic hash from string for seeding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash); // Ensure positive
  }
}
