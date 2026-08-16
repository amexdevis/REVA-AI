/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RefreshCw, Server, Sparkles, Terminal, Cpu } from 'lucide-react';
import { SystemStatusState } from '../types/index.js';

interface TechnicalDetailsProps {
  status: SystemStatusState;
  onRefresh: () => void;
}

export const TechnicalDetails: React.FC<TechnicalDetailsProps> = ({
  status,
  onRefresh,
}) => {
  const isServerOnline = status.serverStatus === 'ONLINE';
  const isGeminiConfigured = status.geminiStatus === 'CONFIGURED';

  return (
    <div
      id="technical-status-card"
      className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
            System Diagnostics
          </span>
        </div>
        <button
          id="btn-refresh-status"
          onClick={onRefresh}
          disabled={status.isLoading}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 font-mono cursor-pointer"
          title="Recheck System Status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status.isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-3 font-mono text-xs">
        {/* Server Status */}
        <div id="row-server-status" className="flex items-center justify-between py-1.5 px-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-300">
            <Server className="w-3.5 h-3.5 text-zinc-500" />
            <span>Server</span>
          </div>
          <span
            id="val-server-status"
            className={`font-semibold ${
              isServerOnline
                ? 'text-emerald-400'
                : status.serverStatus === 'CHECKING'
                ? 'text-zinc-500'
                : 'text-rose-400'
            }`}
          >
            {status.serverStatus}
          </span>
        </div>

        {/* Gemini Status */}
        <div id="row-gemini-status" className="flex items-center justify-between py-1.5 px-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
            <span>Gemini</span>
          </div>
          <span
            id="val-gemini-status"
            className={`font-semibold ${
              isGeminiConfigured
                ? 'text-emerald-400'
                : status.geminiStatus === 'CHECKING'
                ? 'text-zinc-500'
                : 'text-amber-400'
            }`}
          >
            {status.geminiStatus}
          </span>
        </div>

        {/* Environment */}
        <div id="row-environment" className="flex items-center justify-between py-1.5 px-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-300">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span>Environment</span>
          </div>
          <span id="val-environment" className="font-semibold text-zinc-300">
            {status.environment}
          </span>
        </div>

        {/* Application Status */}
        <div id="row-application-status" className="flex items-center justify-between py-1.5 px-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-zinc-300">
            <Cpu className="w-3.5 h-3.5 text-zinc-500" />
            <span>Application</span>
          </div>
          <span
            id="val-application-status"
            className={`font-semibold ${
              status.applicationReady ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            {status.applicationReady ? 'READY' : 'INITIALIZING'}
          </span>
        </div>
      </div>

      {status.lastChecked && (
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>Last probe</span>
          <span>{status.lastChecked}</span>
        </div>
      )}

      {status.error && (
        <div
          id="error-diagnostic-box"
          className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-800/50 text-[11px] text-rose-300 font-mono"
        >
          {status.error}
        </div>
      )}
    </div>
  );
};
