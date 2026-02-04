import React from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTutorialStore } from '../../lib/stores/useTutorial';
import type { TutorialCardId } from '../../lib/tutorial/tutorialCards';

interface TutorialHelpIconProps {
  cardId: TutorialCardId;
  label?: string;
  className?: string;
  iconClassName?: string;
}

export function TutorialHelpIcon({
  cardId,
  label = 'Open tutorial help',
  className,
  iconClassName,
}: TutorialHelpIconProps) {
  const openCard = useTutorialStore((state) => state.openCard);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        openCard(cardId);
      }}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 transition hover:bg-amber-500/20 hover:text-amber-100',
        className
      )}
    >
      <CircleHelp className={cn('h-4 w-4', iconClassName)} />
    </button>
  );
}

export default TutorialHelpIcon;
