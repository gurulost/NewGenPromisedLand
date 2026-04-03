import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

import { useUIPreferences } from '../../hooks/useUIPreferences';

interface InfoTooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
}

export function InfoTooltip({ content, children }: InfoTooltipProps) {
  const { preferences } = useUIPreferences();

  if (!preferences.showTooltips) {
    return children ? <>{children}</> : null;
  }

  return (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children || (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500/80 rounded-full flex items-center justify-center text-xs text-white cursor-help">
              ?
            </div>
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-xs rounded-lg bg-slate-800 p-3 text-sm text-amber-100 shadow-lg border border-amber-500/20"
            sideOffset={5}
          >
            {content}
            <Tooltip.Arrow className="fill-slate-800" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
