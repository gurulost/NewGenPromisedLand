/**
 * AI Diplomacy Engine
 * Handles alliance formation, relationship tracking, and diplomatic decisions
 */

import { GameState, PlayerState } from '../types/game';
import { hexDistance } from '../utils/hex';

export type DiplomaticStatus = 'neutral' | 'friendly' | 'hostile' | 'allied' | 'at_war';

export interface DiplomaticRelationship {
    playerId: string;
    relationScore: number;  // -100 (war) to +100 (ally)
    status: DiplomaticStatus;
    turnsAtWar: number;
    turnsAllied: number;
    hasCommonEnemy: boolean;
    relativeMilitaryStrength: number; // < 1 = weaker, > 1 = stronger
}

export interface AllianceProposal {
    type: 'PROPOSE_ALLIANCE' | 'ACCEPT_ALLIANCE' | 'BREAK_ALLIANCE' | 'DECLARE_WAR';
    targetPlayerId: string;
    priority: number;
    reason: string;
}

/**
 * AI Diplomacy Engine
 * Tracks relationships and makes alliance decisions
 */
export class AIDiplomacyEngine {
    private gameState: GameState;
    private aiPlayer: PlayerState;
    private relationships: Map<string, DiplomaticRelationship>;

    constructor(gameState: GameState, aiPlayer: PlayerState) {
        this.gameState = gameState;
        this.aiPlayer = aiPlayer;
        this.relationships = new Map();
        this.initializeRelationships();
    }

    /**
     * Initialize relationship scores with all other players
     */
    private initializeRelationships(): void {
        for (const player of this.gameState.players) {
            if (player.id === this.aiPlayer.id) continue;
            if (player.isEliminated) continue;

            const relationship = this.calculateRelationship(player);
            this.relationships.set(player.id, relationship);
        }
    }

    /**
     * Calculate relationship metrics with another player
     */
    private calculateRelationship(otherPlayer: PlayerState): DiplomaticRelationship {
        let relationScore = 0;

        // Factor 1: Faction alignment (same victory goals = more friendly)
        const sameVictoryPotential = this.calculateVictoryAlignmentScore(otherPlayer);
        relationScore += sameVictoryPotential;

        // Factor 2: Military strength comparison
        const relativeMilitary = this.calculateRelativeMilitaryStrength(otherPlayer);

        // Factor 3: Proximity (closer neighbors = more friction OR alliance value)
        const proximityFactor = this.calculateProximityFactor(otherPlayer);
        relationScore += proximityFactor;

        // Factor 4: Common enemies
        const hasCommonEnemy = this.hasCommonEnemy(otherPlayer);
        if (hasCommonEnemy) {
            relationScore += 20; // Bonus for common threats
        }

        // Factor 5: Faith/Pride alignment
        const faithAlignment = this.calculateFaithAlignment(otherPlayer);
        relationScore += faithAlignment;

        return {
            playerId: otherPlayer.id,
            relationScore,
            status: this.scoreToStatus(relationScore),
            turnsAtWar: 0,
            turnsAllied: 0,
            hasCommonEnemy,
            relativeMilitaryStrength: relativeMilitary,
        };
    }

    /**
     * Get diplomatic actions for this turn
     */
    public getDiplomaticActions(): AllianceProposal[] {
        const proposals: AllianceProposal[] = [];

        for (const [playerId, relationship] of Array.from(this.relationships.entries())) {
            // Should we propose alliance?
            if (this.shouldProposeAlliance(relationship)) {
                proposals.push({
                    type: 'PROPOSE_ALLIANCE',
                    targetPlayerId: playerId,
                    priority: 60 + relationship.relationScore / 2,
                    reason: this.getAllianceReason(relationship),
                });
            }

            // Should we break alliance?
            if (relationship.status === 'allied' && this.shouldBreakAlliance(relationship)) {
                proposals.push({
                    type: 'BREAK_ALLIANCE',
                    targetPlayerId: playerId,
                    priority: 50,
                    reason: 'Alliance no longer beneficial',
                });
            }

            // Should we declare war?
            if (this.shouldDeclareWar(relationship)) {
                proposals.push({
                    type: 'DECLARE_WAR',
                    targetPlayerId: playerId,
                    priority: 70 + Math.abs(relationship.relationScore) / 2,
                    reason: 'Strategic opportunity or threat elimination',
                });
            }
        }

        return proposals.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Evaluate if AI should propose alliance
     */
    private shouldProposeAlliance(rel: DiplomaticRelationship): boolean {
        if (rel.status === 'allied' || rel.status === 'at_war') return false;

        // Favorable conditions for alliance:
        // 1. We're weaker and have common enemy
        // 2. They have complementary strengths
        // 3. Relationship score is positive

        const isWeaker = rel.relativeMilitaryStrength > 1.2;
        const hasThreat = rel.hasCommonEnemy;
        const friendlyRelation = rel.relationScore > 20;

        return (isWeaker && hasThreat) || (friendlyRelation && rel.relationScore > 40);
    }

    /**
     * Evaluate if AI should break an alliance
     */
    private shouldBreakAlliance(rel: DiplomaticRelationship): boolean {
        // Break if:
        // 1. We're now much stronger
        // 2. No more common enemies
        // 3. They're in the way of victory

        const muchStronger = rel.relativeMilitaryStrength < 0.5;
        const noThreat = !rel.hasCommonEnemy;
        const rivalForVictory = this.isRivalForVictory(rel.playerId);

        return (muchStronger && noThreat && rivalForVictory);
    }

    /**
     * Evaluate if AI should declare war
     */
    private shouldDeclareWar(rel: DiplomaticRelationship): boolean {
        if (rel.status === 'allied' || rel.status === 'at_war') return false;

        // Declare war if:
        // 1. Much stronger and they're blocking expansion
        // 2. Very negative relationship
        // 3. Strategic resource control needed

        const muchStronger = rel.relativeMilitaryStrength < 0.6;
        const veryHostile = rel.relationScore < -50;

        return muchStronger && veryHostile;
    }

    /**
     * Get explanation for alliance proposal
     */
    private getAllianceReason(rel: DiplomaticRelationship): string {
        if (rel.hasCommonEnemy) return 'Common enemy threatens us both';
        if (rel.relativeMilitaryStrength > 1.2) return 'Your strength complements ours';
        return 'Our peoples share similar values';
    }

    // Helper calculations

    private calculateVictoryAlignmentScore(other: PlayerState): number {
        // Compare faction types for compatibility
        const myFaith = this.aiPlayer.stats.faith;
        const theirFaith = other.stats.faith;
        const faithDiff = Math.abs(myFaith - theirFaith);

        // Similar faith values = potential allies
        return Math.max(-20, 20 - faithDiff * 0.2);
    }

    private calculateRelativeMilitaryStrength(other: PlayerState): number {
        const myUnits = this.gameState.units.filter(u => u.playerId === this.aiPlayer.id);
        const theirUnits = this.gameState.units.filter(u => u.playerId === other.id);

        const myStrength = myUnits.reduce((sum, u) => sum + (u.hp || 10), 0);
        const theirStrength = theirUnits.reduce((sum, u) => sum + (u.hp || 10), 0);

        return theirStrength / Math.max(1, myStrength);
    }

    private calculateProximityFactor(other: PlayerState): number {
        const myCities = this.gameState.cities.filter(c => c.ownerId === this.aiPlayer.id);
        const theirCities = this.gameState.cities.filter(c => c.ownerId === other.id);

        if (myCities.length === 0 || theirCities.length === 0) return 0;

        // Find closest cities
        let minDistance = Infinity;
        for (const myCity of myCities) {
            for (const theirCity of theirCities) {
                const dist = hexDistance(myCity.coordinate, theirCity.coordinate);
                minDistance = Math.min(minDistance, dist);
            }
        }

        // Close neighbors: could be threat or ally
        // Distant: less relevant
        if (minDistance <= 3) return -10; // Too close, potential conflict
        if (minDistance <= 6) return 5;    // Good alliance distance
        return 0; // Too far to matter
    }

    private hasCommonEnemy(other: PlayerState): boolean {
        // Check if any third player is hostile to both
        for (const player of this.gameState.players) {
            if (player.id === this.aiPlayer.id || player.id === other.id) continue;
            if (player.isEliminated) continue;

            // If this player is attacking both of us, common enemy
            const attackingUs = this.gameState.units.some(u =>
                u.playerId === player.id && this.isUnitsNearby(player.id, this.aiPlayer.id)
            );
            const attackingThem = this.gameState.units.some(u =>
                u.playerId === player.id && this.isUnitsNearby(player.id, other.id)
            );

            if (attackingUs && attackingThem) return true;
        }
        return false;
    }

    private isUnitsNearby(attackerId: string, targetId: string): boolean {
        const attackerUnits = this.gameState.units.filter(u => u.playerId === attackerId);
        const targetCities = this.gameState.cities.filter(c => c.ownerId === targetId);

        for (const unit of attackerUnits) {
            for (const city of targetCities) {
                if (hexDistance(unit.coordinate, city.coordinate) <= 4) {
                    return true;
                }
            }
        }
        return false;
    }

    private calculateFaithAlignment(other: PlayerState): number {
        const faithDiff = this.aiPlayer.stats.faith - other.stats.faith;
        const prideDiff = this.aiPlayer.stats.pride - other.stats.pride;

        // Similar priorities = friendship
        if (Math.abs(faithDiff) < 20 && Math.abs(prideDiff) < 20) {
            return 15;
        }
        // Opposite priorities = tension
        if (Math.abs(faithDiff) > 50) {
            return -15;
        }
        return 0;
    }

    private scoreToStatus(score: number): DiplomaticStatus {
        if (score >= 60) return 'allied';
        if (score >= 20) return 'friendly';
        if (score <= -50) return 'at_war';
        if (score <= -20) return 'hostile';
        return 'neutral';
    }

    private isRivalForVictory(playerId: string): boolean {
        const them = this.gameState.players.find(p => p.id === playerId);
        if (!them) return false;

        // Check if they're leading in cities/techs
        const theirCities = this.gameState.cities.filter(c => c.ownerId === playerId).length;
        const myCities = this.gameState.cities.filter(c => c.ownerId === this.aiPlayer.id).length;

        return theirCities >= myCities;
    }

    /**
     * Evaluate incoming alliance proposal
     */
    public evaluateAllianceProposal(proposerId: string): boolean {
        const relationship = this.relationships.get(proposerId);
        if (!relationship) return false;

        // Accept if:
        // 1. We're weaker and they're offering protection
        // 2. Common enemy exists
        // 3. Positive relationship

        const benefitsUs = relationship.relativeMilitaryStrength > 0.8 || relationship.hasCommonEnemy;
        const notHostile = relationship.relationScore > -10;

        return benefitsUs && notHostile;
    }
}
