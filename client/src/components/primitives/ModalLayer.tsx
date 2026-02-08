import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface ModalLayerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export function ModalLayer({
  asChild = false,
  className,
  role = 'dialog',
  ...props
}: ModalLayerProps) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      data-ui-layer="modal"
      role={role}
      aria-modal="true"
      className={cn('pointer-events-auto', className)}
      {...props}
    />
  );
}

export function ModalLayerContent({
  asChild = false,
  className,
  ...props
}: ModalLayerProps) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      data-ui-layer="modal-content"
      className={className}
      {...props}
    />
  );
}

