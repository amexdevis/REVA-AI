/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sparkles, Volume2, ShieldCheck, Activity, Database, Cpu } from 'lucide-react';
import { ProactiveSettings, VoiceDiagnostics, SystemStatusData } from '../types/voice.types.js';

interface RevaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: VoiceDiagnostics;
  proactiveSettings?: ProactiveSettings;
  systemStatus?: SystemStatusData | null;
  onUpdateProactiveSettings?: (settings: Partial<ProactiveSettings>) => void;
  onUpdateContextSettings?: (settings: Partial<{
    contextAwarenessEnabled: boolean;
    timeAwarenessEnabled: boolean;
    applicationContextEnabled: boolean;
    autoTopicTracking: boolean;
  }>) => void;
  onTestGreeting?: () => void;
}

export const RevaSettingsModal: React.FC<RevaSettingsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  proactiveSettings,
  systemStatus,
  onUpdateProactiveSettings,
  onUpdateContextSettings,
  onTestGreeting,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'proactive' | 'system' | 'dev'>('general');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-xl bg-[#0e081c] border border-purple-800/60 rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.3)] flex flex-col overflow-hidden text-zinc-100 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-purple-950/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-medium tracking-wide text-purple-100">REVA Companion Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-purple-950 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab('general')}
            className={`pb-2.5 px-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'general'
                ? 'border-purple-400 text-purple-200 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            General & Voice
          </button>
          <button
            onClick={() => setActiveSubTab('proactive')}
            className={`pb-2.5 px-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'proactive'
                ? 'border-purple-400 text-purple-200 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Proactive Mode
          </button>
          <button
            onClick={() => setActiveSubTab('system')}
            className={`pb-2.5 px-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'system'
                ? 'border-purple-400 text-purple-200 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            System Awareness
          </button>
          <button
            onClick={() => setActiveSubTab('dev')}
            className={`pb-2.5 px-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'dev'
                ? 'border-purple-400 text-purple-200 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Diagnostics
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4 text-xs font-mono">
          {activeSubTab === 'general' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium">Voice & Persona</span>
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px]">
                    Aoede (Female)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-zinc-500 block">Identity</span>
                    <span className="text-zinc-200">Female AI Companion</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Pronouns</span>
                    <span className="text-zinc-200">She / Her</span>
                  </div>
                </div>
                <p className="text-zinc-400 text-[11px] pt-1">
                  Tone: Warm, mature, intelligent, and natural conversational cadence.
                </p>
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium">Gemini Live Realtime Voice</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                    {diagnostics.geminiLiveState}
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Model: {diagnostics.currentModel} (Bidirectional Audio / PCM 24kHz)
                </p>
                {onTestGreeting && (
                  <button
                    onClick={onTestGreeting}
                    className="mt-2 px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Test Voice Greeting Output
                  </button>
                )}
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl space-y-2">
                <span className="text-zinc-300 font-medium">Barge-in / Interruption</span>
                <p className="text-zinc-400 text-[11px]">
                  Natural interruption is enabled. You can simply speak over REVA to interrupt, or tap the central
                  holographic ring.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'proactive' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl">
                <div>
                  <span className="text-zinc-200 font-medium">Proactive Autonomous Speech</span>
                  <p className="text-zinc-400 text-[11px]">Allow REVA to speak naturally during quiet pauses</p>
                </div>
                <input
                  type="checkbox"
                  checked={proactiveSettings?.proactiveMode ?? true}
                  onChange={(e) => onUpdateProactiveSettings?.({ proactiveMode: e.target.checked })}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl">
                <div>
                  <span className="text-zinc-200 font-medium">Quiet / Focus Mode</span>
                  <p className="text-zinc-400 text-[11px]">Suppress proactive speech while studying or coding</p>
                </div>
                <input
                  type="checkbox"
                  checked={proactiveSettings?.quietMode ?? false}
                  onChange={(e) => onUpdateProactiveSettings?.({ quietMode: e.target.checked })}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl">
                <div>
                  <span className="text-zinc-200 font-medium">Long Session Wellness Alerts</span>
                  <p className="text-zinc-400 text-[11px]">Gentle posture and break check-ins</p>
                </div>
                <input
                  type="checkbox"
                  checked={proactiveSettings?.longSessionAwareness ?? true}
                  onChange={(e) => onUpdateProactiveSettings?.({ longSessionAwareness: e.target.checked })}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'system' && (
            <div className="space-y-3">
              {/* Context Awareness Master Toggle */}
              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl">
                <div>
                  <span className="text-zinc-200 font-medium">Smart Context Awareness Engine</span>
                  <p className="text-zinc-400 text-[11px]">Continuously tracks conversation topics, active tasks, and environment</p>
                </div>
                <input
                  id="toggle-context-awareness"
                  type="checkbox"
                  checked={diagnostics.context?.awarenessStatus !== 'OFF'}
                  onChange={(e) => onUpdateContextSettings?.({ contextAwarenessEnabled: e.target.checked })}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Time Awareness Toggle */}
              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl">
                <div>
                  <span className="text-zinc-200 font-medium">Time & Day Awareness</span>
                  <p className="text-zinc-400 text-[11px]">Adapts greetings and advice to morning, afternoon, night, and weekend routines</p>
                </div>
                <input
                  id="toggle-time-awareness"
                  type="checkbox"
                  defaultChecked={true}
                  onChange={(e) => onUpdateContextSettings?.({ timeAwarenessEnabled: e.target.checked })}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* System Awareness Status Card */}
              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl space-y-2">
                <span className="text-zinc-200 font-medium">System Telemetry</span>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-zinc-400">
                  <div>Platform: {systemStatus?.platform || 'Linux'}</div>
                  <div>Cores: {systemStatus?.cpuCount || '4'}</div>
                  <div>
                    Memory: {systemStatus ? `${systemStatus.usedMemoryMb} / ${systemStatus.totalMemoryMb} MB` : 'Optimal'}
                  </div>
                  <div>Uptime: {systemStatus?.uptimeFormatted || 'Active'}</div>
                </div>
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl">
                <span className="text-zinc-200 font-medium">Voice System Control</span>
                <p className="text-zinc-400 text-[11px] mt-1">
                  System tools operate completely hands-free via natural conversation (e.g. &quot;REVA, open Chrome&quot;,
                  &quot;Set a 10 minute timer&quot;, &quot;What&apos;s my system status?&quot;).
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'dev' && (
            <div className="space-y-2 text-zinc-400 text-[11px]">
              {/* Context Awareness Diagnostics */}
              <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/60 space-y-1.5">
                <div className="flex justify-between font-semibold text-purple-300 pb-1 border-b border-purple-900/60">
                  <span>Context Awareness Engine:</span>
                  <span className={diagnostics.context?.awarenessStatus === 'ON' ? 'text-emerald-400' : 'text-amber-400'}>
                    {diagnostics.context?.awarenessStatus || 'ON'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Active Topic:</span>
                  <span className="text-zinc-200 font-medium truncate max-w-[240px]" title={diagnostics.context?.currentTopic}>
                    {diagnostics.context?.currentTopic || 'General conversation'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Active Task:</span>
                  <span className="text-zinc-200 font-medium truncate max-w-[240px]" title={diagnostics.context?.currentTask}>
                    {diagnostics.context?.currentTask || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Active Application:</span>
                  <span className="text-zinc-200 font-medium truncate max-w-[240px]">
                    {diagnostics.context?.activeApp || 'REVA Companion UI'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">User State:</span>
                  <span className="text-cyan-300 font-medium">
                    {diagnostics.context?.userState || 'ACTIVE_ENGAGEMENT'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Memory Count:</span>
                  <span className="text-emerald-400 font-medium">
                    {diagnostics.memoryCount ?? diagnostics.context?.memoryCount ?? 0} facts stored
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Last Event:</span>
                  <span className="text-purple-300 font-medium truncate max-w-[240px]">
                    {diagnostics.context?.lastEvent || diagnostics.lastEvent}
                  </span>
                </div>
              </div>

              <div className="p-2 bg-black/40 rounded border border-purple-950 flex justify-between">
                <span>Voice State:</span>
                <span className="text-purple-300">{diagnostics.revaVoiceState}</span>
              </div>
              <div className="p-2 bg-black/40 rounded border border-purple-950 flex justify-between">
                <span>Microphone:</span>
                <span className="text-purple-300">{diagnostics.micState}</span>
              </div>
              <div className="p-2 bg-black/40 rounded border border-purple-950 flex justify-between">
                <span>Audio In/Out:</span>
                <span className="text-purple-300">
                  {diagnostics.audioInState} / {diagnostics.audioOutState}
                </span>
              </div>
              <div className="p-2 bg-black/40 rounded border border-purple-950 flex justify-between">
                <span>Dominant Emotion:</span>
                <span className="text-purple-300">{diagnostics.personality.dominantEmotion}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-purple-900/30 bg-purple-950/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded-lg text-xs font-mono transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
