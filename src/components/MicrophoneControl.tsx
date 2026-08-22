/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Mic, MicOff, Volume2, Radio, Sparkles, ShieldAlert } from 'lucide-react';
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

export const MicrophoneControl: React.FC<MicrophoneControlProps> = ({
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
      // Prompt / switch to Manual mode
      onSelectMode?.('MANUAL');
      onStartSession();
    } else if (isDenied) {
      onStartSession();
    } else if (isOffline) {
      onStartSession();
    } else if (isSpeaking) {
      onInterrupt();
    } else if (isWakeListening) {
      // Manual immediate trigger in hands-free mode
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
    if (isOffline) return 'Ready (Click to talk)';
    return 'Ready';
  }, [isDenied, isVoiceOff, isConnecting, isSpeaking, isListening, isMuted, isWakeListening, sessionState, machineState, isOffline]);

  // Generate 44 circular frequency dial tick marks around the ring
  const tickCount = 44;
  const ticks = useMemo(() => {
    return Array.from({ length: tickCount }, (_, i) => {
      const angle = (i / tickCount) * 360;
      return { id: i, angle };
    });
  }, [tickCount]);

  return (
    <div
      id="reva-right-mic-control"
      className="flex flex-col items-center justify-center select-none z-20"
    >
      {/* Outer Holographic Container */}
      <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
        {/* Outermost Pulsing Ambient Glow */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-100 ease-out pointer-events-none"
          style={{
            transform: `scale(${1 + (isVoiceOff ? 0 : audioLevel * 0.35)})`,
            backgroundColor: isVoiceOff
              ? 'rgba(75, 85, 99, 0.08)'
              : isDenied || isMuted
              ? 'rgba(244, 63, 94, 0.15)'
              : isWakeListening
              ? 'rgba(236, 72, 153, 0.18)'
              : isSpeaking
              ? 'rgba(192, 132, 252, 0.22)'
              : isListening
              ? 'rgba(168, 85, 247, 0.25)'
              : 'rgba(147, 51, 234, 0.1)',
            boxShadow: isVoiceOff
              ? 'none'
              : isDenied || isMuted
              ? '0 0 20px rgba(244, 63, 94, 0.3)'
              : isWakeListening
              ? '0 0 25px rgba(236, 72, 153, 0.4)'
              : audioLevel > 0.05
              ? `0 0 ${25 + audioLevel * 35}px rgba(216, 180, 254, 0.6)`
              : '0 0 15px rgba(168, 85, 247, 0.3)',
          }}
        />

        {/* Outer Circular Equalizer Ticks (rotating slowly) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-holo-cw">
          {ticks.map((tick) => {
            const tickAudioFactor = Math.sin(tick.id * 0.5 + audioLevel * 5) * 0.5 + 0.5;
            const tickHeight = isVoiceOff
              ? 2
              : isWakeListening
              ? 3 + Math.sin(tick.id * 0.3) * 2
              : 3.5 + tickAudioFactor * (3.5 + audioLevel * 9);

            return (
              <div
                key={tick.id}
                className="absolute origin-bottom transition-all duration-75"
                style={{
                  transform: `rotate(${tick.angle}deg) translateY(-58px)`,
                  width: '1.5px',
                  height: `${tickHeight}px`,
                  backgroundColor: isVoiceOff
                    ? '#52525b'
                    : isDenied || isMuted
                    ? '#fb7185'
                    : isWakeListening
                    ? '#f472b6'
                    : isListening || isSpeaking
                    ? '#d8b4fe'
                    : '#7e22ce',
                  opacity: isVoiceOff ? 0.2 : isDenied ? 0.4 : isMuted ? 0.6 : 0.4 + tickAudioFactor * 0.6,
                }}
              />
            );
          })}
        </div>

        {/* Concentric Rotating Tech Ring 1 */}
        <div
          className={`absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-dashed animate-holo-ccw pointer-events-none ${
            isVoiceOff
              ? 'border-zinc-700/40'
              : isDenied || isMuted
              ? 'border-rose-400/50'
              : isWakeListening
              ? 'border-pink-400/60'
              : 'border-purple-400/50'
          }`}
          style={{
            boxShadow: isVoiceOff
              ? 'none'
              : `0 0 ${10 + audioLevel * 18}px ${
                  isDenied || isMuted
                    ? 'rgba(251, 113, 133, 0.3)'
                    : isWakeListening
                    ? 'rgba(244, 114, 182, 0.4)'
                    : 'rgba(192, 132, 252, 0.4)'
                }`,
          }}
        />

        {/* Concentric Tech Ring 2 */}
        <div
          className={`absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border pointer-events-none ${
            isVoiceOff
              ? 'border-zinc-800/40'
              : isDenied || isMuted
              ? 'border-rose-400/30'
              : isWakeListening
              ? 'border-pink-300/40'
              : 'border-purple-300/40'
          }`}
        />

        {/* Main Central Interactive Microphone Button */}
        <button
          id="reva-circular-mic-button"
          onClick={handleClick}
          title={
            isVoiceOff
              ? 'Voice is OFF. Click to enable Manual Voice.'
              : isDenied
              ? 'Microphone permission required. Click to request.'
              : isWakeListening
              ? 'Hands-Free listening for "Hey REVA". Click to talk manually.'
              : isOffline
              ? 'Click to start Manual Voice conversation'
              : isSpeaking
              ? 'Interrupt REVA'
              : isMuted
              ? 'Unmute Microphone'
              : 'Mute Microphone'
          }
          className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl active:scale-95 ${
            isVoiceOff
              ? 'bg-[#18181b] text-zinc-500 border border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-500'
              : isDenied
              ? 'bg-[#2a0814] text-rose-400 border border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
              : isMuted
              ? 'bg-[#2a0814] text-rose-300 border border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
              : isWakeListening
              ? 'bg-gradient-to-br from-[#2e0840] to-[#1c0836] text-pink-200 border border-pink-400/70 shadow-[0_0_25px_rgba(236,72,153,0.5)]'
              : isOffline
              ? 'bg-[#150728] text-purple-400/70 border border-purple-800/40 hover:text-purple-200 hover:border-purple-500'
              : isSpeaking
              ? 'bg-[#2e0854] text-purple-100 border border-purple-300 shadow-[0_0_28px_rgba(216,180,254,0.7)]'
              : isListening
              ? 'bg-[#25084a] text-purple-100 border border-purple-300/90 shadow-[0_0_25px_rgba(192,132,252,0.6)]'
              : 'bg-[#1c0836] text-purple-200 border border-purple-500/60 hover:border-purple-300'
          }`}
        >
          {isVoiceOff ? (
            <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-500" />
          ) : isDenied ? (
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 animate-pulse" />
          ) : isMuted ? (
            <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-rose-300" />
          ) : isWakeListening ? (
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-pink-300 animate-pulse drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
          ) : isOffline ? (
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300/80" />
          ) : isSpeaking ? (
            <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse text-purple-200" />
          ) : isConnecting ? (
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-purple-300" />
          ) : (
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-purple-100 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]" />
          )}
        </button>
      </div>

      {/* State Label Below the Microphone */}
      <span
        className={`mt-2.5 text-xs sm:text-sm font-sans tracking-wide text-center px-2 max-w-[200px] truncate ${
          isVoiceOff
            ? 'text-zinc-500'
            : isDenied
            ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)] font-medium'
            : isMuted
            ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
            : isWakeListening
            ? 'text-pink-200 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)] font-medium animate-pulse'
            : 'text-purple-200/90 drop-shadow-[0_0_10px_rgba(192,132,252,0.5)]'
        }`}
      >
        {stateLabel}
      </span>
    </div>
  );
};
