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

const AudioVisualizerComponent: React.FC<AudioVisualizerProps> = ({
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
          statusText: 'Connecting to neural core...',
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
          greetingText: 'Hello.',
          statusText: "I'm listening...",
        };
      case 'REVA_SPEAKING': {
        const lastReva = [...transcripts].reverse().find((t) => t.role === 'reva');
        return {
          greetingText: lastReva ? `"${lastReva.text}"` : 'Hello.',
          statusText: 'Speaking...',
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

  // Audio equalizer waveform bars matching reference image: 32 bars symmetrical peak
  const barCount = 32;
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
      const curve = Math.exp(-distFromCenter * distFromCenter * 3.5);
      return { id: i, curve };
    });
  }, [barCount]);

  return (
    <div
      id="reva-left-dialogue-card"
      className="flex flex-col items-start justify-between w-[220px] sm:w-[240px] md:w-[255px] h-[190px] sm:h-[205px] p-4 sm:p-5 rounded-[22px] bg-transparent border border-purple-500/20 backdrop-blur-none shadow-none select-none text-left z-20 transition-all duration-300 hover:border-purple-500/40"
    >
      {/* Middle: Large Display Text & Subtitle */}
      <div className="flex flex-col my-auto">
        <h2 className="text-2xl sm:text-3xl md:text-[32px] font-normal text-zinc-100 font-sans tracking-tight leading-tight drop-shadow-[0_0_15px_rgba(216,180,254,0.35)] line-clamp-2">
          {greetingText === 'Hello.' ? (
            <>
              Hello<span className="text-purple-400">.</span>
            </>
          ) : (
            greetingText
          )}
        </h2>

        <p className="mt-1.5 text-xs text-purple-200/70 font-sans tracking-wide">
          {statusText}
        </p>
      </div>

      {/* Bottom: Three Pulsing Holographic Dots */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc] animate-pulse"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-purple-400/80 shadow-[0_0_5px_#c084fc] animate-pulse"
          style={{ animationDelay: '250ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-purple-400/60 shadow-[0_0_4px_#c084fc] animate-pulse"
          style={{ animationDelay: '500ms' }}
        />
      </div>
    </div>
  );
};

export const AudioVisualizer = React.memo(AudioVisualizerComponent);
