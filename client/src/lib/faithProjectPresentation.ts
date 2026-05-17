import type { ToastType } from '../components/ui/VisualFeedback';

const FAITH_PRESENTATION_ACTIONS = new Set([
  'FAITH_PROJECT_STARTED',
  'FAITH_PROJECT_PROGRESS',
  'FAITH_PROJECT_PAUSED',
  'FAITH_PROJECT_INTERRUPTED',
  'FAITH_PROJECT_COMPLETED',
  'FAITH_LOSS_SHOCK',
]);

export function isFaithProjectPresentationAction(actionType: string): boolean {
  return FAITH_PRESENTATION_ACTIONS.has(actionType);
}

type FaithPresentationAction = { type: string; payload?: Record<string, unknown> };

export function getFaithProjectPresentation(action: FaithPresentationAction, actorName?: string) {
  const payload = action.payload || {};
  const progress = typeof payload.progress === 'number' ? payload.progress : '?';
  const required = typeof payload.requiredProgress === 'number' ? payload.requiredProgress : '?';
  const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
  const faithLoss = typeof payload.faithLoss === 'number' ? payload.faithLoss : 0;

  switch (action.type) {
    case 'FAITH_PROJECT_STARTED':
      return {
        flash: 'blue' as const,
        toast: { message: 'Consecration begun', type: 'info' as ToastType },
        logMessage: 'Started the Consecration project',
      };
    case 'FAITH_PROJECT_COMPLETED':
      return {
        flash: 'blue' as const,
        toast: { message: `${actorName ?? 'A rival'} completed Consecration`, type: 'info' as ToastType, public: true },
        logMessage: 'Completed the Consecration project',
      };
    case 'FAITH_PROJECT_INTERRUPTED':
      return {
        flash: 'red' as const,
        toast: { message: `Faith Project failed: ${reason ?? 'requirements were lost'}`, type: 'warning' as ToastType },
        logMessage: `Faith Project interrupted: ${reason ?? 'requirements were lost'}`,
      };
    case 'FAITH_PROJECT_PAUSED':
      return {
        toast: { message: `Faith Project paused: ${reason ?? 'requirements unmet'}`, type: 'warning' as ToastType },
        logMessage: `Faith Project paused: ${reason ?? 'requirements unmet'}`,
      };
    case 'FAITH_PROJECT_PROGRESS':
      return {
        flash: 'blue' as const,
        toast: { message: `Consecration progress ${progress}/${required}`, type: 'info' as ToastType },
        logMessage: `Faith Project progress ${progress}/${required}`,
      };
    case 'FAITH_LOSS_SHOCK':
      return {
        flash: 'red' as const,
        toast: { message: `Faith -${faithLoss}: ${reason ?? 'loss shock'}`, type: 'warning' as ToastType },
        logMessage: `Faith loss shock: -${faithLoss}`,
      };
    default:
      return {
        flash: 'blue' as const,
        toast: { message: 'Faith Project updated', type: 'info' as ToastType },
        logMessage: 'Faith Project updated',
      };
  }
}
