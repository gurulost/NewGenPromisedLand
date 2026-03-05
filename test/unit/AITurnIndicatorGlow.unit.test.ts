import { describe, expect, it } from 'vitest';
import {
  INDICATOR_VARIANTS,
  buildGlowBoxShadowFrames,
} from '../../client/src/components/ui/AITurnIndicator';

describe('AITurnIndicator glow animation metadata', () => {
  it('uses valid CSS colors for glow keyframes and never Tailwind tokens', () => {
    const tailwindColorTokenPattern = /\b[a-z]+-\d{3}\b/;

    for (const variant of INDICATOR_VARIANTS) {
      expect(variant.glowShadowClass).toMatch(/^shadow-[a-z]+-\d{3}(?:\/\d{2,3})?$/);
      expect(variant.glowCssColor).toMatch(/^rgba\(/);

      const keyframes = buildGlowBoxShadowFrames(variant.glowCssColor);
      expect(keyframes).toHaveLength(3);

      keyframes.forEach((keyframe) => {
        expect(keyframe).toContain(variant.glowCssColor);
        expect(keyframe).not.toMatch(tailwindColorTokenPattern);
      });
    }
  });
});
