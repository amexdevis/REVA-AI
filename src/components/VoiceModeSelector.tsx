/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mic, Activity, MicOff } from 'lucide-react';
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

const VoiceModeSelectorComponent: React.FC<VoiceModeSelectorProps> = ({
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
      className={`inline-flex items-center px-2 py-1.5 bg-[#0e051d]/85 border border-purple-900/50 rounded-full backdrop-blur-2xl shadow-[0_0_25px_rgba(107,33,168,0.25)] select-none font-sans ${className}`}
    >
      {/* 1. MANUAL MODE (Default) */}
      <button
        id="reva-mode-manual-btn"
        onClick={() => onSelectMode('MANUAL')}
        title="Manual Voice (Click mic to talk)"
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-sans transition-all duration-300 cursor-pointer ${
          voiceMode === 'MANUAL'
            ? 'bg-gradient-to-r from-[#240a42]/90 to-[#3b0764]/90 text-purple-100 font-medium shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400/50'
            : 'text-purple-300/60 hover:text-purple-100 hover:bg-purple-950/30'
        }`}
      >
        <Mic className="w-3.5 h-3.5 text-purple-300" />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Manual</span>
        {voiceMode === 'MANUAL' && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-purple-400 rounded-full shadow-[0_0_6px_#c084fc]" />
        )}
      </button>

      {/* 2. HANDS-FREE MODE ("Hey REVA") */}
      <button
        id="reva-mode-hands-free-btn"
        onClick={() => onSelectMode('HANDS_FREE')}
        title={
          !isWakeWordSupported
            ? 'Hands-Free Unavailable in this browser'
            : 'Hands-Free (Say "Hey REVA")'
        }
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-sans transition-all duration-300 cursor-pointer ${
          voiceMode === 'HANDS_FREE'
            ? 'bg-gradient-to-r from-[#240a42]/90 to-[#3b0764]/90 text-purple-100 font-medium shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400/50'
            : 'text-purple-300/60 hover:text-purple-100 hover:bg-purple-950/30'
        }`}
      >
        <Activity
          className={`w-3.5 h-3.5 ${
            voiceMode === 'HANDS_FREE' && machineState === 'WAKE_LISTENING'
              ? 'text-pink-300 animate-pulse'
              : 'text-purple-300'
          }`}
        />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Hands-Free</span>
        {voiceMode === 'HANDS_FREE' && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-purple-400 rounded-full shadow-[0_0_6px_#c084fc]" />
        )}
      </button>

      {/* 3. VOICE OFF */}
      <button
        id="reva-mode-off-btn"
        onClick={() => onSelectMode('OFF')}
        title="Voice Off (Microphone completely disabled)"
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-sans transition-all duration-300 cursor-pointer ${
          voiceMode === 'OFF'
            ? 'bg-rose-950/80 text-rose-300 font-medium shadow-[0_0_12px_rgba(244,63,94,0.4)] border border-rose-500/50'
            : 'text-purple-300/60 hover:text-rose-300 hover:bg-rose-950/20'
        }`}
      >
        <MicOff className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Off</span>
        {voiceMode === 'OFF' && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-rose-400 rounded-full shadow-[0_0_6px_#f43f5e]" />
        )}
      </button>
    </div>
  );
};

export const VoiceModeSelector = React.memo(VoiceModeSelectorComponent);
