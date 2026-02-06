/**
 * AI Debug Panel - Visualizes AI thinking and decision-making process
 * Provides developers and testers with insights into AI behavior
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Bug, 
  Brain, 
  Target, 
  TrendingUp, 
  Clock, 
  Eye, 
  Zap,
  BarChart3,
  Settings
} from 'lucide-react';

import { aiLogger, aiDebugOverlay, aiPerformanceMonitor, AIDebugInfo } from '@shared/ai/aiFoundation';
import { AISandbox, SandboxConfig, runQuickAITest } from '@shared/ai/aiSandbox';

interface AIDebugPanelProps {
  visible: boolean;
  onClose: () => void;
  currentPlayerId?: string;
}

export function AIDebugPanel({ visible, onClose, currentPlayerId }: AIDebugPanelProps) {
  const [debugInfo, setDebugInfo] = useState<AIDebugInfo | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  useEffect(() => {
    if (!visible) return;

    // Update debug info every second
    const interval = setInterval(() => {
      if (currentPlayerId) {
        const info = aiDebugOverlay.getDebugInfo(currentPlayerId);
        setDebugInfo(info || null);
      }
      
      setLogs(aiLogger.getLogs().slice(-20)); // Last 20 actions
      setPerformanceMetrics(aiLogger.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, currentPlayerId]);

  const toggleDebugOverlay = () => {
    aiDebugOverlay.setEnabled(!aiDebugOverlay.isEnabled());
  };

  const runSandboxTest = async () => {
    setSandboxRunning(true);
    try {
      const result = await runQuickAITest(['nephites', 'lamanites'], 'normal', 30);
      setSandboxResult(result);
    } catch (error) {
      console.error('Sandbox test failed:', error);
    } finally {
      setSandboxRunning(false);
    }
  };

  const clearLogs = () => {
    // Create new logger instance to clear logs
    setLogs([]);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[var(--z-modal-backdrop)] flex items-center justify-center p-4 pointer-events-auto" data-ui-layer="modal">
      <Card data-ui-layer="modal-content" className="z-[var(--z-modal-content)] w-full max-w-6xl h-full max-h-[90vh] bg-slate-900 border-amber-500/30 overflow-hidden">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-amber-100 flex items-center gap-2">
              <Bug className="w-5 h-5" />
              AI Debug Console
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleDebugOverlay}
                className={`${aiDebugOverlay.isEnabled() ? 'bg-green-600' : 'bg-slate-600'} text-white`}
              >
                <Eye className="w-4 h-4 mr-1" />
                Debug Overlay
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-hidden">
          <Tabs defaultValue="thinking" className="h-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-800">
              <TabsTrigger value="thinking" className="flex items-center gap-1">
                <Brain className="w-4 h-4" />
                AI Mind
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                Action Log
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="sandbox" className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                Sandbox
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1">
                <Settings className="w-4 h-4" />
                Config
              </TabsTrigger>
            </TabsList>

            {/* AI Thinking Tab */}
            <TabsContent value="thinking" className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {debugInfo ? (
                <div className="space-y-4">
                  {/* Strategic Goals */}
                  <Card className="bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-lg text-amber-100">Current Strategy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300 mb-2">{debugInfo.currentPlan || 'No active plan'}</p>
                      <div className="flex flex-wrap gap-2">
                        {debugInfo.strategicGoals.map((goal, index) => (
                          <Badge key={index} variant="secondary">{goal}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Faction Mood */}
                  <Card className="bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-lg text-amber-100">Faction Personality</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Aggression</span>
                          <span>{Math.round(debugInfo.factionMood.aggression * 100)}%</span>
                        </div>
                        <Progress value={debugInfo.factionMood.aggression * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Piety</span>
                          <span>{Math.round(debugInfo.factionMood.piety * 100)}%</span>
                        </div>
                        <Progress value={debugInfo.factionMood.piety * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Opportunism</span>
                          <span>{Math.round(debugInfo.factionMood.opportunism * 100)}%</span>
                        </div>
                        <Progress value={debugInfo.factionMood.opportunism * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Risk Tolerance</span>
                          <span>{Math.round(debugInfo.factionMood.riskTolerance * 100)}%</span>
                        </div>
                        <Progress value={debugInfo.factionMood.riskTolerance * 100} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Resource Priorities */}
                  <Card className="bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-lg text-amber-100">Resource Focus</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{debugInfo.resourcePriorities.stars}</div>
                        <div className="text-sm text-slate-400">Stars Priority</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{debugInfo.resourcePriorities.faith}</div>
                        <div className="text-sm text-slate-400">Faith Priority</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{debugInfo.resourcePriorities.pride}</div>
                        <div className="text-sm text-slate-400">Pride Priority</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No AI debug info available</p>
                  <p className="text-sm">Debug overlay must be enabled and an AI must be active</p>
                </div>
              )}
            </TabsContent>

            {/* Action Log Tab */}
            <TabsContent value="logs" className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-amber-100">Recent AI Actions</h3>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  Clear Logs
                </Button>
              </div>
              
              <div className="space-y-2">
                {logs.length > 0 ? logs.map((log, index) => (
                  <Card key={index} className="bg-slate-800/30">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">Turn {log.turn}</Badge>
                            <span className="text-sm text-slate-400">{log.playerId}</span>
                          </div>
                          <p className="text-slate-200 font-medium">{log.action}</p>
                          <p className="text-sm text-slate-400 mt-1">{log.reasoning}</p>
                        </div>
                        <div className="text-xs text-slate-500 text-right">
                          <div>{log.metrics.decisionTimeMs}ms</div>
                          <div>Confidence: {Math.round(log.metrics.confidenceScore * 100)}%</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="text-center text-slate-400 py-8">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No AI actions logged yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <Card className="bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-amber-100 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {performanceMetrics ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-2xl font-bold text-green-400">
                            {performanceMetrics.avgDecisionTime?.toFixed(1)}ms
                          </div>
                          <div className="text-sm text-slate-400">Avg Decision Time</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-400">
                            {performanceMetrics.maxDecisionTime?.toFixed(1)}ms
                          </div>
                          <div className="text-sm text-slate-400">Max Decision Time</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-400">
                            {performanceMetrics.totalActions}
                          </div>
                          <div className="text-sm text-slate-400">Total Actions</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-400">
                            {performanceMetrics.avgConfidence?.toFixed(1)}%
                          </div>
                          <div className="text-sm text-slate-400">Avg Confidence</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400">No performance data available</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-amber-100">Live Performance Report</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                      {aiPerformanceMonitor.getPerformanceReport()}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Sandbox Tab */}
            <TabsContent value="sandbox" className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <Card className="bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-amber-100">AI vs AI Testing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={runSandboxTest} 
                      disabled={sandboxRunning}
                      className="w-full"
                    >
                      {sandboxRunning ? 'Running Test...' : 'Run Quick AI Test'}
                    </Button>
                  </CardContent>
                </Card>

                {sandboxResult && (
                  <Card className="bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-lg text-amber-100">Test Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-lg font-bold text-green-400">
                            {sandboxResult.winner || 'Draw'}
                          </div>
                          <div className="text-sm text-slate-400">Winner</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-400">
                            {sandboxResult.totalTurns}
                          </div>
                          <div className="text-sm text-slate-400">Total Turns</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-yellow-400">
                            {sandboxResult.performanceMetrics.avgTurnTime.toFixed(1)}ms
                          </div>
                          <div className="text-sm text-slate-400">Avg Turn Time</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-purple-400">
                            {sandboxResult.endReason}
                          </div>
                          <div className="text-sm text-slate-400">End Reason</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <Card className="bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-lg text-amber-100">Debug Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Debug Overlay Enabled</span>
                    <Button
                      variant={aiDebugOverlay.isEnabled() ? "default" : "outline"}
                      size="sm"
                      onClick={toggleDebugOverlay}
                    >
                      {aiDebugOverlay.isEnabled() ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Performance Monitoring</span>
                    <Badge variant="secondary">Always On</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Action Logging</span>
                    <Badge variant="secondary">Always On</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
