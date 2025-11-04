# Chronicles of the Promised Land - Development Guide

## Overview

Chronicles of the Promised Land is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. The game features six distinct factions (Nephites, Lamanites, Mulekites, Anti-Nephi-Lehies, Zoramites, and Jaredites) competing for dominance in the ancient Americas through faith, warfare, and diplomacy. The project aims to provide a rich, immersive strategy experience with strong thematic elements and high-quality visual and mechanical implementation, matching AAA industry standards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack monorepo architecture with clear separation between client and server components, emphasizing performance, modularity, and maintainability.

### UI/UX Decisions
- **Visual Theme**: Unified "Book of Mormon golden/amber" theming with authentic Mesoamerican textures and scripture-themed world elements.
- **Design Principles**: AAA-quality visual design with consistent component primitives (PanelShell, PanelHeader, GlowingButton, HUDShell, AvatarBadge), responsive design patterns, perfect viewport safety, touch optimization (44px+ targets), reduced motion support, and comprehensive accessibility (keyboard navigation, tooltips).
- **Camera Control**: Polytopia-style fixed isometric view (45 degrees angle) with disabled rotation, responsive panning, zooming with map-size based limits, and smooth centering animations.
- **Fog of War**: Three-tiered system (Unexplored, Explored, Visible) with stunning animated cloud graphics and dynamic line-of-sight calculations.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Three.js and React Three Fiber for 2.5D hex-grid rendering. Zustand for state management. Tailwind CSS with Radix UI for styling. Vite for build.
- **Backend**: Node.js with Express. In-memory storage with an interface for future database integration. Drizzle ORM configured for PostgreSQL (via Neon).
- **Monorepo Structure**: `/client` (React frontend), `/server` (Node.js backend), `/shared` (shared game logic, types, utilities), `/migrations` (database migration files).
- **Game Logic**: Pure functions for core mechanics (movement, combat, pathfinding) residing in `/shared`. Web workers are used for computationally intensive tasks like pathfinding.
- **State Management**: Centralized Zustand store for game state, action dispatching through a shared reducer, and local storage for future game saves.
- **Data-Driven Architecture**: All game rules, abilities, costs, and configurations are centralized in `GAME_RULES` for easy balance tweaking and configurability.
- **Performance Optimizations**: Instanced rendering for hex grid, React memoization for UI components, optimized combat data processing, and efficient asset management (e.g., removal of large unused terrain models).
- **3D Model System**: Comprehensive system for units, cities, villages, and resources with automatic grounding, ownership-based material effects, status indicators, and health bars.
- **Error Handling**: GLTFErrorBoundary prevents crashes from missing/invalid 3D models by rendering fallback geometries. Uses resetKey prop for recovery when model paths change. Note: Does not auto-retry transient failures on the same model path (future enhancement).
- **Error Logging & Monitoring**: Production-grade error tracking with Sentry (client-side), Pino structured logging (server-side), Core Web Vitals performance monitoring, automatic breadcrumb tracking, correlation IDs for request tracing, and comprehensive error categorization (game_logic, rendering, ui, network, critical). See `docs/ERROR_LOGGING.md` for setup and usage.
- **Core Game Systems**:
    - **Combat**: Advanced calculations with unit-specific bonuses, formation tactics, terrain modifiers, faith/pride bonuses, siege warfare, and ranged bombardment.
    - **Resource Management**: Scripture-themed unified world elements (Grain Patch, Wild Goats, Timber Grove, Ore Vein) with moral choices (Faith/Pride/Dissent).
    - **Technology Tree**: Comprehensive system with dynamic UI, research logic, prerequisite validation, and technology gating.
    - **Unit Abilities**: Comprehensive unit abilities for each type (Worker, Scout, Spearman, etc.) with game state integration, visual indicators, and resource costs.
    - **Map Generation**: Procedural map generation with authentic Polytopia specifications (terrain distribution, resource spawning, village density, tribal homeland biases).
    - **City Management**: Full-featured city panel with structure building, unit recruitment, and economic effects.
    - **Save System**: LZ-String compression for save files, game index management, and validation.

## External Dependencies

- **Frontend**: React, React DOM, React Three Fiber, Three.js, React Three Drei, Radix UI, Zustand, Tailwind CSS.
- **Backend**: Node.js, Express, Drizzle ORM, Neon (for PostgreSQL).
- **Build/Dev Tools**: Vite, TypeScript, ESBuild, npm, Vitest.
- **Testing**: Vitest (unit and accessibility tests), Playwright (E2E tests), Testing Library (React component testing), vitest-axe (accessibility testing).
- **Monitoring & Logging**: Sentry (error tracking), Pino (structured logging), web-vitals (performance monitoring).
- **Other Libraries**: GSAP (for animations), @use-gesture/react (for touch gestures).

## Testing Infrastructure

The project has comprehensive test coverage across unit tests, accessibility tests, and end-to-end tests.

### Test Suites

- **Unit Tests** (`test/unit`): Component and logic tests using Vitest and Testing Library. Run with `npx vitest run test/unit`.
- **Accessibility Tests** (`test/a11y`): WCAG compliance tests using vitest-axe. All 10 tests passing. Run with `npx vitest run test/a11y`.
- **E2E Tests** (`test/e2e`): End-to-end browser tests using Playwright. Tests game workflows, modal interactions, and user journeys across multiple browsers (Chromium, Firefox, WebKit) and viewports. Run with `npx playwright test test/e2e`.

### Playwright Configuration

- **Config file**: `playwright.config.ts`
- **Test directory**: `test/e2e`
- **Browsers**: Chromium (default for development), Firefox, WebKit, mobile viewports (Pixel 5, iPhone 12, iPad Pro)
- **Base URL**: `http://localhost:5000`
- **Auto-start server**: Configured to run `npm run dev` before tests
- **Setup**: Install browsers with `npx playwright install chromium` (or `--with-deps` for all system dependencies)

### Test Development

- Unit tests use official Zustand mocking with `vi.importActual` to preserve React integration
- Accessibility tests include getComputedStyle polyfill for jsdom compatibility
- E2E tests use data-testid attributes for reliable element selection
- All stores automatically reset between tests for isolation