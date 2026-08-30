/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Mic, MicOff, Volume2, Sparkles, ShieldAlert } from 'lucide-react';
import {
  VoiceSessionState,
  VoiceMode,
  VoiceMachineState,
  WakeWordStatus,
  MicrophonePermissionState,
} from '../types/voice.types.js';

interface MicrophoneControlProps {
  sessionState: VoiceSessionState;
  micState: MicrophonePermissionState;
  voiceMode?: VoiceMode;
  machineState?: VoiceMachineState;
  wakeWordStatus?: WakeWordStatus;
  userAudioLevel: number;
  revaAudioLevel: number;
  onToggleMute: () => void;
  onStartSession: () => void;
  onInterrupt: () => void;
  onSelectMode?: (mode: VoiceMode) => void;
}

const MicrophoneControlComponent: React.FC<MicrophoneControlProps> = ({
  sessionState,
  micState,
  voiceMode = 'MANUAL',
  machineState = 'MANUAL_IDLE',
  wakeWordStatus = 'IDLE',
  userAudioLevel,
  revaAudioLevel,
  onToggleMute,
  onStartSession,
  onInterrupt,
  onSelectMode,
}) => {
  const isSpeaking = sessionState === 'REVA_SPEAKING' || machineState === 'SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING' || machineState === 'LISTENING';
  const isConnecting = sessionState === 'CONNECTING' || machineState === 'CONNECTING';
  const isDenied = micState === 'DENIED';
  const isMuted = micState === 'PAUSED' && voiceMode !== 'OFF';
  const isVoiceOff = voiceMode === 'OFF' || machineState === 'OFF';
  const isWakeListening = voiceMode === 'HANDS_FREE' && machineState === 'WAKE_LISTENING';
  const isOffline = (sessionState === 'OFFLINE' || machineState === 'MANUAL_IDLE') && !isWakeListening && !isVoiceOff;

  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  const handleClick = () => {
    if (isVoiceOff) {
      onSelectMode?.('MANUAL');
      onStartSession();
    } else if (isDenied) {
      onStartSession();
    } else if (isOffline) {
      onStartSession();
    } else if (isSpeaking) {
      onInterrupt();
    } else if (isWakeListening) {
      onStartSession();
    } else {
      onToggleMute();
    }
  };

  // State label under the microphone circle
  const stateLabel = useMemo(() => {
    if (isDenied) return 'Microphone Denied';
    if (isVoiceOff) return 'Voice Off';
    if (isConnecting) return 'Connecting...';
    if (isSpeaking) return 'Speaking...';
    if (isListening) return 'Listening...';
    if (isMuted) return 'Muted';
    if (isWakeListening) return 'Listening for "Hey REVA"';
    if (sessionState === 'ERROR' || machineState === 'ERROR') return 'Voice Error';
    if (isOffline) return 'Listening...';
    return 'Listening...';
  }, [isDenied, isVoiceOff, isConnecting, isSpeaking, isListening, isMuted, isWakeListening, sessionState, machineState, isOffline]);

  // Audio equalizer bars matching reference image: 26 centered horizontal bars
  const barCount = 26;
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
      const curve = Math.exp(-distFromCenter * distFromCenter * 3.5);
      return { id: i, curve };
    });
  }, [barCount]);

  return (
    <div
      id="reva-right-mic-control"
      className="flex flex-col items-center justify-center select-none z-20"
    >
      {/* Clean, Normal Circular Microphone Control Container */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
        {/* Soft Ambient Audio Reactive Glow */}
        <div
          className="absolute inset-0 rounded-full bg-purple-600/20 blur-lg transition-all duration-300 pointer-events-none"
          style={{
            opacity: isVoiceOff ? 0 : 0.4 + audioLevel * 0.6,
            transform: `scale(${1 + (isVoiceOff ? 0 : audioLevel * 0.15)})`,
          }}
        />

        {/* Outer Clean Circular Border Ring */}
        <div
          className="absolute inset-0 rounded-full border border-purple-500/30 transition-all duration-300 pointer-events-none"
          style={{
            transform: `scale(${1 + (isVoiceOff ? 0 : audioLevel * 0.08)})`,
            borderColor: isSpeaking
              ? 'rgba(192, 132, 252, 0.6)'
              : isListening
              ? 'rgba(168, 85, 247, 0.45)'
              : 'rgba(147, 51, 234, 0.25)',
          }}
        />

        {/* Center Primary Microphone Action Button */}
        <button
          id="reva-circular-mic-button"
          onClick={handleClick}
          title="Microphone (Click to talk or mute)"
          className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 shadow-lg backdrop-blur-md ${
            isVoiceOff
              ? 'text-zinc-500 border border-zinc-700/50 bg-zinc-900/60 hover:text-zinc-300 hover:border-zinc-600'
              : isDenied || isMuted
              ? 'text-rose-200 border border-rose-500/60 bg-rose-950/50 shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:bg-rose-900/60'
              : isWakeListening
              ? 'text-pink-100 border border-pink-400/60 bg-pink-950/50 shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:bg-pink-900/60'
              : isSpeaking
              ? 'text-purple-50 border border-purple-300/80 bg-purple-900/70 shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:bg-purple-800/80'
              : 'text-purple-100 border border-purple-400/50 bg-[#16062a]/80 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:border-purple-300 hover:bg-purple-950/90 hover:shadow-[0_0_25px_rgba(168,85,247,0.45)]'
          }`}
        >
          {isVoiceOff ? (
            <MicOff className="w-6 h-6 text-zinc-500" />
          ) : isDenied ? (
            <ShieldAlert className="w-6 h-6 text-rose-300 animate-pulse" />
          ) : isMuted ? (
            <MicOff className="w-6 h-6 text-rose-200" />
          ) : isSpeaking ? (
            <Volume2 className="w-6 h-6 text-purple-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
          ) : isConnecting ? (
            <Sparkles className="w-6 h-6 animate-spin text-purple-200" />
          ) : (
            <Mic className="w-6 h-6 text-purple-100 drop-shadow-[0_0_8px_rgba(216,180,254,0.6)]" />
          )}
        </button>
      </div>

      {/* State Label Below the Microphone */}
      <span className="mt-3 text-xs font-normal text-purple-200/90 tracking-wide text-center drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]">
        {stateLabel}
      </span>

      {/* Equalizer waveform centered below text */}
      <div className="flex items-center gap-[2px] sm:gap-[2.5px] h-5 mt-2.5 px-3">
        {bars.map((bar) => {
          const baseHeight = 2.5;
          const dynamicHeight = Math.max(
            baseHeight,
            baseHeight + bar.curve * (7 + audioLevel * 16) * (0.85 + Math.sin(bar.id * 1.5) * 0.15)
          );

          return (
            <div
              key={bar.id}
              className="w-[2.5px] rounded-full transition-all duration-75"
              style={{
                height: `${dynamicHeight}px`,
                backgroundColor: isSpeaking
                  ? '#f3e8ff'
                  : isListening
                  ? '#d8b4fe'
                  : '#c084fc',
                boxShadow:
                  audioLevel > 0.05
                    ? `0 0 6px rgba(216, 180, 254, ${0.4 + audioLevel * 0.6})`
                    : '0 0 3px rgba(192, 132, 252, 0.3)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export const MicrophoneControl = React.memo(MicrophoneControlComponent);
