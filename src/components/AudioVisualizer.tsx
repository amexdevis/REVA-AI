/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { VoiceSessionState, VoiceTranscriptItem } from '../types/voice.types.js';

interface AudioVisualizerProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  transcripts: VoiceTranscriptItem[];
  userName?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  transcripts,
  userName = 'Master',
}) => {
  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  // Dynamic state greeting and subtitle
  const { greetingText, statusText } = useMemo(() => {
    switch (sessionState) {
      case 'OFFLINE':
        return {
          greetingText: 'Hello.',
          statusText: 'Voice core is offline.',
        };
      case 'CONNECTING':
        return {
          greetingText: "Hey, I'm here.",
          statusText: 'Connecting to Gemini Live...',
        };
      case 'USER_SPEAKING':
      case 'LISTENING': {
        const lastUser = [...transcripts].reverse().find((t) => t.role === 'user');
        return {
          greetingText: lastUser ? `"${lastUser.text}"` : 'Hello.',
          statusText: "I'm listening...",
        };
      }
      case 'READY':
        return {
          greetingText: "Hey, I'm here.",
          statusText: 'Give me a second...',
        };
      case 'REVA_SPEAKING': {
        const lastReva = [...transcripts].reverse().find((t) => t.role === 'reva');
        return {
          greetingText: lastReva ? `"${lastReva.text}"` : 'Hello.',
          statusText: 'Here you go...',
        };
      }
      case 'INTERRUPTED':
        return {
          greetingText: 'Hello.',
          statusText: "I'm listening...",
        };
      default:
        return {
          greetingText: 'Hello.',
          statusText: "I'm listening...",
        };
    }
  }, [sessionState, transcripts]);

  // Audio equalizer bars: generate 24 bars symmetrical from center
  const barCount = 24;
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
      const curve = Math.exp(-distFromCenter * distFromCenter * 3.2);
      return { id: i, curve };
    });
  }, [barCount]);

  return (
    <div
      id="reva-left-audio-visualizer"
      className="flex flex-col items-start justify-center max-w-[240px] sm:max-w-[300px] select-none text-left z-20"
    >
      {/* Horizontal Audio Waveform Bars */}
      <div className="flex items-center gap-[2.5px] sm:gap-[3px] h-8 mb-3 px-0.5">
        {bars.map((bar) => {
          const baseHeight = 3;
          const dynamicHeight = Math.max(
            baseHeight,
            baseHeight + bar.curve * (14 + audioLevel * 28) * (0.8 + Math.sin(bar.id * 1.2) * 0.2)
          );

          return (
            <div
              key={bar.id}
              className="w-[2px] sm:w-[2.5px] rounded-full transition-all duration-75"
              style={{
                height: `${dynamicHeight}px`,
                backgroundColor:
                  sessionState === 'REVA_SPEAKING'
                    ? '#e9d5ff'
                    : sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING'
                    ? '#d8b4fe'
                    : '#a855f7',
                boxShadow:
                  audioLevel > 0.05
                    ? `0 0 8px rgba(216, 180, 254, ${0.4 + audioLevel * 0.6})`
                    : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Primary Greeting Line */}
      <h2 className="text-xl sm:text-2xl md:text-3xl font-light text-zinc-100 font-sans tracking-tight leading-snug drop-shadow-[0_0_15px_rgba(216,180,254,0.4)] line-clamp-2">
        {greetingText}
      </h2>

      {/* Secondary Status Subtitle */}
      <p className="mt-1.5 text-xs sm:text-sm text-purple-300/80 font-sans tracking-wide">
        {statusText}
      </p>

      {/* Three Pulsing Holographic Dots */}
      <div className="flex items-center gap-1.5 mt-3">
        <span
          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"
          style={{ animationDelay: '200ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"
          style={{ animationDelay: '400ms' }}
        />
      </div>
    </div>
  );
};
