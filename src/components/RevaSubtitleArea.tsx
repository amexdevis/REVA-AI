/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { VoiceSessionState, VoiceTranscriptItem } from '../types/voice.types.js';

interface RevaSubtitleAreaProps {
  sessionState: VoiceSessionState;
  transcripts: VoiceTranscriptItem[];
  revaSpeechText?: string;
  userSpeechText?: string;
}

export const RevaSubtitleArea: React.FC<RevaSubtitleAreaProps> = ({
  sessionState,
  transcripts,
  revaSpeechText,
  userSpeechText,
}) => {
  // Extract latest relevant speech or default prompt
  const displaySubtitle = useMemo(() => {
    if (sessionState === 'OFFLINE') {
      return 'REVA is currently offline.';
    }
    if (sessionState === 'CONNECTING') {
      return 'Connecting to Gemini Live...';
    }
    if (sessionState === 'USER_SPEAKING' || sessionState === 'LISTENING') {
      if (userSpeechText) return `"${userSpeechText}"`;
      const lastUser = [...transcripts].reverse().find((t) => t.role === 'user');
      if (lastUser && Date.now() - new Date(lastUser.timestamp).getTime() < 8000) {
        return `"${lastUser.text}"`;
      }
      return "I'm listening...";
    }
    if (sessionState === 'READY') {
      return 'Give me a second...';
    }
    if (sessionState === 'REVA_SPEAKING') {
      if (revaSpeechText) return `"${revaSpeechText}"`;
      const lastReva = [...transcripts].reverse().find((t) => t.role === 'reva');
      if (lastReva) return `"${lastReva.text}"`;
      return 'Thinking...';
    }
    const lastMsg = transcripts[transcripts.length - 1];
    if (lastMsg) {
      return `"${lastMsg.text}"`;
    }
    return 'Hey.';
  }, [sessionState, transcripts, revaSpeechText, userSpeechText]);

  return (
    <div
      id="reva-subtitle-area"
      className="w-full max-w-lg px-4 py-2 min-h-[48px] flex items-center justify-center text-center select-none"
    >
      <p className="text-sm sm:text-base text-purple-100/90 font-sans tracking-wide leading-relaxed drop-shadow-[0_0_8px_rgba(192,132,252,0.4)] transition-all duration-300">
        {displaySubtitle}
      </p>
    </div>
  );
};
