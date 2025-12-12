// @ts-nocheck
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';

export interface WebVitalsReport {
  metric: Metric;
  sessionId: string;
  gamePhase?: string;
}

type WebVitalsCallback = (report: WebVitalsReport) => void;

let sessionId: string = '';
let gamePhase: string = 'menu';
const callbacks: WebVitalsCallback[] = [];

export function initWebVitals(config?: { sessionId?: string; onReport?: WebVitalsCallback }) {
  sessionId = config?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (config?.onReport) {
    callbacks.push(config.onReport);
  }

  const reportMetric = (metric: Metric) => {
    const report: WebVitalsReport = {
      metric,
      sessionId,
      gamePhase,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${metric.name}:`, {
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
      });
    }

    // Call all registered callbacks
    callbacks.forEach((callback) => {
      try {
        callback(report);
      } catch (error) {
        console.error('[Web Vitals] Error in callback:', error);
      }
    });
  };

  // Core Web Vitals
  onCLS(reportMetric); // Cumulative Layout Shift
  onINP(reportMetric); // Interaction to Next Paint
  onLCP(reportMetric); // Largest Contentful Paint

  // Other important metrics
  onFCP(reportMetric); // First Contentful Paint
  onTTFB(reportMetric); // Time to First Byte
}

export function updateGamePhase(phase: string) {
  gamePhase = phase;
}

export function registerWebVitalsCallback(callback: WebVitalsCallback) {
  callbacks.push(callback);
  return () => {
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  };
}

export function getThresholds() {
  return {
    CLS: { good: 0.1, needsImprovement: 0.25 },
    INP: { good: 200, needsImprovement: 500 },
    LCP: { good: 2500, needsImprovement: 4000 },
    FCP: { good: 1800, needsImprovement: 3000 },
    TTFB: { good: 800, needsImprovement: 1800 },
  };
}
