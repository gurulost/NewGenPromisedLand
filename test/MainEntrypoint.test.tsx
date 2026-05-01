import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const renderSpy = vi.fn();
const createRootSpy = vi.fn(() => ({ render: renderSpy }));
const initTelemetrySpy = vi.fn();
type TestIdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
let pendingIdleCallback: TestIdleCallback | null = null;
const requestIdleCallbackSpy = vi.fn((callback: TestIdleCallback) => {
  pendingIdleCallback = callback;
  return 1;
});

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
    pendingIdleCallback = null;
    requestIdleCallbackSpy.mockClear();
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: requestIdleCallbackSpy,
    });
    cleanup();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('wraps the app in ToastProvider before deferred telemetry initialization', async () => {
    await import('../client/src/main');

    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(requestIdleCallbackSpy).toHaveBeenCalledTimes(1);
    expect(initTelemetrySpy).not.toHaveBeenCalled();

    render(renderSpy.mock.calls[0][0]);

    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
    expect(screen.getByTestId('app-root')).toBeInTheDocument();

    expect(pendingIdleCallback).toEqual(expect.any(Function));
    pendingIdleCallback?.({ didTimeout: false, timeRemaining: () => 50 });
    await vi.waitFor(() => expect(initTelemetrySpy).toHaveBeenCalledTimes(1));
  });
});
