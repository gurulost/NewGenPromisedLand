declare module 'posthog-js';
declare module '@posthog/react';
declare module '@sentry/react';
declare module 'web-vitals';
declare module 'pino';
declare module 'howler' {
  export class Howl {
    constructor(options: any);
    play(): void;
    volume(v: number): void;
  }
}
