import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';

describe('ToastProvider fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('../client/src/components/ui/ToastProvider');
    delete (window as typeof window & { __ngplToastContext?: unknown }).__ngplToastContext;
  });

  afterEach(() => {
    delete (window as typeof window & { __ngplToastContext?: unknown }).__ngplToastContext;
  });

  it('returns the window-backed toast API when React context is unavailable', async () => {
    const toastApi = {
      success: vi.fn(() => 'success-id'),
      error: vi.fn(() => 'error-id'),
      warning: vi.fn(() => 'warning-id'),
      info: vi.fn(() => 'info-id'),
      combat: vi.fn(() => 'combat-id'),
      discovery: vi.fn(() => 'discovery-id'),
      faith: vi.fn(() => 'faith-id'),
      pride: vi.fn(() => 'pride-id'),
      removeToast: vi.fn(),
    };
    (window as typeof window & { __ngplToastContext?: typeof toastApi }).__ngplToastContext = toastApi;

    const { useToastContext } = await import('../client/src/components/ui/ToastProvider');

    let resolved: typeof toastApi | null = null;
    function Consumer() {
      resolved = useToastContext() as typeof toastApi;
      return <div>ok</div>;
    }

    render(<Consumer />);

    expect(resolved).toBe(toastApi);
  });
});
