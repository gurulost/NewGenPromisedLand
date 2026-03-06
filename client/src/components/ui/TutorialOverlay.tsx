import React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { ModalLayer, ModalLayerContent } from '../primitives/ModalLayer';
import { useTutorialStore } from '../../lib/stores/useTutorial';
import { getTutorialCard } from '../../lib/tutorial/tutorialCards';

export function TutorialOverlay() {
  const activeCardId = useTutorialStore((state) => state.activeCardId);
  const closeCard = useTutorialStore((state) => state.closeCard);
  const markSeen = useTutorialStore((state) => state.markSeen);
  const dismissForGame = useTutorialStore((state) => state.dismissForGame);
  const openLibrary = useTutorialStore((state) => state.openLibrary);
  const clearQueue = useTutorialStore((state) => state.clearQueue);
  const skipTutorialForGame = useTutorialStore((state) => state.skipTutorialForGame);

  const card = getTutorialCard(activeCardId);

  const handleClose = React.useCallback(() => {
    if (!card) return;
    dismissForGame(card.id);
    closeCard();
  }, [card, dismissForGame, closeCard]);

  const handleGotIt = React.useCallback(() => {
    if (!card) return;
    markSeen(card.id);
    closeCard();
  }, [card, markSeen, closeCard]);

  React.useEffect(() => {
    if (!card) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [card, handleClose]);

  if (!card) return null;

  const isOverview = card.id === 'overview';

  return (
    <ModalLayer
      data-testid="tutorial-overlay-dialog"
      className="fixed inset-0 z-[var(--z-tutorial)] pointer-events-auto flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <ModalLayerContent
        className="relative w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-amber-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close tutorial"
          data-testid="tutorial-overlay-close"
          className="absolute right-4 top-4 rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200 transition hover:bg-amber-500/20 hover:text-amber-100"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300/70">
              Tutorial
            </div>
            <h2 className="mt-2 font-cinzel text-2xl text-amber-100">
              {card.title}
            </h2>
            <p className="mt-3 text-sm text-amber-200/80 italic">
              {card.lore}
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-900/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300/70">
              Core Ideas
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-100/90">
              {card.bullets.map((bullet, index) => (
                <li key={`${card.id}-bullet-${index}`}>{bullet}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">
              Try It Now
            </div>
            <p className="mt-2 text-sm text-emerald-100/90">
              {card.tryIt}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-amber-200 hover:text-amber-100"
              onClick={() => {
                clearQueue();
                openLibrary();
                handleClose();
              }}
            >
              View All Guides
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col items-start gap-1">
                <Button
                  variant={isOverview ? 'destructive' : 'outline'}
                  className={cn(
                    isOverview
                      ? 'border-red-400/60 bg-red-600/90 px-5 py-3 text-sm font-semibold text-red-50 hover:bg-red-500'
                      : 'border-red-500/40 text-red-200 hover:bg-red-500/10'
                  )}
                  onClick={() => {
                    skipTutorialForGame();
                  }}
                >
                  Skip Tutorial
                </Button>
                {isOverview && (
                  <span className="text-[11px] text-red-200/70">
                    Skips pop-ups for this game only. Help icons stay available.
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                data-testid="tutorial-overlay-open-later"
                className="border-amber-500/40 text-amber-100 hover:bg-amber-500/20"
                onClick={handleClose}
              >
                Open Later
              </Button>
              <Button
                data-testid="tutorial-overlay-primary-action"
                className="bg-amber-600 text-amber-50 hover:bg-amber-500"
                onClick={handleGotIt}
              >
                {card.primaryActionLabel ?? 'Got It'}
              </Button>
            </div>
          </div>
        </div>
      </ModalLayerContent>
    </ModalLayer>
  );
}

export default TutorialOverlay;
