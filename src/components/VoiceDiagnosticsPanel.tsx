/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Terminal, Activity, Mic, Volume2, Sparkles, Radio, PlayCircle, AlertCircle } from 'lucide-react';
import { VoiceDiagnostics } from '../types/voice.types.js';

interface VoiceDiagnosticsPanelProps {
  diagnostics: VoiceDiagnostics;
  onTestConnection: () => void;
  onTestAudioOutput: () => void;
}

export const VoiceDiagnosticsPanel: React.FC<VoiceDiagnosticsPanelProps> = ({
  diagnostics,
  onTestConnection,
  onTestAudioOutput,
}) => {
  const isVoiceActive =
    diagnostics.revaVoiceState === 'READY' ||
    diagnostics.revaVoiceState === 'LISTENING' ||
    diagnostics.revaVoiceState === 'USER_SPEAKING' ||
    diagnostics.revaVoiceState === 'REVA_SPEAKING';

  const isGeminiConnected = diagnostics.geminiLiveState === 'CONNECTED';

  return (
    <div
      id="voice-diagnostics-panel"
      className="w-full max-w-xl bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-2xl backdrop-blur-md text-left"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-zinc-300 uppercase tracking-widest font-semibold">
            Voice & Emotional Engine Diagnostics
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Step 3: Natural Personality
        </span>
      </div>

      {/* Personality & Emotion Section (Step 3) */}
      <div className="mb-4 p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-800/90 font-mono space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800/70">
          <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
            Emotional Conversation State
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            Realtime Adaptive
          </span>
        </div>

        {/* High level states */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">REVA Mode</div>
            <div id="debug-reva-mode" className="font-bold text-cyan-300 mt-0.5">
              {diagnostics.personality?.mode || 'CASUAL'}
            </div>
          </div>

          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">User State</div>
            <div id="debug-user-emotion" className="font-bold text-amber-300 mt-0.5">
              {diagnostics.personality?.userEmotion || 'CALM'}
            </div>
          </div>

          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">Length Style</div>
            <div id="debug-response-length" className="font-bold text-emerald-300 mt-0.5">
              {diagnostics.personality?.responseLength || 'CONCISE'}
            </div>
          </div>

          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">Acoustic Core</div>
            <div className="font-bold text-indigo-300 mt-0.5 truncate" title="Aoede (Native Audio)">
              Aoede
            </div>
          </div>
        </div>

        {/* Response Style */}
        <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-zinc-900/50 border border-zinc-800/60">
          <span className="text-zinc-500">Cadence & Tone:</span>
          <span id="debug-response-style" className="text-zinc-300 font-medium">
            {diagnostics.personality?.responseStyle || 'Natural, conversational, attentive'}
          </span>
        </div>

        {/* 9 Dimensions Emotional Spectrum */}
        <div className="pt-2 border-t border-zinc-800/70">
          <div className="text-[10px] text-zinc-500 uppercase mb-2">REVA Emotion Dimensions</div>
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 text-[11px]">
            {diagnostics.personality?.revaEmotions &&
              Object.entries(diagnostics.personality.revaEmotions).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-zinc-400 text-[10px] capitalize">
                    <span>{key}</span>
                    <span className="text-zinc-200">{(val as number).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400/80 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, (val as number) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs mb-4">
        {/* REVA Voice State */}
        <div id="diag-reva-voice" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-400">
            <Radio className="w-3.5 h-3.5 text-zinc-500" />
            <span>REVA Voice</span>
          </div>
          <span
            className={`font-semibold ${
              isVoiceActive
                ? 'text-emerald-400'
                : diagnostics.revaVoiceState === 'ERROR'
                ? 'text-rose-400'
                : diagnostics.revaVoiceState === 'CONNECTING'
                ? 'text-amber-400'
                : 'text-zinc-500'
            }`}
          >
            {diagnostics.revaVoiceState}
          </span>
        </div>

        {/* Gemini Live State */}
        <div id="diag-gemini-live" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
            <span>Gemini Live</span>
          </div>
          <span
            className={`font-semibold ${
              isGeminiConnected
                ? 'text-emerald-400'
                : diagnostics.geminiLiveState === 'CONNECTING'
                ? 'text-amber-400'
                : 'text-zinc-500'
            }`}
          >
            {diagnostics.geminiLiveState}
          </span>
        </div>

        {/* Microphone State */}
        <div id="diag-mic-state" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-400">
            <Mic className="w-3.5 h-3.5 text-zinc-500" />
            <span>Microphone</span>
          </div>
          <span
            className={`font-semibold ${
              diagnostics.micState === 'ACTIVE'
                ? 'text-emerald-400'
                : diagnostics.micState === 'PAUSED'
                ? 'text-amber-400'
                : diagnostics.micState === 'DENIED'
                ? 'text-rose-400'
                : 'text-zinc-500'
            }`}
          >
            {diagnostics.micState}
          </span>
        </div>

        {/* Audio Input State */}
        <div id="diag-audio-in" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
            <span>Audio Input</span>
          </div>
          <span
            className={`font-semibold ${
              diagnostics.audioInState === 'ACTIVE'
                ? 'text-emerald-400'
                : diagnostics.audioInState === 'ERROR'
                ? 'text-rose-400'
                : 'text-zinc-500'
            }`}
          >
            {diagnostics.audioInState}
          </span>
        </div>

        {/* Audio Output State */}
        <div id="diag-audio-out" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-400">
            <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Audio Output</span>
          </div>
          <span
            className={`font-semibold ${
              diagnostics.audioOutState === 'ACTIVE'
                ? 'text-emerald-400'
                : diagnostics.audioOutState === 'ERROR'
                ? 'text-rose-400'
                : 'text-zinc-500'
            }`}
          >
            {diagnostics.audioOutState}
          </span>
        </div>

        {/* Current Model */}
        <div id="diag-model" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <span className="text-zinc-400">Model</span>
          <span className="font-semibold text-zinc-300 truncate max-w-[130px]" title={diagnostics.currentModel}>
            {diagnostics.currentModel}
          </span>
        </div>

        {/* Stored Memory Count */}
        <div id="diag-memory-count" className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-zinc-800/80">
          <span className="text-zinc-400">Memory DB</span>
          <span className="font-semibold text-cyan-300">
            {diagnostics.memoryCount ?? 0} facts
          </span>
        </div>
      </div>

      {/* Meta events info */}
      <div className="space-y-1.5 p-3 rounded bg-zinc-950/90 border border-zinc-800/90 font-mono text-[11px]">
        <div className="flex justify-between text-zinc-400">
          <span>Last Event:</span>
          <span className="text-cyan-400 font-semibold">{diagnostics.lastEvent}</span>
        </div>

        {diagnostics.closeCode !== null && (
          <div className="flex justify-between text-zinc-400">
            <span>Close Code / Reason:</span>
            <span className="text-amber-400">
              {diagnostics.closeCode} {diagnostics.closeReason ? `(${diagnostics.closeReason})` : ''}
            </span>
          </div>
        )}

        {diagnostics.lastError && (
          <div className="flex items-start gap-2 pt-1 text-rose-300 border-t border-zinc-800">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
            <span className="break-all">{diagnostics.lastError}</span>
          </div>
        )}
      </div>

      {/* Diagnostic Actions */}
      <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2">
        <button
          id="btn-test-ws-connect"
          onClick={onTestConnection}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors cursor-pointer"
        >
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span>Test Live Link</span>
        </button>

        <button
          id="btn-test-spoken-output"
          onClick={onTestAudioOutput}
          disabled={!isGeminiConnected}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Test Spoken Audio</span>
        </button>
      </div>
    </div>
  );
};
