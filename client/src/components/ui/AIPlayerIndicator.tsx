import React from 'react';
import { Bot, Zap, Brain, Target } from 'lucide-react';
import { PlayerState } from '@shared/types/game';

interface AIPlayerIndicatorProps {
  player: PlayerState;
  isCurrentPlayer?: boolean;
}

/**
 * Visual indicator for AI players with difficulty level
 */
export function AIPlayerIndicator({ player, isCurrentPlayer = false }: AIPlayerIndicatorProps) {
  if (!player.isAI) return null;

  const getDifficultyIcon = () => {
    switch (player.aiDifficulty) {
      case 'easy':
        return <Zap className="w-3 h-3 animate-pulse" />;
      case 'normal':
        return <Brain className="w-3 h-3" />;
      case 'hard':
        return <Target className="w-3 h-3 text-red-500 animate-pulse" />;
      default:
        return <Bot className="w-3 h-3" />;
    }
  };

  const getDifficultyColor = () => {
    switch (player.aiDifficulty) {
      case 'easy':
        return 'text-green-400 bg-green-500/20 border-green-500/30 shadow-green-500/20 shadow-lg';
      case 'normal':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30 shadow-blue-500/20 shadow-md';
      case 'hard':
        return 'text-red-400 bg-red-500/20 border-red-500/30 shadow-red-500/30 shadow-xl animate-pulse';
      default:
        return 'text-amber-400 bg-amber-500/20 border-amber-500/30 shadow-amber-500/20 shadow-md';
    }
  };

  const getDifficultyText = () => {
    return player.aiDifficulty?.toUpperCase() || 'AI';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium transition-all duration-300 hover:scale-105 ${getDifficultyColor()}`}>
      <Bot className="w-3 h-3" />
      {getDifficultyIcon()}
      <span className="font-semibold">{getDifficultyText()}</span>
      {isCurrentPlayer && (
        <div className="ml-1 flex items-center gap-0.5">
          <div className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
        </div>
      )}
    </div>
  );
}

/**
 * AI thinking indicator for when AI is making decisions
 */
export function AIThinkingIndicator({ player }: { player: PlayerState }) {
  if (!player.isAI) return null;

  const getDifficultyText = () => {
    switch (player.aiDifficulty) {
      case 'easy': return 'Easy';
      case 'normal': return 'Normal';
      case 'hard': return 'Hard';
      default: return 'AI';
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-slate-800/95 text-white px-4 py-3 rounded-lg border border-amber-500/30 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
          </div>
          <div>
            <p className="text-sm font-medium">🤖 {player.name} is thinking...</p>
            <p className="text-xs text-amber-300/70">{getDifficultyText()} AI making strategic decisions</p>
          </div>
        </div>
      </div>
    </div>
  );
}