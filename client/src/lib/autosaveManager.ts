import type { GameState } from '@shared/types/game';
import { saveAutosave } from './autosaveStorage';
import { useAutosaveStatus } from './stores/useAutosaveStatus';

let pendingState: GameState | null = null;
let flushing = false;

function getTurn(state: GameState): number {
  return typeof state.turn === 'number' ? state.turn : 1;
}

export function markAutosaveDirty(): void {
  useAutosaveStatus.getState().markDirty();
}

export function requestAutosave(state: GameState, _reason: string): void {
  if (!state || state.phase !== 'playing') return;

  pendingState = state;
  void flushPending();
}

export function requestAutosaveIfDirty(state: GameState, reason: string): void {
  if (!state || state.phase !== 'playing') return;
  const { dirty } = useAutosaveStatus.getState();
  if (!dirty) return;
  requestAutosave(state, reason);
}

async function flushPending(): Promise<void> {
  if (flushing) return;
  if (!pendingState) return;

  flushing = true;
  try {
    while (pendingState) {
      const stateToSave = pendingState;
      pendingState = null;

      useAutosaveStatus.getState().markSaveStart();

      try {
        await saveAutosave(stateToSave);
        useAutosaveStatus.getState().markSaveSuccess(getTurn(stateToSave));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown autosave error';
        useAutosaveStatus.getState().markSaveFailure('save_failed', message);
        // Don’t loop forever if saving fails (quota/private mode/etc).
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

