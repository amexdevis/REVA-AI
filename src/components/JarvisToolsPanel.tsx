/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  Clock,
  Terminal,
  FileText,
  Timer,
  ExternalLink,
  Clipboard,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  Layers,
  Shield,
  Zap,
  Monitor,
} from 'lucide-react';
import {
  ToolDefinition,
  ToolExecutionResult,
  SystemStatusData,
  NoteItem,
  TimerItem,
} from '../types/voice.types.js';

interface JarvisToolsPanelProps {
  tools: ToolDefinition[];
  systemStatus: SystemStatusData | null;
  toolHistory: ToolExecutionResult[];
  notes: NoteItem[];
  timers: TimerItem[];
  clipboardText: string;
  isLoading: boolean;
  onRefreshAll: () => void;
  onExecuteTool: (toolName: string, args?: Record<string, any>) => Promise<ToolExecutionResult>;
  onCreateNote: (content: string, title?: string, tags?: string[]) => Promise<any>;
  onDeleteNote: (idOrTitle: string) => Promise<any>;
  onSetTimer: (durationSeconds?: number, minutes?: number, label?: string) => Promise<any>;
  onCancelTimer: (idOrLabel: string) => Promise<any>;
}

export const JarvisToolsPanel: React.FC<JarvisToolsPanelProps> = ({
  tools,
  systemStatus,
  toolHistory,
  notes,
  timers,
  clipboardText,
  isLoading,
  onRefreshAll,
  onExecuteTool,
  onCreateNote,
  onDeleteNote,
  onSetTimer,
  onCancelTimer,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'vitals' | 'timers' | 'notes' | 'history' | 'catalog'>('vitals');
  
  // Custom tool test state
  const [testToolName, setTestToolName] = useState<string>('get_system_status');
  const [testToolArgs, setTestToolArgs] = useState<string>('{}');
  const [testResult, setTestResult] = useState<ToolExecutionResult | null>(null);
  const [isExecutingTest, setIsExecutingTest] = useState<boolean>(false);

  // Note form state
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteTags, setNewNoteTags] = useState<string>('');

  // Timer form state
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [timerLabel, setTimerLabel] = useState<string>('Focus Session');

  // File search state
  const [fileSearchQuery, setFileSearchQuery] = useState<string>('tsx');

  const handleRunManualTool = async () => {
    try {
      setIsExecutingTest(true);
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(testToolArgs);
      } catch {
        parsedArgs = { query: testToolArgs };
      }
      const res = await onExecuteTool(testToolName, parsedArgs);
      setTestResult(res);
    } finally {
      setIsExecutingTest(false);
    }
  };

  const handleCreateNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    const tagList = newNoteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await onCreateNote(newNoteContent, newNoteTitle || undefined, tagList.length ? tagList : undefined);
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewNoteTags('');
  };

  const handleSetTimerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timerSeconds <= 0) return;
    await onSetTimer(timerSeconds, undefined, timerLabel || 'Timer');
    setTimerLabel('Quick Timer');
  };

  return (
    <div
      id="jarvis-tools-panel-root"
      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-6 text-left space-y-6 shadow-xl"
    >
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-semibold text-zinc-100 font-sans">
              JARVIS System Awareness & Tool Engine
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Real host inspection, file queries, timers, clipboard sync & application dispatch
          </p>
        </div>

        <button
          id="btn-refresh-tools"
          onClick={onRefreshAll}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-950/60 border border-zinc-800/80 rounded-lg text-xs font-mono">
        <button
          id="subtab-vitals"
          onClick={() => setActiveSubTab('vitals')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'vitals'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>System Vitals</span>
        </button>

        <button
          id="subtab-timers"
          onClick={() => setActiveSubTab('timers')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'timers'
              ? 'bg-amber-950 text-amber-300 border border-amber-500/40 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Timer className="w-3.5 h-3.5" />
          <span>Timers ({timers.filter((t) => t.status === 'RUNNING').length})</span>
        </button>

        <button
          id="subtab-notes"
          onClick={() => setActiveSubTab('notes')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'notes'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes ({notes.length})</span>
        </button>

        <button
          id="subtab-history"
          onClick={() => setActiveSubTab('history')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Execution Log ({toolHistory.length})</span>
        </button>

        <button
          id="subtab-catalog"
          onClick={() => setActiveSubTab('catalog')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'catalog'
              ? 'bg-blue-950 text-blue-300 border border-blue-500/40 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Tool Catalog ({tools.length})</span>
        </button>
      </div>

      {/* 1. SYSTEM VITALS SUBPANEL */}
      {activeSubTab === 'vitals' && (
        <div className="space-y-4">
          {/* Quick Voice Simulation Buttons */}
          <div className="p-3.5 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-2">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Quick Voice Command Simulators
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onExecuteTool('get_system_status', {})}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Cpu className="w-3 h-3" /> "What's my system status?"
              </button>
              <button
                onClick={() => onExecuteTool('get_current_time', {})}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clock className="w-3 h-3" /> "What time is it?"
              </button>
              <button
                onClick={() => onExecuteTool('get_active_application', {})}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Monitor className="w-3 h-3" /> "What window is open?"
              </button>
              <button
                onClick={() => onExecuteTool('open_website', { url: 'https://github.com' })}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" /> "Open GitHub"
              </button>
              <button
                onClick={() => onExecuteTool('read_clipboard', {})}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clipboard className="w-3 h-3" /> "Read my clipboard"
              </button>
              <button
                onClick={() => onExecuteTool('search_files', { query: fileSearchQuery })}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Search className="w-3 h-3" /> "Find project files"
              </button>
            </div>
          </div>

          {/* Vitals Grid */}
          {systemStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* CPU & Platform */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Host & CPU
                  </span>
                  <span className="text-zinc-500">{systemStatus.architecture}</span>
                </div>
                <div className="text-sm font-semibold text-zinc-100 truncate">
                  {systemStatus.platform} ({systemStatus.hostname})
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  {systemStatus.cpuCount} Cores • Load: {systemStatus.loadAverage?.map((n) => n.toFixed(2)).join(', ') || 'N/A'}
                </div>
              </div>

              {/* Memory RAM */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> RAM Memory
                  </span>
                  <span className="text-emerald-400 font-semibold">{systemStatus.memoryUsagePercentage}%</span>
                </div>
                <div className="text-sm font-semibold text-zinc-100">
                  {systemStatus.usedMemoryMb} MB / {systemStatus.totalMemoryMb} MB
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, systemStatus.memoryUsagePercentage)}%` }}
                  />
                </div>
              </div>

              {/* Uptime */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> System Uptime
                  </span>
                </div>
                <div className="text-sm font-semibold text-zinc-100">
                  {systemStatus.uptimeFormatted}
                </div>
                <div className="text-xs font-mono text-zinc-400 truncate">
                  {systemStatus.currentTime}
                </div>
              </div>

              {/* Active Workspace */}
              <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-purple-400" /> Workspace
                  </span>
                </div>
                <div className="text-sm font-semibold text-zinc-100 truncate">
                  {systemStatus.activeWindow || 'REVA Active Window'}
                </div>
                <div className="text-xs font-mono text-zinc-400 truncate">
                  Clipboard: {clipboardText ? `"${clipboardText.substring(0, 20)}..."` : '(empty buffer)'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-zinc-500 bg-zinc-950/50 rounded-lg border border-zinc-800">
              Loading system metrics...
            </div>
          )}

          {/* Interactive Manual Tester */}
          <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-3">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Custom Tool Invocation Tester
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                id="select-tool-name"
                value={testToolName}
                onChange={(e) => setTestToolName(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
              >
                {tools.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.permission})
                  </option>
                ))}
              </select>

              <input
                id="input-tool-args"
                type="text"
                value={testToolArgs}
                onChange={(e) => setTestToolArgs(e.target.value)}
                placeholder='JSON arguments: {"query": "test"}'
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500 sm:col-span-2"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                id="btn-run-manual-tool"
                onClick={handleRunManualTool}
                disabled={isExecutingTest}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isExecutingTest ? 'Executing Real Tool...' : 'Execute Tool'}</span>
              </button>

              {testResult && (
                <span
                  className={`text-xs font-mono flex items-center gap-1 ${
                    testResult.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {testResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {testResult.success ? `Done (${testResult.executionTimeMs}ms)` : 'Failed'}
                </span>
              )}
            </div>

            {testResult && (
              <pre className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto max-h-48">
                {JSON.stringify(testResult.result || { error: testResult.error }, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* 2. TIMERS SUBPANEL */}
      {activeSubTab === 'timers' && (
        <div className="space-y-4">
          {/* Quick Presets & Creator Form */}
          <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-3">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Set Real Countdown Timer
            </span>

            <div className="flex flex-wrap gap-2">
              {[
                { label: '30s Quick', sec: 30 },
                { label: '1m Tea', sec: 60 },
                { label: '5m Break', sec: 300 },
                { label: '15m Code', sec: 900 },
                { label: '25m Pomodoro', sec: 1500 },
              ].map((p) => (
                <button
                  key={p.sec}
                  onClick={() => onSetTimer(p.sec, undefined, p.label)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded text-xs font-mono transition-colors cursor-pointer"
                >
                  +{p.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSetTimerSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <input
                type="number"
                min="5"
                max="86400"
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(parseInt(e.target.value, 10) || 60)}
                placeholder="Duration (seconds)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={timerLabel}
                onChange={(e) => setTimerLabel(e.target.value)}
                placeholder="Timer label (e.g. Focus Session)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Set Timer
              </button>
            </form>
          </div>

          {/* Timers List */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Active & Recent Timers ({timers.length})
            </span>

            {timers.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-zinc-500 bg-zinc-950/50 rounded-lg border border-zinc-800">
                No active timers. Ask REVA "Set a timer for 5 minutes" or click a preset above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {timers.map((timer) => (
                  <div
                    key={timer.id}
                    className={`p-3.5 rounded-lg border flex items-center justify-between ${
                      timer.status === 'RUNNING'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : timer.status === 'COMPLETED'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{timer.label}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            timer.status === 'RUNNING'
                              ? 'bg-amber-950 text-amber-400 border border-amber-500/40 animate-pulse'
                              : timer.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {timer.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400">
                        Duration: {timer.durationSeconds}s • Ends: {new Date(timer.endsAt).toLocaleTimeString()}
                      </div>
                    </div>

                    {timer.status === 'RUNNING' && (
                      <button
                        onClick={() => onCancelTimer(timer.id)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-300 rounded text-xs font-mono transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. NOTES SUBPANEL */}
      {activeSubTab === 'notes' && (
        <div className="space-y-4">
          {/* Create Note Form */}
          <form onSubmit={handleCreateNoteSubmit} className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2.5">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Save Persistent Note
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title (optional)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
                placeholder="Tags comma separated (e.g. project, idea)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <textarea
              rows={2}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Note content to remember..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Save Note
            </button>
          </form>

          {/* Notes Cards */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Saved Notes ({notes.length})
            </span>

            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-zinc-500 bg-zinc-950/50 rounded-lg border border-zinc-800">
                No notes saved. Say "REVA, take a note that..." or add one above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 rounded-lg space-y-2 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-zinc-100 font-sans">{note.title}</h4>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="text-zinc-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-zinc-300 whitespace-pre-wrap">{note.content}</p>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-500">
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1">
                          {note.tags.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. EXECUTION HISTORY SUBPANEL */}
      {activeSubTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Real-time Tool Invocation History
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {toolHistory.length} executed calls
            </span>
          </div>

          {toolHistory.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-zinc-500 bg-zinc-950/50 rounded-lg border border-zinc-800">
              No tool executions recorded yet. Give a voice command to REVA.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {toolHistory.map((item) => (
                <div
                  key={item.executionId}
                  className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.success ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className="font-semibold text-zinc-100">{item.tool}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          item.permission === 'READ_ONLY'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                            : item.permission === 'REVERSIBLE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : item.permission === 'SENSITIVE'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {item.permission}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
                      <span>{item.executionTimeMs}ms</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {item.args && Object.keys(item.args).length > 0 && (
                    <div className="text-zinc-400 text-[11px] truncate">
                      Args: {JSON.stringify(item.args)}
                    </div>
                  )}

                  {item.error ? (
                    <div className="text-rose-400 text-[11px]">Error: {item.error}</div>
                  ) : item.result ? (
                    <div className="text-zinc-300 text-[11px] truncate">
                      Output: {typeof item.result === 'object' ? JSON.stringify(item.result) : String(item.result)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. TOOL CATALOG SUBPANEL */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-3">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
            Registered Typed System Tools ({tools.length})
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-cyan-300">{tool.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      tool.permission === 'READ_ONLY'
                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                        : tool.permission === 'REVERSIBLE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : tool.permission === 'SENSITIVE'
                        ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {tool.permission}
                  </span>
                </div>

                <p className="text-xs text-zinc-300">{tool.description}</p>

                {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60 truncate">
                    Params: {Object.keys(tool.parameters).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
