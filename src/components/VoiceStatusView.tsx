/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mic, MicOff, Square, Power, Volume2, User, Sparkles, Heart } from 'lucide-react';
import { VoiceSessionState, MicrophonePermissionState, VoiceTranscriptItem, PersonalityDiagnosticsData } from '../types/voice.types.js';

interface VoiceStatusViewProps {
  sessionState: VoiceSessionState;
  micState: MicrophonePermissionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  transcripts: VoiceTranscriptItem[];
  personality?: PersonalityDiagnosticsData;
  onStartVoice: () => void;
  onDisconnectVoice: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
}

export const VoiceStatusView: React.FC<VoiceStatusViewProps> = ({
  sessionState,
  micState,
  userAudioLevel,
  revaAudioLevel,
  transcripts,
  personality,
  onStartVoice,
  onDisconnectVoice,
  onToggleMute,
  onInterrupt,
}) => {
  const isConnected =
    sessionState === 'READY' ||
    sessionState === 'LISTENING' ||
    sessionState === 'USER_SPEAKING' ||
    sessionState === 'REVA_SPEAKING' ||
    sessionState === 'INTERRUPTED';

  // Format main status text
  let statusTitle = 'OFFLINE';
  let statusSub = 'Click to activate voice session';
  let ringColor = 'border-zinc-800';

  switch (sessionState) {
    case 'CONNECTING':
      statusTitle = 'CONNECTING TO GEMINI LIVE...';
      statusSub = 'Establishing bidirectional audio channel';
      ringColor = 'border-amber-500/50 animate-pulse';
      break;
    case 'READY':
      statusTitle = 'REVA READY';
      statusSub = micState === 'ACTIVE' ? 'Listening for your voice...' : 'Activating microphone...';
      ringColor = 'border-emerald-500/50';
      break;
    case 'LISTENING':
      statusTitle = 'LISTENING';
      statusSub = 'Speak naturally, hands-free';
      ringColor = 'border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]';
      break;
    case 'USER_SPEAKING':
      statusTitle = 'USER SPEAKING';
      statusSub = 'Streaming audio to Gemini Live...';
      ringColor = 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]';
      break;
    case 'REVA_SPEAKING':
      statusTitle = 'REVA SPEAKING';
      statusSub = 'Streaming native audio (speak to interrupt)';
      ringColor = 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)]';
      break;
    case 'INTERRUPTED':
      statusTitle = 'INTERRUPTED';
      statusSub = 'Halting playback, returning to listening';
      ringColor = 'border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.4)]';
      break;
    case 'RECONNECTING':
      statusTitle = 'RECONNECTING...';
      statusSub = 'Re-establishing live link';
      ringColor = 'border-amber-400 animate-pulse';
      break;
    case 'ERROR':
      statusTitle = 'CONNECTION ERROR';
      statusSub = 'Check configuration or API keys';
      ringColor = 'border-rose-500';
      break;
    default:
      break;
  }

  // Active audio level computation (scaled bars)
  const activeLevel = sessionState === 'REVA_SPEAKING' ? revaAudioLevel : userAudioLevel;

  return (
    <div className="w-full max-w-xl flex flex-col items-center space-y-6">
      {/* Visual Audio Core */}
      <div className="relative flex flex-col items-center justify-center p-8 w-full">
        {/* Pulsing ring indicator */}
        <div
          className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-300 bg-zinc-900/60 backdrop-blur-md ${ringColor}`}
        >
          {sessionState === 'REVA_SPEAKING' ? (
            <div className="flex flex-col items-center space-y-2">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-bounce" />
              <span className="text-[11px] font-mono text-emerald-300 font-semibold tracking-wider">
                REVA
              </span>
            </div>
          ) : sessionState === 'USER_SPEAKING' ? (
            <div className="flex flex-col items-center space-y-2">
              <Mic className="w-8 h-8 text-cyan-400 animate-pulse" />
              <span className="text-[11px] font-mono text-cyan-300 font-semibold tracking-wider">
                YOU
              </span>
            </div>
          ) : isConnected ? (
            <div className="flex flex-col items-center space-y-2">
              <Volume2 className="w-8 h-8 text-zinc-400" />
              <span className="text-[11px] font-mono text-zinc-400 font-semibold tracking-wider">
                READY
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Power className="w-8 h-8 text-zinc-600" />
              <span className="text-[11px] font-mono text-zinc-600 font-semibold tracking-wider">
                IDLE
              </span>
            </div>
          )}

          {/* Real-time audio waveform activity bars */}
          {isConnected && (
            <div className="flex items-center gap-1 mt-2 h-4">
              {[0.4, 0.8, 1.0, 0.7, 0.5].map((multiplier, i) => {
                const heightPercent = Math.max(15, Math.min(100, activeLevel * 100 * multiplier));
                const barBg =
                  sessionState === 'REVA_SPEAKING'
                    ? 'bg-emerald-400'
                    : sessionState === 'USER_SPEAKING'
                    ? 'bg-cyan-400'
                    : 'bg-zinc-700';

                return (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-75 ${barBg}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* State Label & Personality Mode Badge */}
        <div className="mt-4 text-center space-y-1">
          <div
            id="voice-state-title"
            className="text-sm sm:text-base font-mono font-bold tracking-widest text-zinc-200"
          >
            {statusTitle}
          </div>
          <div id="voice-state-subtitle" className="text-xs font-mono text-zinc-400">
            {statusSub}
          </div>

          {isConnected && personality && (
            <div className="pt-2 flex items-center justify-center gap-2">
              <span
                id="voice-mode-pill"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-[11px] font-mono text-cyan-300"
              >
                <Heart className="w-3 h-3 text-cyan-400" />
                <span>Mode: {personality.mode}</span>
              </span>
              <span
                id="voice-user-state-pill"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-[11px] font-mono text-amber-300"
              >
                <span>You: {personality.userEmotion}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Conversation Control Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!isConnected ? (
          <button
            id="btn-start-voice"
            onClick={onStartVoice}
            disabled={sessionState === 'CONNECTING'}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-sm font-semibold tracking-wide transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>{sessionState === 'CONNECTING' ? 'CONNECTING...' : 'START VOICE CONVERSATION'}</span>
          </button>
        ) : (
          <>
            <button
              id="btn-toggle-mute"
              onClick={onToggleMute}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer ${
                micState === 'PAUSED'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {micState === 'PAUSED' ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              <span>{micState === 'PAUSED' ? 'UNMUTE MIC' : 'MUTE MIC'}</span>
            </button>

            {sessionState === 'REVA_SPEAKING' && (
              <button
                id="btn-interrupt"
                onClick={onInterrupt}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-900/60 border border-rose-500/50 text-rose-200 hover:bg-rose-800/70 font-mono text-xs transition-colors cursor-pointer animate-pulse"
                title="Barge-in / Stop REVA speaking"
              >
                <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                <span>INTERRUPT</span>
              </button>
            )}

            <button
              id="btn-disconnect-voice"
              onClick={onDisconnectVoice}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 font-mono text-xs transition-colors cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              <span>DISCONNECT</span>
            </button>
          </>
        )}
      </div>

      {/* Live Conversation Transcripts (if any dialogue occurred) */}
      {transcripts.length > 0 && (
        <div
          id="conversation-transcript-box"
          className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2.5 text-left text-xs font-mono"
        >
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1.5 flex justify-between">
            <span>Live Transcript Stream</span>
            <span>{transcripts.length} turns</span>
          </div>

          <div className="space-y-2 pt-1">
            {transcripts.slice(-6).map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">
                  {item.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`font-semibold ${item.role === 'user' ? 'text-cyan-300' : 'text-emerald-300'}`}>
                    {item.role === 'user' ? 'You: ' : 'REVA: '}
                  </span>
                  <span className="text-zinc-200 break-words">{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
