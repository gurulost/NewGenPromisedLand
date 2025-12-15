import { create } from 'zustand';

export type AutosaveFailureReason =
  | 'save_failed'
  | 'invalid_state'
  | 'load_failed';

export interface AutosaveStatusState {
  isSaving: boolean;
  dirty: boolean;
  lastSuccessAt: number | null;
  lastSuccessTurn: number | null;
  lastFailureAt: number | null;
  lastFailureReason: AutosaveFailureReason | null;
  lastErrorMessage: string | null;

  markDirty: () => void;
  markSaveStart: () => void;
  markSaveSuccess: (turn: number) => void;
  markSaveFailure: (reason: AutosaveFailureReason, message?: string) => void;
  clearFailure: () => void;
}

export const useAutosaveStatus = create<AutosaveStatusState>((set) => ({
  isSaving: false,
  dirty: false,
  lastSuccessAt: null,
  lastSuccessTurn: null,
  lastFailureAt: null,
  lastFailureReason: null,
  lastErrorMessage: null,

  markDirty: () => set({ dirty: true }),
  markSaveStart: () => set({ isSaving: true }),
  markSaveSuccess: (turn) =>
    set({
      isSaving: false,
      dirty: false,
      lastSuccessAt: Date.now(),
      lastSuccessTurn: turn,
      lastFailureAt: null,
      lastFailureReason: null,
      lastErrorMessage: null,
    }),
  markSaveFailure: (reason, message) =>
    set({
      isSaving: false,
      lastFailureAt: Date.now(),
      lastFailureReason: reason,
      lastErrorMessage: message ?? null,
    }),
  clearFailure: () =>
    set({
      lastFailureAt: null,
      lastFailureReason: null,
      lastErrorMessage: null,
    }),
}));

