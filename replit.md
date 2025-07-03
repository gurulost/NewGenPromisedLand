# Chronicles of the Promised Land - Development Guide

## Overview

Chronicles of the Promised Land is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. The game features six distinct factions (Nephites, Lamanites, Mulekites, Anti-Nephi-Lehies, Zoramites, and Jaredites) competing for dominance in the ancient Americas through faith, warfare, and diplomacy.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **3D Rendering**: Three.js with React Three Fiber for 2.5D hex-grid gameplay
- **State Management**: Zustand for local game state management
- **Styling**: Tailwind CSS with Radix UI components for consistent design
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express framework
- **Development**: Hot module replacement via Vite integration
- **Storage**: In-memory storage with interface for future database integration
- **Database**: Drizzle ORM configured for PostgreSQL (via Neon)

### Monorepo Structure
```
/client          - React frontend application
/server          - Node.js backend server
/shared          - Shared game logic, types, and utilities
/migrations      - Database migration files
```

## Key Components

### Game Logic (`/shared`)
- **Types**: Comprehensive TypeScript definitions for game entities (units, factions, coordinates)
- **Data**: Static game data including faction definitions, unit stats, and abilities
- **Logic**: Pure functions for game mechanics (movement, combat, pathfinding)
- **Utils**: Hexagonal grid mathematics and coordinate conversion utilities

### Client-Side Components
- **Game Canvas**: Three.js rendering of the hex grid and game objects
- **UI System**: React components for menus, HUD, and game controls
- **State Stores**: Zustand stores for local multiplayer and game state management
- **Workers**: Web workers for computationally intensive pathfinding

### Server Components
- **API Routes**: RESTful endpoints (currently minimal, ready for expansion)
- **Storage Interface**: Abstract storage layer supporting both memory and database backends
- **Static Serving**: Vite middleware for development asset serving

## Data Flow

### Local Multiplayer (Pass-and-Play)
1. Players set up game through UI (faction selection, player names)
2. Game state initialized with hex map generation and starting positions
3. Turn-based gameplay with handoff screens between players
4. All game logic runs client-side using shared game reducer
5. Fog of war maintained per-player using visibility masks

### Game State Management
- **Central Store**: Zustand manages current game state
- **Action Dispatch**: Game actions processed through shared reducer
- **UI Updates**: React components subscribe to relevant state slices
- **Persistence**: Local storage for game saves (future feature)

## External Dependencies

### Core Libraries
- **React Ecosystem**: React, React DOM, React Three Fiber
- **3D Graphics**: Three.js, React Three Drei for helpers
- **UI Components**: Radix UI primitives with Tailwind styling
- **State Management**: Zustand for client state
- **Database**: Drizzle ORM with Neon serverless PostgreSQL
- **Build Tools**: Vite, TypeScript, ESBuild

### Development Tools
- **Type Checking**: TypeScript with strict configuration
- **Styling**: Tailwind CSS with PostCSS
- **Package Management**: npm with lockfile
- **Hot Reloading**: Vite dev server with HMR

## Deployment Strategy

### Development Environment
- Single command startup (`npm run dev`)
- Vite dev server with Express middleware
- Hot module replacement for rapid iteration
- TypeScript checking and error overlay

### Production Build
- Client assets built and optimized by Vite
- Server bundle created with ESBuild
- Static files served from `/dist/public`
- Environment variable configuration for database

### Database Management
- Drizzle migrations for schema changes
- Environment-based database URL configuration
- Push command for schema synchronization
- PostgreSQL dialect with Neon serverless

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- July 03, 2025: **Complete Test Suite Mastery**: Achieved 100% test success rate (97/97 tests passing) by fixing all remaining test failures including units requirements validation, research tech prerequisites, and hex coordinate utility functions - providing comprehensive automated validation of all core game mechanics
- July 02, 2025: **Hero Video Background System**: Implemented cinematic hero background with automatic video-to-image transition on main menu, featuring Book of Mormon themed visual assets, smooth fade transitions, and professional UI styling with backdrop blur effects for enhanced visual appeal
- July 02, 2025: **Flexible Map Size Selection**: Created completely flexible map size system allowing any player count (2-8) on any map size with helpful recommendations instead of restrictions, enhancing player choice and game accessibility 
- July 02, 2025: **Enhanced Fog of War System**: Implemented dynamic line-of-sight calculations with shadow casting algorithms, improved visual rendering for explored vs visible tiles, and proper unit visibility based on current line-of-sight rather than just explored status - creating realistic tactical visibility mechanics
- July 02, 2025: **Comprehensive Testing Framework**: Implemented Vitest testing infrastructure with 51 unit tests covering game rules, faction definitions, unit logic, game reducer, and coordinate utilities - providing automated regression prevention and code quality assurance for all core game mechanics
- July 02, 2025: **Complete Data-Driven Architecture**: Eradicated all hardcoded values throughout the codebase, replacing them with centralized GAME_RULES configuration including ability ranges, attack bonuses, resource costs, and healing amounts - creating a fully configurable strategy game engine ready for easy balance tweaking
- July 02, 2025: **Enhanced Type Safety**: Extended GameAction schema to include all diplomacy and city management actions (ESTABLISH_TRADE_ROUTE, DECLARE_WAR, FORM_ALLIANCE, CONVERT_CITY, UPGRADE_UNIT), eliminating TypeScript errors and strengthening type safety across the game logic system
- July 02, 2025: **Advanced GameReducer Expansion**: Implemented sophisticated faction-specific abilities (12 unique abilities across 6 factions), diplomacy mechanics (war declarations, alliances, trade routes), city conversion systems, and unit upgrade mechanics - transforming the gameReducer into a comprehensive strategy game engine
- July 02, 2025: **Comprehensive Performance Optimizations**: Added React memoization throughout UI components (PlayerHUD, SelectedUnitPanel, CombatPanel) with pre-calculated stats, optimized combat data processing, and maintained existing HexGridInstanced fog-of-war optimizations for maximum responsiveness
- July 02, 2025: **Code Cleanup & Type Safety**: Removed redundant HexGrid.tsx file (old non-performant implementation), resolved circular dependency issues with dedicated coordinates.ts file, completed strengthened Zod schemas eliminating all z.any() types
- July 02, 2025: **Tier 1 Critical Performance & Architecture Fixes**: Completed transition to instanced rendering (massive performance gain from hundreds to single draw call), eradicated hardcoded game rules with data-driven terrain/movement/vision systems, and verified city capture uses configurable GAME_RULES.capture settings
- July 02, 2025: **Ancient Typography System**: Implemented "Ancient Stone & Scroll" font pairing with Cinzel (headers/titles) and Source Sans 3 (body/UI) for authentic historical feel while maintaining perfect readability across all game components
- July 02, 2025: **Enhanced Game Storage System**: Implemented LZ-String compression for save files (60-80% size reduction), added game index management for listing saves, improved validation flow with decompression support, and explicit deletion with del() function
- July 02, 2025: **UI Architecture Refactoring**: Decomposed 400+ line GameUI mega-component into focused components (PlayerHUD, SelectedUnitPanel, CombatPanel, AbilitiesPanel) with memoized performance optimizations for combat calculations
- July 02, 2025: **Critical Performance & Architecture Fixes**: Removed require() statements from handleEndTurn function (major performance fix), implemented data-driven capture mechanics and terrain rules, fixed React hooks error in TechPanel
- July 02, 2025: **Data-Driven Game Rules**: Expanded gameRules.ts with configurable capture behavior (destroy/transfer structures/improvements), terrain passability rules, and movement cost system for easy game balance tweaking
- July 02, 2025: **Complete Turn 2-4 Systems**: Implemented building improvement/structure systems with terrain validation, city capture mechanics, unit recruitment, and enhanced star income generation from cities/improvements
- July 02, 2025: **City Management System**: Full-featured city panel with structure building, unit recruitment, and comprehensive validation including tech requirements, faction restrictions, and resource costs
- July 02, 2025: **Building & Construction**: Terrain-validated improvement placement (farms on plains, mines on mountains), city structure construction with economic effects, and enhanced resource generation system
- July 02, 2025: **Tech Research System**: Complete working technology system with 9 techs, prerequisite validation, cost scaling, and responsive UI panel fixed from infinite re-render bug

## Changelog

- July 02, 2025: Initial setup