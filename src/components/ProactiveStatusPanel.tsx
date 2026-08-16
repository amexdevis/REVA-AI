/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Eye,
  Clock,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Terminal,
  Laptop,
} from 'lucide-react';
import { useRevaProactive } from '../hooks/useRevaProactive.js';
import { ProactiveEventType } from '../types/voice.types.js';

interface ProactiveStatusPanelProps {
  onSpeakProactive?: (type: ProactiveEventType, context?: Record<string, any>) => void;
}

export const ProactiveStatusPanel: React.FC<ProactiveStatusPanelProps> = ({ onSpeakProactive }) => {
  const {
    settings,
    diagnostics,
    isLoading,
    idleSeconds,
    sessionActiveMinutes,
    currentApp,
    setCurrentApp,
    updateSettings,
    triggerEvent,
    refreshDiagnostics,
  } = useRevaProactive({
    onProactiveTrigger: onSpeakProactive,
  });

  const [testApp, setTestApp] = useState('VS Code');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSimulate = async (type: ProactiveEventType, context: Record<string, any> = {}) => {
    setTestResult('Evaluating event...');
    const res = await triggerEvent(type, context);
    if (res) {
      if (res.decision === 'SPEAK') {
        setTestResult(`Decision: SPEAK ("${res.speechText || 'Observation'}")`);
      } else {
        setTestResult(`Decision: REMAIN_SILENT (${res.reason})`);
      }
    } else {
      setTestResult('Event processed.');
    }
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div id="proactive-status-panel" className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-2xl backdrop-blur-md">
      {/* Header & Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              Proactive Companion Engine
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                Step 5 Active
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Observes contextual activity and naturally initiates speech when meaningful
            </p>
          </div>
        </div>

        {/* Live Privacy Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            id="badge-proactive-mode"
            className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 border ${
              settings.proactiveMode
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            PROACTIVE: {settings.proactiveMode ? 'ON' : 'OFF'}
          </span>

          <span
            id="badge-quiet-mode"
            className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 border ${
              settings.quietMode
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 animate-pulse'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {settings.quietMode ? <VolumeX className="w-3 h-3 text-amber-400" /> : <Volume2 className="w-3 h-3" />}
            QUIET MODE: {settings.quietMode ? 'ON' : 'OFF'}
          </span>

          <span
            id="badge-activity-awareness"
            className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 border ${
              settings.activityAwareness
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Activity className="w-3 h-3" />
            ACTIVITY: {settings.activityAwareness ? 'ON' : 'OFF'}
          </span>

          <span
            id="badge-app-awareness"
            className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 border ${
              settings.applicationAwareness
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Layers className="w-3 h-3" />
            APP AWARENESS: {settings.applicationAwareness ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Main Grid: Controls & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: User Settings & Toggles */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Companion Privacy & Mode Settings
            </h4>

            {/* Master Proactive Toggle */}
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <div>
                <p className="text-sm font-medium text-white">Proactive Mode</p>
                <p className="text-xs text-slate-400">Allow REVA to initiate speech when relevant</p>
              </div>
              <button
                id="toggle-proactive-mode"
                onClick={() => updateSettings({ proactiveMode: !settings.proactiveMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.proactiveMode ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.proactiveMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Quiet Mode Toggle */}
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <div>
                <p className="text-sm font-medium text-amber-300 flex items-center gap-1.5">
                  <VolumeX className="w-3.5 h-3.5" />
                  Quiet Mode
                </p>
                <p className="text-xs text-slate-400">Never initiate speech, only answer when you talk</p>
              </div>
              <button
                id="toggle-quiet-mode"
                onClick={() => updateSettings({ quietMode: !settings.quietMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.quietMode ? 'bg-amber-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.quietMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Activity Awareness Toggle */}
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <div>
                <p className="text-sm font-medium text-white">Activity Awareness</p>
                <p className="text-xs text-slate-400">Observe idle periods and user returns</p>
              </div>
              <button
                id="toggle-activity-awareness"
                onClick={() => updateSettings({ activityAwareness: !settings.activityAwareness })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.activityAwareness ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.activityAwareness ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Application Awareness Toggle */}
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <div>
                <p className="text-sm font-medium text-white">Application Awareness</p>
                <p className="text-xs text-slate-400">Observe workspace focus events (VS Code, Chrome)</p>
              </div>
              <button
                id="toggle-app-awareness"
                onClick={() => updateSettings({ applicationAwareness: !settings.applicationAwareness })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.applicationAwareness ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.applicationAwareness ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Long Session Awareness Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Long Session Awareness</p>
                <p className="text-xs text-slate-400">Notice continuous deep work durations</p>
              </div>
              <button
                id="toggle-long-session"
                onClick={() => updateSettings({ longSessionAwareness: !settings.longSessionAwareness })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.longSessionAwareness ? 'bg-purple-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.longSessionAwareness ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Privacy Guarantee Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Privacy Safeguard:</span> REVA does not take screenshots, upload screen recordings, or spy on keystrokes. Observation is strictly event-driven and local.
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Diagnostics & Event Simulator */}
        <div className="lg:col-span-7 space-y-4">
          {/* Real-time Activity Context Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <span className="text-[11px] text-slate-400 uppercase font-mono block">Inactivity</span>
              <span id="metric-idle-seconds" className="text-base font-semibold font-mono text-cyan-400">
                {idleSeconds}s
              </span>
              <span className="text-[10px] text-slate-500 block">Thresh: {settings.idleThresholdSeconds}s</span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <span className="text-[11px] text-slate-400 uppercase font-mono block">Work Session</span>
              <span id="metric-session-minutes" className="text-base font-semibold font-mono text-emerald-400">
                {sessionActiveMinutes} min
              </span>
              <span className="text-[10px] text-slate-500 block">Thresh: {settings.longSessionThresholdMinutes}m</span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <span className="text-[11px] text-slate-400 uppercase font-mono block">Cooldown Left</span>
              <span id="metric-cooldown" className="text-base font-semibold font-mono text-amber-400">
                {diagnostics?.cooldownRemainingSeconds ? `${diagnostics.cooldownRemainingSeconds}s` : '0s (Ready)'}
              </span>
              <span className="text-[10px] text-slate-500 block">Interval: {Math.round(settings.minimumProactiveIntervalSeconds / 60)}m</span>
            </div>
          </div>

          {/* Developer Diagnostic Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Proactive Decision Log
              </span>
              <button
                onClick={refreshDiagnostics}
                className="hover:text-white flex items-center gap-1 text-[11px]"
              >
                <RotateCcw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {diagnostics?.lastDecision ? (
              <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EVENT:</span>
                  <span className="text-cyan-300 font-semibold">{diagnostics.lastEvent?.type || 'USER_IDLE'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">IMPORTANCE:</span>
                  <span className="text-indigo-300 font-semibold">
                    {diagnostics.lastDecision.importanceScore.toFixed(2)} / 1.00
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">DECISION:</span>
                  <span
                    id="diag-last-decision"
                    className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      diagnostics.lastDecision.decision === 'SPEAK'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {diagnostics.lastDecision.decision}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">REASON:</span>
                  <span className="text-slate-300 text-right truncate max-w-[240px]">
                    {diagnostics.lastDecision.reason}
                  </span>
                </div>
                {diagnostics.lastDecision.speechText && (
                  <div className="mt-2 p-2 bg-emerald-950/30 border border-emerald-800/40 rounded text-emerald-200">
                    <span className="text-slate-400 block text-[10px] uppercase">Generated Observation:</span>
                    "{diagnostics.lastDecision.speechText}"
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 py-3 text-center">
                Waiting for context events (Idle, Application change, Return)...
              </div>
            )}
          </div>

          {/* Interactive Event Simulator */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                Event Simulator (Acceptance Testing)
              </h4>
              {testResult && <span className="text-xs text-amber-300 truncate max-w-[200px]">{testResult}</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                id="btn-simulate-return"
                onClick={() => handleSimulate('USER_RETURNED', { awayMinutes: 20, application: testApp })}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-200 text-left transition-colors"
              >
                👋 User Returned (20m)
              </button>

              <button
                id="btn-simulate-long-work"
                onClick={() => handleSimulate('LONG_WORK_SESSION', { hours: 2, application: testApp })}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-200 text-left transition-colors"
              >
                ⏱️ Long Work (2h)
              </button>

              <button
                id="btn-simulate-app-change"
                onClick={() => {
                  const apps = ['VS Code', 'Chrome', 'Figma', 'Terminal'];
                  const nextApp = apps[(apps.indexOf(testApp) + 1) % apps.length];
                  setTestApp(nextApp);
                  setCurrentApp(nextApp);
                  handleSimulate('APPLICATION_CHANGED', { previous: testApp, current: nextApp });
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-200 text-left transition-colors"
              >
                💻 App: {testApp}
              </button>

              <button
                id="btn-simulate-task-done"
                onClick={() => handleSimulate('TASK_COMPLETED', { task: 'Voice memory integration' })}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-200 text-left transition-colors"
              >
                ✅ Task Completed
              </button>

              <button
                id="btn-simulate-timer-done"
                onClick={() => handleSimulate('TIMER_COMPLETED', { label: 'Deep Focus Sprint' })}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-200 text-left transition-colors"
              >
                ⏰ Timer Completed
              </button>

              <button
                id="btn-simulate-time-context"
                onClick={() => handleSimulate('TIME_CONTEXT', { hour: new Date().getHours() })}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-medium text-slate-200 text-left transition-colors"
              >
                🌅 Time-of-Day Check
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
