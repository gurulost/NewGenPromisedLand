import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
})) as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Mock performance.now
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
  },
});

// Mock Three.js objects for 3D testing
vi.mock('three', () => ({
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  })),
  Scene: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
  })),
  Group: vi.fn(() => ({
    position: { set: vi.fn() },
    traverse: vi.fn(),
    clone: vi.fn(function () { return this; }),
  })),
  PerspectiveCamera: vi.fn(() => ({
    position: { set: vi.fn() },
    lookAt: vi.fn(),
  })),
  Mesh: vi.fn(),
  BoxGeometry: vi.fn(),
  CylinderGeometry: vi.fn(() => ({
    rotateY: vi.fn(),
  })),
  Matrix4: vi.fn(() => ({
    setPosition: vi.fn(),
  })),
  Box3: vi.fn(() => ({
    min: { y: 0 },
    setFromObject: vi.fn().mockReturnThis(),
  })),
  ShaderMaterial: vi.fn((params: any = {}) => ({
    uniforms: params.uniforms ?? {},
    ...params,
  })),
  Color: vi.fn(),
  Vector2: vi.fn(() => ({
    set: vi.fn(),
  })),
  Vector3: vi.fn(() => ({
    normalize: vi.fn().mockReturnThis(),
  })),
  InstancedBufferAttribute: vi.fn(),
  TextureLoader: vi.fn(),
  DoubleSide: 0,
  AdditiveBlending: 1,
  MeshBasicMaterial: vi.fn(),
}));

// Mock Zustand store with minimal API parity for hooks that use getState/setState
vi.mock('zustand', () => {
  const create = vi.fn((initializer) => {
    let state: any;
    const listeners = new Set<() => void>();

    const setState = (partial: any) => {
      const nextState = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener());
    };

    const getState = () => state;
    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    const api = { setState, getState, subscribe, destroy: vi.fn() };
    state = initializer(setState, getState, api);

    const useStore = (selector?: (slice: any) => any) => (
      selector ? selector(state) : state
    );
    Object.assign(useStore, api);
    return useStore;
  });

  return { create };
});

// Mock Headless UI (Dialog/Transition) to avoid focus-trap timers and portal side effects in tests
vi.mock('@headlessui/react', () => {
  const Fragment = React.Fragment;
  const Transition: any = ({ show = true, children }: any) =>
    show ? React.createElement(Fragment, null, children) : null;
  Transition.Child = ({ children }: any) => React.createElement(Fragment, null, children);

  const Dialog: any = ({ as: Comp = 'div', children, ...props }: any) =>
    React.createElement(Comp, { ...props, role: props.role ?? 'dialog' }, children);

  return { Dialog, Transition };
});

// Mock framer-motion to prevent infinite RAF loops during tests
vi.mock('framer-motion', () => {
  const stripMotionProps = (props: any) => {
    if (!props) return props;
    // Avoid forwarding motion-only props to the DOM
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { animate, initial, exit, transition, whileHover, whileTap, layout, layoutId, ...rest } = props;
    return rest;
  };

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = React.forwardRef<any, any>(({ children, ...props }, ref) =>
          React.createElement(tag, { ...stripMotionProps(props), ref }, children),
        );
        Component.displayName = `motion.${tag}`;
        return Component;
      },
    },
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock toast context to avoid provider requirements in component tests
vi.mock('../client/src/components/ui/ToastProvider', () => ({
  ToastProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
  useToastContext: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    combat: vi.fn(),
    discovery: vi.fn(),
    faith: vi.fn(),
    pride: vi.fn(),
    removeToast: vi.fn(),
  }),
}));
