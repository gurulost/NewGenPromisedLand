import React from 'react';

/**
 * Comprehensive Error Reporting and Debugging System
 * Inspired by client-side monitoring services but tailored for our game
 */

interface GameError {
  id: string;
  timestamp: number;
  type: 'game_logic' | 'rendering' | 'ui' | 'network' | 'critical';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  stack?: string;
  context: {
    gameState?: any;
    playerAction?: string;
    component?: string;
    userAgent: string;
    url: string;
    gamePhase?: string;
    currentPlayer?: string;
  };
  userActions: UserAction[];
}

interface UserAction {
  timestamp: number;
  type: 'click' | 'move_unit' | 'attack' | 'end_turn' | 'select_unit' | 'page_load';
  details: any;
  coordinate?: { q: number; r: number; s: number };
}

class GameErrorReporter {
  private errors: GameError[] = [];
  private userActions: UserAction[] = [];
  private maxActionsHistory = 50;
  private maxErrorHistory = 100;

  constructor() {
    this.setupGlobalErrorHandlers();
    this.recordUserAction('page_load', { url: window.location.href });
  }

  /**
   * Set up automatic error capture for unhandled errors
   */
  private setupGlobalErrorHandlers() {
    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        type: 'critical',
        severity: 'error',
        message: event.message,
        stack: event.error?.stack,
        context: {
          component: 'Global',
          userAgent: navigator.userAgent,
          url: window.location.href,
        }
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        type: 'critical',
        severity: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: {
          component: 'Promise',
          userAgent: navigator.userAgent,
          url: window.location.href,
        }
      });
    });
  }

  /**
   * Record user actions for debugging context
   */
  recordUserAction(type: UserAction['type'], details: any, coordinate?: { q: number; r: number; s: number }) {
    const action: UserAction = {
      timestamp: Date.now(),
      type,
      details,
      coordinate
    };

    this.userActions.push(action);
    
    // Keep only recent actions
    if (this.userActions.length > this.maxActionsHistory) {
      this.userActions = this.userActions.slice(-this.maxActionsHistory);
    }

    console.log('🎯 User action:', action);
  }

  /**
   * Report game-specific errors with rich context
   */
  reportError(errorData: Partial<GameError> & { type: GameError['type']; severity: GameError['severity']; message: string }) {
    const error: GameError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...errorData,
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...errorData.context
      },
      userActions: [...this.userActions] // Copy current action history
    };

    this.errors.push(error);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory);
    }

    // Log to console with appropriate severity
    const logMethod = error.severity === 'critical' ? 'error' : 
                     error.severity === 'error' ? 'error' :
                     error.severity === 'warning' ? 'warn' : 'info';
    
    console[logMethod]('🚨 Game Error:', error);

    // For critical errors, show user-friendly notification
    if (error.severity === 'critical') {
      this.showCriticalErrorDialog(error);
    }

    return error.id;
  }

  /**
   * Report game logic errors with game state context
   */
  reportGameLogicError(message: string, gameState?: any, playerAction?: string) {
    return this.reportError({
      type: 'game_logic',
      severity: 'error',
      message,
      context: {
        gameState: this.sanitizeGameState(gameState),
        playerAction,
        gamePhase: gameState?.phase,
        currentPlayer: gameState?.players?.[gameState?.currentPlayerIndex]?.name
      }
    });
  }

  /**
   * Report Three.js rendering errors
   */
  reportRenderingError(message: string, component?: string, stack?: string) {
    return this.reportError({
      type: 'rendering',
      severity: 'error',
      message,
      stack,
      context: {
        component: component || 'Unknown3DComponent'
      }
    });
  }

  /**
   * Report unit movement/action errors
   */
  reportUnitActionError(message: string, unitId: string, coordinate: { q: number; r: number; s: number }, gameState?: any) {
    return this.reportError({
      type: 'game_logic',
      severity: 'warning',
      message: `Unit Action Error: ${message}`,
      context: {
        gameState: this.sanitizeGameState(gameState),
        playerAction: `unit_action_${unitId}`,
        component: 'UnitLogic'
      }
    });
  }

  /**
   * Show critical error dialog to user
   */
  private showCriticalErrorDialog(error: GameError) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1f2937;
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 10000;
      max-width: 500px;
      font-family: 'Source Sans 3', sans-serif;
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 10px 0; color: #ef4444;">Game Error Occurred</h3>
      <p style="margin: 0 0 15px 0;">An error occurred that may affect gameplay. The error has been logged for debugging.</p>
      <details style="margin: 10px 0;">
        <summary style="cursor: pointer;">Technical Details</summary>
        <pre style="background: #374151; padding: 10px; border-radius: 4px; overflow: auto; margin: 10px 0; font-size: 12px;">${error.message}</pre>
      </details>
      <button onclick="this.parentElement.remove()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Continue Playing
      </button>
    `;
    
    document.body.appendChild(dialog);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (dialog.parentElement) {
        dialog.remove();
      }
    }, 10000);
  }

  /**
   * Get debug report for development
   */
  getDebugReport() {
    return {
      errors: this.errors,
      recentActions: this.userActions.slice(-10),
      summary: {
        totalErrors: this.errors.length,
        criticalErrors: this.errors.filter(e => e.severity === 'critical').length,
        gameLogicErrors: this.errors.filter(e => e.type === 'game_logic').length,
        renderingErrors: this.errors.filter(e => e.type === 'rendering').length,
      }
    };
  }

  /**
   * Sanitize game state for logging (remove sensitive data, limit size)
   */
  private sanitizeGameState(gameState: any) {
    if (!gameState) return null;
    
    try {
      return {
        phase: gameState.phase,
        currentPlayerIndex: gameState.currentPlayerIndex,
        turn: gameState.turn,
        playerCount: gameState.players?.length,
        unitCount: gameState.units?.length,
        mapSize: `${gameState.map?.width}x${gameState.map?.height}`
      };
    } catch {
      return { error: 'Failed to sanitize game state' };
    }
  }

  /**
   * Export error data for support
   */
  exportErrorData() {
    const data = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...this.getDebugReport()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-debug-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Global instance
export const gameErrorReporter = new GameErrorReporter();

// React Error Boundary component
export class GameErrorBoundary extends React.Component<
  { children: React.ReactNode; component?: string },
  { hasError: boolean; errorId?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = gameErrorReporter.reportError({
      type: 'ui',
      severity: 'error',
      message: error.message,
      stack: error.stack,
      context: {
        component: this.props.component || 'ReactComponent',
        errorInfo: errorInfo.componentStack
      }
    });
    
    this.setState({ errorId });
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', { 
        style: { 
          padding: '20px', 
          background: '#fee2e2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px',
          margin: '10px'
        }
      }, [
        React.createElement('h3', { 
          key: 'title',
          style: { color: '#dc2626', margin: '0 0 10px 0' }
        }, 'Component Error'),
        React.createElement('p', { key: 'message' }, 
          `A component failed to render. Error ID: ${this.state.errorId}`
        ),
        React.createElement('button', { 
          key: 'button',
          onClick: () => this.setState({ hasError: false }),
          style: {
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }
        }, 'Try Again')
      ]);
    }

    return this.props.children;
  }
}

// Hook for easy error reporting in components
export function useGameErrorReporter() {
  return {
    reportError: (message: string, type: GameError['type'] = 'ui', severity: GameError['severity'] = 'error') => 
      gameErrorReporter.reportError({ type, severity, message }),
    recordAction: (type: UserAction['type'], details: any, coordinate?: { q: number; r: number; s: number }) => 
      gameErrorReporter.recordUserAction(type, details, coordinate),
    getDebugReport: () => gameErrorReporter.getDebugReport(),
    exportData: () => gameErrorReporter.exportErrorData()
  };
}

export default gameErrorReporter;