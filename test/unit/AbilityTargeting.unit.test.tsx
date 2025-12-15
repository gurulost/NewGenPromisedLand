import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityTargetOverlay } from '../../client/src/components/ui/AbilityTargetOverlay';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

const sampleUnits = [
  {
    id: 'unit-1',
    type: 'warrior',
    hp: 25,
    maxHp: 25,
    movement: 3,
    remainingMovement: 3,
    coordinate: { q: 0, r: 0, s: 0 },
  },
  {
    id: 'unit-2',
    type: 'scout',
    hp: 18,
    maxHp: 20,
    movement: 4,
    remainingMovement: 2,
    coordinate: { q: 1, r: 0, s: -1 },
  },
] as any;

describe('AbilityTargetOverlay', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AbilityTargetOverlay
        isOpen={false}
        title="Target"
        instructions="Pick a unit"
        units={sampleUnits}
        onSelectUnit={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('allows selecting a unit and confirming', async () => {
    const user = userEvent.setup();
    const onSelectUnit = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AbilityTargetOverlay
        isOpen
        title="Divine Ward"
        instructions="Pick a unit"
        units={sampleUnits}
        selectedUnitId={null}
        onSelectUnit={onSelectUnit}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Divine Ward')).toBeInTheDocument();
    expect(screen.getByText('Pick a unit')).toBeInTheDocument();

    await user.click(screen.getAllByText('Select')[0]);
    expect(onSelectUnit).toHaveBeenCalledWith('unit-1');

    expect(screen.getByRole('button', { name: 'Select a Unit' })).toBeDisabled();
  });

  it('enables confirm when a unit is selected', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <AbilityTargetOverlay
        isOpen
        title="Divine Ward"
        instructions="Pick a unit"
        units={sampleUnits}
        selectedUnitId="unit-2"
        onSelectUnit={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm Target' });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

