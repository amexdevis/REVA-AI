/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mic, MicOff, Radio, Volume2, Sparkles } from 'lucide-react';
import { VoiceSessionState, MicrophonePermissionState } from '../types/voice.types.js';

interface RevaHoloMicProps {
  sessionState: VoiceSessionState;
  micState: MicrophonePermissionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  onToggleMute: () => void;
  onStartSession: () => void;
  onInterrupt: () => void;
}

export const RevaHoloMic: React.FC<RevaHoloMicProps> = ({
  sessionState,
  micState,
  userAudioLevel,
  revaAudioLevel,
  onToggleMute,
  onStartSession,
  onInterrupt,
}) => {
  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const isOffline = sessionState === 'OFFLINE' || sessionState === 'ERROR';
  const isConnecting = sessionState === 'CONNECTING';
  const isMuted = micState === 'PAUSED' || micState === 'DENIED';

  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  const handleClick = () => {
    if (isOffline) {
      onStartSession();
    } else if (isSpeaking) {
      onInterrupt();
    } else {
      onToggleMute();
    }
  };

  // Ring scale based on real audio level
  const ringScale = 1 + audioLevel * 0.45;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Outer audio-reactive visualizer glow ring */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-75 ease-out"
        style={{
          width: `${68 * ringScale}px`,
          height: `${68 * ringScale}px`,
          backgroundColor: isSpeaking
            ? 'rgba(192, 132, 252, 0.25)'
            : isListening
            ? 'rgba(56, 189, 248, 0.25)'
            : 'rgba(168, 85, 247, 0.12)',
          boxShadow: isSpeaking
            ? `0 0 ${20 + audioLevel * 30}px rgba(192, 132, 252, 0.6)`
            : isListening
            ? `0 0 ${15 + audioLevel * 30}px rgba(56, 189, 248, 0.6)`
            : '0 0 10px rgba(168, 85, 247, 0.2)',
        }}
      />

      {/* Rotating holographic cyber border */}
      <div
        className={`absolute w-14 h-14 rounded-full border border-dashed pointer-events-none transition-all duration-500 ${
          isSpeaking
            ? 'border-purple-400/80 animate-holo-cw'
            : isListening
            ? 'border-cyan-400/80 animate-holo-cw'
            : isConnecting
            ? 'border-amber-400/80 animate-holo-cw'
            : 'border-purple-500/30'
        }`}
      />

      {/* Main interactive holographic button */}
      <button
        id="reva-holo-mic-btn"
        onClick={handleClick}
        title={
          isOffline
            ? 'Start REVA Voice Core'
            : isSpeaking
            ? 'Interrupt REVA'
            : isMuted
            ? 'Unmute Microphone'
            : 'Mute Microphone'
        }
        className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg active:scale-95 ${
          isOffline
            ? 'bg-zinc-900/90 text-zinc-400 border border-purple-900/40 hover:text-purple-300 hover:border-purple-500/60'
            : isSpeaking
            ? 'bg-purple-950/90 text-purple-200 border border-purple-400/80 shadow-[0_0_20px_rgba(192,132,252,0.5)]'
            : isMuted
            ? 'bg-rose-950/90 text-rose-300 border border-rose-500/60'
            : isListening
            ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-400/80 shadow-[0_0_15px_rgba(56,189,248,0.4)]'
            : 'bg-purple-950/80 text-purple-300 border border-purple-500/50 hover:border-purple-400'
        }`}
      >
        {isOffline ? (
          <Radio className="w-5 h-5 animate-pulse" />
        ) : isSpeaking ? (
          <Volume2 className="w-5 h-5 animate-pulse" />
        ) : isMuted ? (
          <MicOff className="w-5 h-5" />
        ) : isConnecting ? (
          <Sparkles className="w-5 h-5 animate-spin" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Tiny subtle tooltip hint */}
      <span className="mt-1.5 text-[10px] font-mono tracking-widest text-purple-300/60 uppercase">
        {isOffline
          ? 'Tap to Connect'
          : isSpeaking
          ? 'Tap to Interrupt'
          : isMuted
          ? 'Muted'
          : 'Hands-free Mic'}
      </span>
    </div>
  );
};
