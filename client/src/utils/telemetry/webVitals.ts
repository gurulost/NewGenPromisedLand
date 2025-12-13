import { capture } from './posthog';

type Metric = {
  name: string;
  value: number;
  id: string;
  label: 'web-vital' | 'custom';
};

export async function reportWebVitals() {
  try {
    const { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } = await import('web-vitals');
    const handler = (metric: Metric) => {
      capture('web_vital', {
        name: metric.name,
        value: metric.value,
        id: metric.id,
      });
    };
    onCLS(handler);
    onFID(handler);
    onLCP(handler);
    onFCP(handler);
    onTTFB(handler);
    onINP?.(handler as any);
  } catch (error) {
    console.warn('Web Vitals unavailable:', error);
  }
}
