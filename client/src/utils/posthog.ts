import posthog from 'posthog-js';
export { usePostHog } from '@posthog/react';

function isPostHogAvailable(): boolean {
  return posthog.__loaded;
}

export function identifyPlayer(playerId: string, properties?: Record<string, any>) {
  if (!isPostHogAvailable()) return;
  
  posthog.identify(playerId, properties);
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!isPostHogAvailable()) return;
  
  posthog.capture(eventName, properties);
}

export function trackGameLifecycle(event: 'game_started' | 'game_ended' | 'game_saved' | 'game_loaded', properties?: Record<string, any>) {
  trackEvent(event, {
    ...properties,
    timestamp: Date.now(),
  });
}

export function trackPlayerChoice(choiceType: string, choice: string, properties?: Record<string, any>) {
  trackEvent('player_choice', {
    choice_type: choiceType,
    choice_value: choice,
    ...properties,
  });
}

export function trackGameplayAction(
  action: 'unit_created' | 'unit_moved' | 'unit_attacked' | 'city_founded' | 'city_captured' | 'tech_researched' | 'building_constructed' | 'turn_ended',
  properties?: Record<string, any>
) {
  trackEvent('gameplay_action', {
    action_type: action,
    ...properties,
  });
}

export function trackCombatEvent(properties: {
  attacker_type: string;
  defender_type: string;
  attacker_damage: number;
  defender_damage: number;
  attacker_survived: boolean;
  defender_survived: boolean;
  terrain_type?: string;
}) {
  trackEvent('combat_event', properties);
}

export function trackPerformanceMetric(metric: {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  gamePhase?: string;
}) {
  trackEvent('performance_metric', {
    metric_name: metric.name,
    metric_value: metric.value,
    metric_rating: metric.rating,
    game_phase: metric.gamePhase,
  });
}

export function setGameContext(context: {
  gameId?: string;
  turn?: number;
  phase?: string;
  mapSize?: string;
  playerCount?: number;
  difficulty?: string;
  faction?: string;
}) {
  if (!isPostHogAvailable()) return;
  
  posthog.register(context);
}

export function clearGameContext() {
  if (!isPostHogAvailable()) return;
  
  posthog.unregister('gameId');
  posthog.unregister('turn');
  posthog.unregister('phase');
  posthog.unregister('mapSize');
  posthog.unregister('playerCount');
  posthog.unregister('difficulty');
  posthog.unregister('faction');
}

export function resetPlayer() {
  if (!isPostHogAvailable()) return;
  
  posthog.reset();
}

export { posthog };
