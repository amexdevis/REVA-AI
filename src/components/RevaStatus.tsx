/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoiceSessionState } from '../types/voice.types.js';

interface RevaStatusProps {
  sessionState: VoiceSessionState;
}

export const RevaStatus: React.FC<RevaStatusProps> = ({ sessionState }) => {
  const getStatus = () => {
    switch (sessionState) {
      case 'OFFLINE':
        return { label: 'Offline', dotClass: 'bg-zinc-500', textClass: 'text-zinc-400' };
      case 'CONNECTING':
        return { label: 'Connecting', dotClass: 'bg-purple-400 animate-ping', textClass: 'text-purple-300' };
      case 'READY':
        return { label: 'Online', dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]', textClass: 'text-emerald-300' };
      case 'LISTENING':
      case 'USER_SPEAKING':
        return { label: 'Listening', dotClass: 'bg-purple-300 shadow-[0_0_8px_#d8b4fe] animate-pulse', textClass: 'text-purple-200' };
      case 'REVA_SPEAKING':
        return { label: 'Speaking', dotClass: 'bg-purple-400 shadow-[0_0_10px_#c084fc] animate-pulse', textClass: 'text-purple-200' };
      case 'INTERRUPTED':
        return { label: 'Interrupted', dotClass: 'bg-amber-400', textClass: 'text-amber-300' };
      case 'ERROR':
        return { label: 'Error', dotClass: 'bg-rose-500', textClass: 'text-rose-400' };
      default:
        return { label: 'Online', dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]', textClass: 'text-emerald-300' };
    }
  };

  const status = getStatus();

  return (
    <div
      id="reva-online-status-pill"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#120722]/80 border border-purple-900/50 backdrop-blur-md select-none font-sans text-xs"
    >
      <span className={`w-2 h-2 rounded-full transition-all duration-300 ${status.dotClass}`} />
      <span className={`font-medium tracking-wide ${status.textClass}`}>{status.label}</span>
    </div>
  );
};
