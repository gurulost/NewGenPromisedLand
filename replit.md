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

- July 02, 2025: **Performance-Optimized Pathfinding**: Replaced O(n log n) array sorting with O(log n) priority queue and O(1) Map lookups for massive performance gains in unit movement
- July 02, 2025: **Strategic Fog of War**: Implemented three-tier visibility system (unexplored/explored/current vision) where enemy units only visible in current 2-tile vision range
- July 02, 2025: **Advanced Combat System**: Added faction-specific combat bonuses, attack damage calculations, and combat UI with enemy targeting
- July 02, 2025: **Faction Abilities**: Implemented Title of Liberty, Rameumptom, and Covenant of Peace abilities with stat modifications
- July 02, 2025: **Enhanced Map Generation**: Perlin noise terrain generation with strategic resource placement and balanced city distribution
- July 02, 2025: **Architectural Improvements**: Separated map generation, added Zod validation for save/load, and comprehensive vision utilities

## Changelog

- July 02, 2025: Initial setup