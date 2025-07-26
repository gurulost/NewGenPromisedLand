import React from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';

interface HoverCardProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  className?: string;
}

export function HoverCard({
  trigger,
  content,
  side = 'bottom',
  align = 'center',
  sideOffset = 4,
  className
}: HoverCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <HoverCardPrimitive.Root openDelay={200} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        {trigger}
      </HoverCardPrimitive.Trigger>
      
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={clsx(
            "z-50 w-64 rounded-lg border border-amber-500/30 bg-slate-900/95 p-4 text-sm shadow-xl backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
        >
          <div className="text-amber-100">
            {content}
          </div>
          
          <HoverCardPrimitive.Arrow className="fill-slate-900" />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}