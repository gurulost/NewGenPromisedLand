import path from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('vite', () => ({
  defineConfig: (config: unknown) => config,
}));

vi.mock('@vitejs/plugin-react', () => ({
  default: () => ({ name: 'mock-react' }),
}));

vi.mock('@replit/vite-plugin-runtime-error-modal', () => ({
  default: () => ({ name: 'mock-runtime-error-overlay' }),
}));

vi.mock('vite-plugin-glsl', () => ({
  default: () => ({ name: 'mock-glsl' }),
}));

describe('public asset copy filtering', () => {
  const publicDir = path.resolve('/repo/client/public');

  it('excludes orphan model assets from production public copy', async () => {
    const { shouldCopyPublicAsset } = await import('../../vite.config');

    expect(shouldCopyPublicAsset(publicDir, path.join(publicDir, 'models/_orphans'))).toBe(false);
    expect(shouldCopyPublicAsset(publicDir, path.join(publicDir, 'models/_orphans/scout.glb'))).toBe(false);
  });

  it('keeps normal public assets self-contained', async () => {
    const { shouldCopyPublicAsset } = await import('../../vite.config');

    expect(shouldCopyPublicAsset(publicDir, path.join(publicDir, 'models/warrior.glb'))).toBe(true);
    expect(shouldCopyPublicAsset(publicDir, path.join(publicDir, 'textures/grass.png'))).toBe(true);
  });
});
