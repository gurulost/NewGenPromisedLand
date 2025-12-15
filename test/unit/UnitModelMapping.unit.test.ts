import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-three/drei', () => {
  const preload = vi.fn();
  const useGLTF = Object.assign(vi.fn(() => ({ scene: { clone: () => ({}) } })), { preload });
  return { useGLTF };
});

describe('Unit model mapping', () => {
  it('maps influence units to the missionary model', async () => {
    const { getUnitModelPath } = await import('../../client/src/utils/modelManager');
    expect(getUnitModelPath('priestcraft_preacher')).toBe('/models/missionary.glb');
    expect(getUnitModelPath('converted_missionary')).toBe('/models/missionary.glb');
    expect(getUnitModelPath('scribe_teacher')).toBe('/models/missionary.glb');
    expect(getUnitModelPath('prophet')).toBe('/models/missionary.glb');
  });
});

