/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Settings, Database, Heart, Sparkles } from 'lucide-react';
import { PersonalityDiagnosticsData, VoiceSessionState } from '../types/voice.types.js';

interface RevaHudHeaderProps {
  sessionState: VoiceSessionState;
  personality?: PersonalityDiagnosticsData;
  memoryCount: number;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onOpenMood?: () => void;
}

export const RevaHudHeader: React.FC<RevaHudHeaderProps> = ({
  sessionState,
  personality,
  memoryCount,
  onOpenSettings,
  onOpenMemory,
  onOpenMood,
}) => {
  const [timeString, setTimeString] = useState<string>('');
  const [dateString, setDateString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      );
      setDateString(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine current mood label from real emotional state
  const currentMood = personality?.dominantEmotion
    ? personality.dominantEmotion.charAt(0).toUpperCase() + personality.dominantEmotion.slice(1).toLowerCase()
    : 'Calm';

  const isOnline = sessionState !== 'OFFLINE' && sessionState !== 'ERROR';

  return (
    <header className="w-full px-6 py-4 flex items-center justify-between z-20 select-none">
      {/* Top Left: Minimal Time & Date HUD */}
      <div className="flex flex-col items-start font-mono text-xs">
        <div className="flex items-center gap-1.5 text-purple-200/90 font-semibold tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span>{timeString}</span>
        </div>
        <span className="text-[10px] text-purple-400/50 tracking-widest pl-3">{dateString}</span>
      </div>

      {/* Center: REVA Identity */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-light tracking-[0.25em] text-purple-100 font-sans drop-shadow-[0_0_12px_rgba(192,132,252,0.6)]">
            REVA
          </h1>
          <span
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              sessionState === 'REVA_SPEAKING'
                ? 'bg-purple-400 shadow-[0_0_8px_#c084fc] scale-125'
                : sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING'
                ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8] scale-125'
                : isOnline
                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                : 'bg-zinc-600'
            }`}
          />
        </div>
        <span className="text-[9px] font-mono text-purple-400/60 tracking-widest uppercase">
          AI Companion
        </span>
      </div>

      {/* Top Right: Micro Controls (Mood, Memory, Settings) */}
      <div className="flex items-center gap-2 font-mono text-xs">
        {/* Mood Pill */}
        <button
          onClick={onOpenMood || onOpenSettings}
          title="REVA Emotional State"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/40 border border-purple-800/40 text-purple-300/80 hover:text-purple-100 hover:border-purple-600/60 transition-all cursor-pointer text-[11px]"
        >
          <Heart className="w-3 h-3 text-purple-400" />
          <span>{currentMood}</span>
        </button>

        {/* Memory Pill */}
        <button
          onClick={onOpenMemory}
          title="Open Memory Overlay"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/40 border border-purple-800/40 text-purple-300/80 hover:text-purple-100 hover:border-purple-600/60 transition-all cursor-pointer text-[11px]"
        >
          <Database className="w-3 h-3 text-emerald-400" />
          <span>{memoryCount > 0 ? `${memoryCount}` : 'Active'}</span>
        </button>

        {/* Settings Gear */}
        <button
          onClick={onOpenSettings}
          title="Open Settings"
          className="p-1.5 rounded-full bg-purple-950/40 border border-purple-800/40 text-purple-300/80 hover:text-purple-100 hover:border-purple-600/60 transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
