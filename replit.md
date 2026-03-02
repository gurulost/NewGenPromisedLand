# Chronicles of the Promised Land - Development Guide

## Overview

Chronicles of the Promised Land is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. It features eight factions (Nephites, Lamanites, Mulekites, Anti-Nephi-Lehies, Zoramites, Jaredites, Hagoth's Mariners, and Amulonites) competing for dominance in ancient Americas through faith, warfare, and diplomacy. The project aims for AAA-quality UI/UX and deep strategic gameplay akin to Polytopia and Civilization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a modern full-stack monorepo architecture with a clear separation of concerns.

### Monorepo Structure
- `/client`: React frontend
- `/server`: Node.js backend
- `/shared`: Shared game logic, types, and utilities
- `/migrations`: Database migration files

### Frontend
- **Framework**: React 18 with TypeScript
- **3D Rendering**: Three.js with React Three Fiber for 2.5D hex-grid gameplay
- **State Management**: Zustand
- **Styling**: Tailwind CSS with Radix UI components
- **Build Tool**: Vite
- **UI/UX**: AAA-quality design with consistent golden/amber theming, professional primitives (PanelShell, GlowingButton), comprehensive accessibility, mobile responsiveness, and touch optimization. Features include cinematic menus, dynamic construction halls, detailed player HUDs, and an advanced InfoTooltip system.
- **Visuals**: Authentic Mesoamerican textures, optimized 3D models for terrain, units, and resources with automatic positioning. Animated cloud-like fog of war and Polytopia-style camera controls.

### Backend
- **Runtime**: Node.js with Express
- **Storage**: In-memory storage with an interface for future database integration.
- **Database**: Drizzle ORM for PostgreSQL (via Replit's built-in database).

### Multiplayer Operations
- **Required in production**
  - `DATABASE_URL`: PostgreSQL connection string (server fails startup if missing).
  - `SESSION_SECRET`: session signing secret (required when `NODE_ENV=production`).
- **Multiplayer runtime flags**
  - `MULTIPLAYER_TURN_RECOVERY` (default: `true`): enable host timeout recovery flow for disconnected remote turns.
  - `MULTIPLAYER_TURN_TIMEOUT_MS` (default: `90000`): inactivity threshold before host can force remote `END_TURN`.
  - `MULTIPLAYER_MAX_ACTION_BYTES` (default: `32768`): max serialized action payload size accepted by queue/commit endpoints.
  - `MULTIPLAYER_STRICT_RESYNC` (default: `true`): client strict sequential version checks + forced authoritative resync flow.
  - `VITE_MULTIPLAYER_STRICT_RESYNC` (default: `true`): client-side build-time override for strict resync behavior.
- **Cookie/session behavior**
  - Production sessions use `connect-pg-simple` with `createTableIfMissing: true`.
  - Session cookies use `secure: true` in production, so HTTPS + correct proxy forwarding are required.

### Core Game Mechanics
- **Data-Driven**: All game rules, including abilities, costs, and terrain effects, are centrally configured.
- **Game Logic**: Pure functions for movement, combat, pathfinding, and resource management within `/shared`.
- **Turn-Based System**: Local multiplayer (pass-and-play) with client-side game logic processing through a shared reducer.
- **Map Generation**: Procedural map generation with Polytopia-style terrain distribution, village spawning, and faction-specific homeland modifiers. Includes a unified scripture-themed resource system with moral choices.
- **Combat System**: Advanced combat calculations with unit-specific bonuses, formation tactics, terrain modifiers, and faith/pride bonuses.
- **Technology Tree**: Comprehensive technology tree with prerequisites, cost validation, and themed descriptions.
- **Unit System**: Comprehensive unit abilities (e.g., Worker construction, Scout stealth, Missionary healing) with visual indicators and status effects.
- **City Management**: Full-featured city panel for construction, unit recruitment, and resource generation.
- **Performance**: Instanced rendering for hex grid, React memoization, and optimized data processing.
- **Testing**: Extensive Vitest-based testing suite covering core game mechanics, UI components, and edge cases.

## External Dependencies

- **React Ecosystem**: React, React DOM, React Three Fiber, React Three Drei
- **3D Graphics**: Three.js
- **UI Components**: Radix UI
- **State Management**: Zustand
- **Database**: Drizzle ORM (for PostgreSQL with Replit's built-in database)
- **Build Tools**: Vite, TypeScript, ESBuild
- **Styling**: Tailwind CSS, PostCSS
- **Animation**: GSAP (for camera animations)
- **Gestures**: @use-gesture/react (for touch interactions)
- **Compression**: LZ-String (for save files)
