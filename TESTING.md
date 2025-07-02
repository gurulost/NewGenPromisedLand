# Testing Framework Documentation

## Overview

Chronicles of the Promised Land uses Vitest as its primary testing framework, providing comprehensive test coverage for the game logic, data structures, and utility functions.

## Test Structure

### Configuration
- **Test Framework**: Vitest with JSdom environment
- **Configuration File**: `vitest.config.ts`
- **Setup File**: `test/setup.ts`
- **Test Location**: `shared/**/*.{test,spec}.{ts,tsx}`

### Test Categories

#### 1. Data Layer Tests (`shared/data/`)
- **Game Rules Tests** (`gameRules.test.ts`): Validates GAME_RULES configuration and helper functions
- **Faction Tests** (`factions.test.ts`): Ensures faction definitions are complete and valid
- **Unit Tests** (`units.test.ts`): Verifies unit definitions, stats, and availability

#### 2. Logic Layer Tests (`shared/logic/`)
- **Game Reducer Tests** (`gameReducer.test.ts`): Core game state mutations and action handling
- **Unit Logic Tests** (`unitLogic.test.ts`): Movement, combat, and visibility calculations

#### 3. Utility Tests (`shared/utils/`)
- **Hex Coordinates Tests** (`hexCoordinates.test.ts`): Hexagonal grid mathematics and conversions

## Test Coverage Areas

### ✅ Successfully Tested
1. **Game Rules Configuration**
   - All configuration sections present
   - Positive values for resources and stats
   - Valid terrain and ability settings

2. **Faction System**
   - All six factions defined with complete data
   - Unique colors and abilities
   - Proper faction structure validation

3. **Unit Definitions**
   - Complete stat definitions for all unit types
   - Reasonable stat ranges
   - Proper faction availability

### 🔧 Areas Needing Refinement
1. **Unit Movement Logic**
   - Pathfinding algorithm validation
   - Terrain passability rules
   - Movement range calculations

2. **Combat System**
   - Attack range validation
   - Damage calculation accuracy
   - Unit elimination logic

3. **Vision System**
   - Line of sight calculations
   - Fog of war mechanics
   - Unit visibility rules

## Running Tests

### Basic Commands
```bash
# Run all tests
npx vitest run --config vitest.config.ts

# Run tests in watch mode
npx vitest --config vitest.config.ts

# Run with UI (if available)
npx vitest --ui --config vitest.config.ts

# Run specific test file
npx vitest run shared/data/gameRules.test.ts
```

### Test Results Summary
- **Total Test Files**: 5
- **Passing Tests**: 38/51 (75%)
- **Test Categories**: Data validation, logic verification, utility functions

## Benefits of Testing Framework

### 1. **Regression Prevention**
- Catches breaking changes during refactoring
- Validates data-driven configuration changes
- Ensures game mechanics remain consistent

### 2. **Code Quality Assurance**
- Validates edge cases in game logic
- Ensures proper error handling
- Maintains type safety compliance

### 3. **Development Confidence**
- Safe refactoring with immediate feedback
- Validates new feature implementations
- Documents expected behavior

### 4. **Performance Monitoring**
- Identifies slow algorithms
- Validates optimization improvements
- Tracks computational complexity

## Test Development Guidelines

### Writing New Tests
1. **Follow the AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Test Names**: Clearly state what is being tested
3. **Test Edge Cases**: Include boundary conditions and error scenarios
4. **Mock External Dependencies**: Isolate units under test
5. **Keep Tests Independent**: Each test should run in isolation

### Test File Organization
```
shared/
├── data/
│   ├── gameRules.test.ts      # Configuration validation
│   ├── factions.test.ts       # Faction data integrity
│   └── units.test.ts          # Unit definition validation
├── logic/
│   ├── gameReducer.test.ts    # Core game state logic
│   └── unitLogic.test.ts      # Movement and combat logic
└── utils/
    └── hexCoordinates.test.ts # Mathematical utilities
```

## Future Testing Enhancements

### Planned Improvements
1. **Integration Tests**: Test complete game scenarios
2. **Performance Tests**: Benchmark critical algorithms
3. **Visual Tests**: Validate UI component rendering
4. **E2E Tests**: Full gameplay scenario validation

### Coverage Goals
- **Target Coverage**: 90%+ for game logic
- **Critical Path Testing**: 100% coverage for core mechanics
- **Edge Case Testing**: Comprehensive boundary condition validation

## Debugging Failed Tests

### Common Issues
1. **Type Mismatches**: Update type definitions when interfaces change
2. **Mock Data**: Ensure test data matches actual data structures
3. **Async Operations**: Handle promises and timing correctly
4. **State Mutations**: Verify immutability in state updates

### Debugging Strategies
1. Use descriptive test names for easy identification
2. Add console.log statements for complex calculations
3. Run individual tests to isolate issues
4. Check type definitions for recent changes

## Impact on Development

The testing framework provides a solid foundation for:
- **Safe Refactoring**: Confidence when optimizing code
- **Feature Development**: Validation of new implementations
- **Bug Prevention**: Early detection of logic errors
- **Documentation**: Tests serve as executable specifications

This testing infrastructure significantly improves code quality and development velocity while ensuring the game mechanics remain robust and reliable.