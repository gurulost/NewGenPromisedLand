import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-three/drei', () => {
  const preload = vi.fn();
  const useGLTF = Object.assign(vi.fn(() => ({ scene: { clone: () => ({}) } })), { preload });
  return { useGLTF };
});

describe('Unit model mapping', () => {
  it('maps influence units to their specific models', async () => {
    const { getUnitModelPath } = await import('../../client/src/utils/modelManager');
    expect(getUnitModelPath('missionary')).toBe('/models/missionary.glb');
    expect(getUnitModelPath('priestcraft_preacher')).toBe('/models/priestcraft_preacher.glb');
    expect(getUnitModelPath('converted_missionary')).toBe('/models/converted_missionary.glb');
    expect(getUnitModelPath('scribe_teacher')).toBe('/models/scribe_teacher.glb');
    expect(getUnitModelPath('prophet')).toBe('/models/prophet.glb');
  });
});
