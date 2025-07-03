/**
 * Simple game debugging utilities for our strategy game
 */

interface DebugInfo {
  timestamp: number;
  type: 'unit' | 'visibility' | 'rendering' | 'action';
  message: string;
  data?: any;
}

class GameDebugger {
  private logs: DebugInfo[] = [];
  private maxLogs = 100;

  log(type: DebugInfo['type'], message: string, data?: any) {
    const entry: DebugInfo = {
      timestamp: Date.now(),
      type,
      message,
      data
    };

    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging with emoji indicators
    const emoji = type === 'unit' ? '🎮' : 
                  type === 'visibility' ? '👁️' : 
                  type === 'rendering' ? '🎨' : '⚡';
    
    console.log(`${emoji} [${type}]`, message, data || '');
  }

  logUnit(message: string, unit?: any) {
    this.log('unit', message, unit ? {
      id: unit.id,
      type: unit.type,
      playerId: unit.playerId,
      coordinate: unit.coordinate,
      hp: unit.hp,
      visible: unit.visible
    } : undefined);
  }

  logVisibility(message: string, data?: any) {
    this.log('visibility', message, data);
  }

  logRendering(message: string, data?: any) {
    this.log('rendering', message, data);
  }

  logAction(message: string, data?: any) {
    this.log('action', message, data);
  }

  getDebugSummary() {
    const recent = this.logs.slice(-20);
    return {
      totalLogs: this.logs.length,
      recentLogs: recent,
      errorCounts: {
        units: this.logs.filter(l => l.type === 'unit').length,
        visibility: this.logs.filter(l => l.type === 'visibility').length,
        rendering: this.logs.filter(l => l.type === 'rendering').length,
        actions: this.logs.filter(l => l.type === 'action').length
      }
    };
  }

  exportLogs() {
    const data = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ...this.getDebugSummary()
    };
    
    console.table(data.recentLogs);
    console.log('Debug Summary:', data);
    
    return data;
  }

  clear() {
    this.logs = [];
    console.log('🧹 Debug logs cleared');
  }
}

export const gameDebugger = new GameDebugger();

// Simple hook for debugging
export function useGameDebugger() {
  return {
    logUnit: (message: string, unit?: any) => gameDebugger.logUnit(message, unit),
    logVisibility: (message: string, data?: any) => gameDebugger.logVisibility(message, data),
    logRendering: (message: string, data?: any) => gameDebugger.logRendering(message, data),
    logAction: (message: string, data?: any) => gameDebugger.logAction(message, data),
    exportLogs: () => gameDebugger.exportLogs(),
    clear: () => gameDebugger.clear()
  };
}

export default gameDebugger;