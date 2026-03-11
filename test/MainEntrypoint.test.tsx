import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const renderSpy = vi.fn();
const createRootSpy = vi.fn(() => ({ render: renderSpy }));
const initTelemetrySpy = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: createRootSpy,
}));

vi.mock('../client/src/App', () => ({
  default: () => <div data-testid="app-root">App</div>,
}));

vi.mock('../client/src/utils/telemetry', () => ({
  initTelemetry: initTelemetrySpy,
}));

vi.mock('../client/src/components/ui/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toast-provider">{children}</div>
  ),
}));

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    createRootSpy.mockClear();
    renderSpy.mockClear();
    initTelemetrySpy.mockClear();
    cleanup();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('wraps the app in ToastProvider before rendering', async () => {
    await import('../client/src/main');

    expect(initTelemetrySpy).toHaveBeenCalledTimes(1);
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderSpy).toHaveBeenCalledTimes(1);

    render(renderSpy.mock.calls[0][0]);

    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('app-root')).toBeInTheDocument();
  });
});
