/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Mic, MicOff, Volume2, Radio, Sparkles } from 'lucide-react';
import { VoiceSessionState, MicrophonePermissionState } from '../types/voice.types.js';

interface MicrophoneControlProps {
  sessionState: VoiceSessionState;
  micState: MicrophonePermissionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  onToggleMute: () => void;
  onStartSession: () => void;
  onInterrupt: () => void;
}

export const MicrophoneControl: React.FC<MicrophoneControlProps> = ({
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

  // State label under the microphone circle
  const stateLabel = useMemo(() => {
    if (isOffline) return 'Offline';
    if (isConnecting) return 'Connecting...';
    if (isMuted) return 'Muted';
    if (isSpeaking) return 'Speaking...';
    if (isListening) return 'Listening...';
    return 'Ready';
  }, [isOffline, isConnecting, isMuted, isSpeaking, isListening]);

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
            transform: `scale(${1 + audioLevel * 0.35})`,
            backgroundColor: isMuted
              ? 'rgba(244, 63, 94, 0.15)'
              : isSpeaking
              ? 'rgba(192, 132, 252, 0.22)'
              : isListening
              ? 'rgba(168, 85, 247, 0.25)'
              : 'rgba(147, 51, 234, 0.1)',
            boxShadow: isMuted
              ? '0 0 20px rgba(244, 63, 94, 0.3)'
              : audioLevel > 0.05
              ? `0 0 ${25 + audioLevel * 35}px rgba(216, 180, 254, 0.6)`
              : '0 0 15px rgba(168, 85, 247, 0.3)',
          }}
        />

        {/* Outer Circular Equalizer Ticks (rotating slowly) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-holo-cw">
          {ticks.map((tick) => {
            const tickAudioFactor = Math.sin(tick.id * 0.5 + audioLevel * 5) * 0.5 + 0.5;
            const tickHeight = 3.5 + tickAudioFactor * (3.5 + audioLevel * 9);

            return (
              <div
                key={tick.id}
                className="absolute origin-bottom transition-all duration-75"
                style={{
                  transform: `rotate(${tick.angle}deg) translateY(-58px)`,
                  width: '1.5px',
                  height: `${tickHeight}px`,
                  backgroundColor: isMuted
                    ? '#fb7185'
                    : isListening || isSpeaking
                    ? '#d8b4fe'
                    : '#7e22ce',
                  opacity: isMuted ? 0.6 : 0.4 + tickAudioFactor * 0.6,
                }}
              />
            );
          })}
        </div>

        {/* Concentric Rotating Tech Ring 1 */}
        <div
          className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-purple-400/50 border-dashed animate-holo-ccw pointer-events-none"
          style={{
            borderColor: isMuted ? 'rgba(251, 113, 133, 0.5)' : undefined,
            boxShadow: `0 0 ${10 + audioLevel * 18}px ${
              isMuted ? 'rgba(251, 113, 133, 0.3)' : 'rgba(192, 132, 252, 0.4)'
            }`,
          }}
        />

        {/* Concentric Tech Ring 2 */}
        <div
          className={`absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border pointer-events-none ${
            isMuted ? 'border-rose-400/30' : 'border-purple-300/40'
          }`}
        />

        {/* Main Central Interactive Microphone Button */}
        <button
          id="reva-circular-mic-button"
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
          className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl active:scale-95 ${
            isMuted
              ? 'bg-[#2a0814] text-rose-300 border border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
              : isOffline
              ? 'bg-[#150728] text-purple-400/60 border border-purple-800/40 hover:text-purple-200 hover:border-purple-500'
              : isSpeaking
              ? 'bg-[#2e0854] text-purple-100 border border-purple-300 shadow-[0_0_28px_rgba(216,180,254,0.7)]'
              : isListening
              ? 'bg-[#25084a] text-purple-100 border border-purple-300/90 shadow-[0_0_25px_rgba(192,132,252,0.6)]'
              : 'bg-[#1c0836] text-purple-200 border border-purple-500/60 hover:border-purple-300'
          }`}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-rose-300" />
          ) : isOffline ? (
            <Radio className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse text-purple-400" />
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
        className={`mt-2.5 text-xs sm:text-sm font-sans tracking-wide ${
          isMuted
            ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
            : 'text-purple-200/90 drop-shadow-[0_0_10px_rgba(192,132,252,0.5)]'
        }`}
      >
        {stateLabel}
      </span>
    </div>
  );
};
