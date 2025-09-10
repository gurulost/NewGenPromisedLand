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
- **Other Libraries**: GSAP (for animations), @use-gesture/react (for touch gestures).