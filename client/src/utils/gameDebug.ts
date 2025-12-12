/**
 * Comprehensive game debugging and error reporting system
 * Inspired by professional monitoring services but tailored for our strategy game
 */

interface DebugInfo {
  timestamp: number;
  type: 'unit' | 'visibility' | 'rendering' | 'action' | 'performance' | 'game_logic' | 'ui_interaction';
  message: string;
  data?: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  sessionId: string;
}

interface GameSession {
  sessionId: string;
  startTime: number;
  userAgent: string;
  gameVersion: string;
  totalActions: number;
  gamePhases: string[];
  errors: number;
  warnings: number;
}

class GameDebugger {
  private logs: DebugInfo[] = [];
  private maxLogs = 200;
  private session: GameSession;
  private performanceMarks: Map<string, number> = new Map();

  constructor() {
    this.session = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      userAgent: navigator.userAgent,
      gameVersion: '1.0.0', // Could read from package.json
      totalActions: 0,
      gamePhases: [],
      errors: 0,
      warnings: 0
    };

    // Set up automatic error capture
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers() {
    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
      this.log('game_logic', `Unhandled error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }, 'error');
    });

    // Capture promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log('game_logic', `Unhandled promise rejection: ${event.reason}`, {
        reason: event.reason
      }, 'error');
    });

    // Track page visibility changes (user switching tabs)
    document.addEventListener('visibilitychange', () => {
      this.log('ui_interaction', `Tab visibility: ${document.hidden ? 'hidden' : 'visible'}`, {
        hidden: document.hidden
      }, 'info');
    });
  }

  log(type: DebugInfo['type'], message: string, data?: any, severity: DebugInfo['severity'] = 'info') {
    const entry: DebugInfo = {
      timestamp: Date.now(),
      type,
      message,
      data,
      severity,
      sessionId: this.session.sessionId
    };

    this.logs.push(entry);
    this.session.totalActions++;
    
    // Update session stats
    if (severity === 'error' || severity === 'critical') {
      this.session.errors++;
    } else if (severity === 'warning') {
      this.session.warnings++;
    }
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Enhanced console logging with severity colors
    const emoji = type === 'unit' ? '🎮' : 
                  type === 'visibility' ? '👁️' : 
                  type === 'rendering' ? '🎨' : 
                  type === 'performance' ? '⚡' :
                  type === 'game_logic' ? '🧠' :
                  type === 'ui_interaction' ? '🖱️' : '📝';
    
    const severityStyle = severity === 'error' || severity === 'critical' ? 'color: red; font-weight: bold;' :
                         severity === 'warning' ? 'color: orange; font-weight: bold;' :
                         'color: default;';
    
    console.log(`%c${emoji} [${type}] ${severity.toUpperCase()}`, severityStyle, message, data || '');

    // For critical errors, also show a user notification
    if (severity === 'critical') {
      this.showCriticalErrorNotification(message);
    }
  }

  // Performance monitoring
  startPerformanceMark(label: string) {
    this.performanceMarks.set(label, performance.now());
  }

  endPerformanceMark(label: string, thresholdMs: number = 100) {
    const startTime = this.performanceMarks.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      const severity = duration > thresholdMs ? 'warning' : 'info';
      this.log('performance', `${label} completed in ${duration.toFixed(2)}ms`, {
        duration,
        threshold: thresholdMs,
        exceeded: duration > thresholdMs
      }, severity);
      this.performanceMarks.delete(label);
    }
  }

  // Game phase tracking
  trackGamePhase(phase: string) {
    if (!this.session.gamePhases.includes(phase)) {
      this.session.gamePhases.push(phase);
    }
    this.log('ui_interaction', `Game phase changed to: ${phase}`, { phase }, 'info');
  }

  // Critical error notification
  private showCriticalErrorNotification(message: string) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: 'Source Sans 3', sans-serif;
      max-width: 300px;
      border-left: 4px solid #b91c1c;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">⚠️</span>
        <div>
          <div style="font-weight: bold; margin-bottom: 4px;">Critical Error</div>
          <div style="font-size: 14px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  logUnit(message: string, unit?: any, severity: DebugInfo['severity'] = 'info') {
    this.log('unit', message, unit ? {
      id: unit.id,
      type: unit.type,
      playerId: unit.playerId,
      coordinate: unit.coordinate,
      hp: unit.hp,
      visible: unit.visible
    } : undefined, severity);
  }

  logVisibility(message: string, data?: any, severity: DebugInfo['severity'] = 'info') {
    this.log('visibility', message, data, severity);
  }

  logRendering(message: string, data?: any, severity: DebugInfo['severity'] = 'info') {
    this.log('rendering', message, data, severity);
  }

  logAction(message: string, data?: any, severity: DebugInfo['severity'] = 'info') {
    this.log('action', message, data, severity);
  }

  logGameLogic(message: string, data?: any, severity: DebugInfo['severity'] = 'info') {
    this.log('game_logic', message, data, severity);
  }

  logUIInteraction(message: string, data?: any, severity: DebugInfo['severity'] = 'info') {
    this.log('ui_interaction', message, data, severity);
  }

  getDebugSummary() {
    const recent = this.logs.slice(-20);
    const sessionDuration = Date.now() - this.session.startTime;
    
    return {
      session: {
        ...this.session,
        duration: sessionDuration,
        durationFormatted: this.formatDuration(sessionDuration)
      },
      totalLogs: this.logs.length,
      recentLogs: recent,
      errorCounts: {
        units: this.logs.filter(l => l.type === 'unit').length,
        visibility: this.logs.filter(l => l.type === 'visibility').length,
        rendering: this.logs.filter(l => l.type === 'rendering').length,
        actions: this.logs.filter(l => l.type === 'action').length,
        performance: this.logs.filter(l => l.type === 'performance').length,
        game_logic: this.logs.filter(l => l.type === 'game_logic').length,
        ui_interaction: this.logs.filter(l => l.type === 'ui_interaction').length
      },
      severityCounts: {
        info: this.logs.filter(l => l.severity === 'info').length,
        warning: this.logs.filter(l => l.severity === 'warning').length,
        error: this.logs.filter(l => l.severity === 'error').length,
        critical: this.logs.filter(l => l.severity === 'critical').length
      },
      performanceIssues: this.logs.filter(l => l.type === 'performance' && l.severity === 'warning').length
    };
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Advanced error context capture
  captureGameStateSnapshot(gameState: any) {
    return {
      phase: gameState?.phase,
      currentPlayerIndex: gameState?.currentPlayerIndex,
      turn: gameState?.turn,
      playerCount: gameState?.players?.length,
      unitCount: gameState?.units?.length,
      mapSize: gameState?.map ? `${gameState.map.width}x${gameState.map.height}` : 'unknown',
      timestamp: Date.now()
    };
  }

  // Create error report for support
  generateErrorReport() {
    const summary = this.getDebugSummary();
    const errors = this.logs.filter(l => l.severity === 'error' || l.severity === 'critical');
    
    return {
      reportId: `report_${Date.now()}`,
      timestamp: new Date().toISOString(),
      session: summary.session,
      summary: {
        totalLogs: summary.totalLogs,
        errorCounts: summary.errorCounts,
        severityCounts: summary.severityCounts,
        performanceIssues: summary.performanceIssues
      },
      criticalErrors: errors,
      recentActivity: summary.recentLogs,
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth
        },
        memory: (performance as any).memory ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
        } : 'unavailable'
      }
    };
  }

  exportLogs() {
    const summary = this.getDebugSummary();
    
    console.group('🎮 Game Debug Export');
    console.log('Session Info:', summary.session);
    console.log('Error Counts:', summary.errorCounts);
    console.log('Severity Counts:', summary.severityCounts);
    console.table(summary.recentLogs);
    console.groupEnd();
    
    return summary;
  }

  // Export detailed error report for support
  exportErrorReport() {
    const report = this.generateErrorReport();
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-error-report-${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('📋 Error report exported:', report.reportId);
    return report;
  }

  clear() {
    this.logs = [];
    this.session.totalActions = 0;
    this.session.errors = 0;
    this.session.warnings = 0;
    console.log('🧹 Debug logs cleared');
  }
}

export const gameDebugger = new GameDebugger();

// Enhanced hook for comprehensive debugging
export function useGameDebugger() {
  return {
    // Basic logging methods
    logUnit: (message: string, unit?: any, severity?: DebugInfo['severity']) => 
      gameDebugger.logUnit(message, unit, severity),
    logVisibility: (message: string, data?: any, severity?: DebugInfo['severity']) => 
      gameDebugger.logVisibility(message, data, severity),
    logRendering: (message: string, data?: any, severity?: DebugInfo['severity']) => 
      gameDebugger.logRendering(message, data, severity),
    logAction: (message: string, data?: any, severity?: DebugInfo['severity']) => 
      gameDebugger.logAction(message, data, severity),
    logGameLogic: (message: string, data?: any, severity?: DebugInfo['severity']) => 
      gameDebugger.logGameLogic(message, data, severity),
    logUIInteraction: (message: string, data?: any, severity?: DebugInfo['severity']) => 
      gameDebugger.logUIInteraction(message, data, severity),
    
    // Performance monitoring
    startPerformanceMark: (label: string) => gameDebugger.startPerformanceMark(label),
    endPerformanceMark: (label: string, threshold?: number) => 
      gameDebugger.endPerformanceMark(label, threshold),
    
    // Game phase tracking
    trackGamePhase: (phase: string) => gameDebugger.trackGamePhase(phase),
    
    // Advanced reporting
    captureGameState: (gameState: any) => gameDebugger.captureGameStateSnapshot(gameState),
    exportLogs: () => gameDebugger.exportLogs(),
    exportErrorReport: () => gameDebugger.exportErrorReport(),
    getDebugSummary: () => gameDebugger.getDebugSummary(),
    clear: () => gameDebugger.clear()
  };
}

export default gameDebugger;