/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mic, Sparkles, MicOff, AlertCircle } from 'lucide-react';
import { VoiceMode, VoiceMachineState, WakeWordStatus } from '../types/voice.types.js';

interface VoiceModeSelectorProps {
  voiceMode: VoiceMode;
  machineState: VoiceMachineState;
  wakeWordStatus: WakeWordStatus;
  isWakeWordSupported: boolean;
  onSelectMode: (mode: VoiceMode) => void;
  className?: string;
  compact?: boolean;
}

export const VoiceModeSelector: React.FC<VoiceModeSelectorProps> = ({
  voiceMode,
  machineState,
  wakeWordStatus,
  isWakeWordSupported,
  onSelectMode,
  className = '',
  compact = false,
}) => {
  return (
    <div
      id="reva-voice-mode-selector"
      className={`inline-flex items-center p-1 bg-[#100624]/90 border border-purple-900/60 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(147,51,234,0.15)] select-none font-sans ${className}`}
    >
      {/* 1. MANUAL MODE (Default) */}
      <button
        id="reva-mode-manual-btn"
        onClick={() => onSelectMode('MANUAL')}
        title="Manual Voice (Click mic to talk)"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-200 cursor-pointer ${
          voiceMode === 'MANUAL'
            ? 'bg-purple-700/80 text-purple-100 font-medium shadow-[0_0_12px_rgba(168,85,247,0.5)] border border-purple-400/40'
            : 'text-zinc-400 hover:text-purple-200 hover:bg-purple-950/40'
        }`}
      >
        <Mic className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Manual</span>
      </button>

      {/* 2. HANDS-FREE MODE ("Hey REVA") */}
      <button
        id="reva-mode-hands-free-btn"
        onClick={() => {
          if (!isWakeWordSupported) {
            onSelectMode('HANDS_FREE'); // will trigger unsupported notice
          } else {
            onSelectMode('HANDS_FREE');
          }
        }}
        title={
          !isWakeWordSupported
            ? 'Hands-Free Unavailable in this browser'
            : 'Hands-Free (Say "Hey REVA")'
        }
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-200 cursor-pointer relative ${
          voiceMode === 'HANDS_FREE'
            ? 'bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white font-medium shadow-[0_0_16px_rgba(216,180,254,0.6)] border border-purple-300/60'
            : 'text-zinc-400 hover:text-purple-200 hover:bg-purple-950/40'
        }`}
      >
        <Sparkles
          className={`w-3.5 h-3.5 ${
            voiceMode === 'HANDS_FREE' && machineState === 'WAKE_LISTENING'
              ? 'text-pink-200 animate-pulse'
              : ''
          }`}
        />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Hands-Free</span>
        {voiceMode === 'HANDS_FREE' && (
          <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping absolute -top-0.5 -right-0.5" />
        )}
      </button>

      {/* 3. VOICE OFF */}
      <button
        id="reva-mode-off-btn"
        onClick={() => onSelectMode('OFF')}
        title="Voice Off (Microphone completely disabled)"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-200 cursor-pointer ${
          voiceMode === 'OFF'
            ? 'bg-rose-950/80 text-rose-300 font-medium shadow-[0_0_12px_rgba(244,63,94,0.4)] border border-rose-500/50'
            : 'text-zinc-400 hover:text-rose-300 hover:bg-rose-950/20'
        }`}
      >
        <MicOff className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Off</span>
      </button>
    </div>
  );
};
