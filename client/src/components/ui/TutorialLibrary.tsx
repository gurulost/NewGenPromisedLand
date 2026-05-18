import React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { ModalLayer, ModalLayerContent } from '../primitives/ModalLayer';
import { useTutorialStore } from '../../lib/stores/useTutorial';
import { TUTORIAL_CARD_ORDER, TUTORIAL_CARDS } from '../../lib/tutorial/tutorialCards';

export function TutorialLibrary() {
  const isOpen = useTutorialStore((state) => state.isLibraryOpen);
  const blockingSuppressionReason = useTutorialStore((state) => state.blockingSuppressionReason);
  const closeLibrary = useTutorialStore((state) => state.closeLibrary);
  const openCard = useTutorialStore((state) => state.openCard);
  const skipTutorialForGame = useTutorialStore((state) => state.skipTutorialForGame);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (blockingSuppressionReason || !isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLibrary();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blockingSuppressionReason, closeLibrary, isOpen]);

  if (blockingSuppressionReason || !isOpen) return null;

  return (
    <ModalLayer
      data-testid="tutorial-library-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-[var(--z-tutorial)] pointer-events-auto flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={closeLibrary}
    >
      <ModalLayerContent
        className="relative w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-amber-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close tutorial library"
          className="absolute right-4 top-4 rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200 transition hover:bg-amber-500/20 hover:text-amber-100"
          onClick={closeLibrary}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300/70">Reference</div>
            <h2 id={titleId} className="mt-2 font-cinzel text-2xl text-amber-100">Tutorial Guides</h2>
            <p id={descriptionId} className="mt-2 text-sm text-amber-200/80">
              Reopen any tutorial card at any time.
            </p>
          </div>

          <div className="space-y-3">
            {TUTORIAL_CARD_ORDER.map((cardId) => {
              const card = TUTORIAL_CARDS[cardId];
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    closeLibrary();
                    openCard(card.id);
                  }}
                  className="w-full rounded-xl border border-amber-500/20 bg-slate-900/60 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-slate-900"
                >
                  <div className="font-cinzel text-lg text-amber-100">{card.title}</div>
                  <div className="mt-1 text-sm text-amber-200/70">{card.summary}</div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="border-red-500/40 text-red-200 hover:bg-red-500/10"
                onClick={() => {
                  skipTutorialForGame();
                  closeLibrary();
                }}
              >
                Skip Tutorials For This Game
              </Button>
              <Button
                variant="outline"
                className="border-amber-500/40 text-amber-100 hover:bg-amber-500/20"
                onClick={closeLibrary}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </ModalLayerContent>
    </ModalLayer>
  );
}

export default TutorialLibrary;
