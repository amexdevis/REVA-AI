/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ServerStatus, GeminiStatus } from '../types/index.js';

interface StatusIndicatorProps {
  serverStatus: ServerStatus;
  geminiStatus: GeminiStatus;
  isLoading: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  serverStatus,
  geminiStatus,
  isLoading,
}) => {
  // Determine overall foundation state based on real metrics
  let bannerText = 'REVA FOUNDATION READY';
  let bannerStyle = 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
  let dotStyle = 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]';

  if (isLoading) {
    bannerText = 'CHECKING SYSTEM STATUS...';
    bannerStyle = 'bg-zinc-900 border-zinc-700 text-zinc-400';
    dotStyle = 'bg-zinc-500 animate-pulse';
  } else if (serverStatus === 'OFFLINE') {
    bannerText = 'SERVER OFFLINE';
    bannerStyle = 'bg-rose-950/60 border-rose-500/40 text-rose-300';
    dotStyle = 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]';
  } else if (geminiStatus === 'NOT CONFIGURED') {
    bannerText = 'GEMINI NOT CONFIGURED';
    bannerStyle = 'bg-amber-950/60 border-amber-500/40 text-amber-300';
    dotStyle = 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]';
  }

  return (
    <div
      id="status-banner"
      className={`inline-flex items-center gap-3 px-4 py-2 rounded-full border text-xs font-mono tracking-wider font-semibold transition-all duration-300 ${bannerStyle}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotStyle}`} />
      <span>{bannerText}</span>
    </div>
  );
};
