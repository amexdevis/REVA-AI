/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoiceSessionState, VoiceMode, VoiceMachineState } from '../types/voice.types.js';

interface RevaStatusProps {
  sessionState: VoiceSessionState;
  voiceMode?: VoiceMode;
  machineState?: VoiceMachineState;
}

const RevaStatusComponent: React.FC<RevaStatusProps> = ({
  sessionState,
  voiceMode = 'MANUAL',
  machineState,
}) => {
  const getStatus = () => {
    if (voiceMode === 'OFF' || machineState === 'OFF') {
      return {
        label: 'Voice Off',
        dotClass: 'bg-zinc-600',
        textClass: 'text-zinc-400',
        modeLabel: 'OFF',
      };
    }

    if (voiceMode === 'HANDS_FREE' && machineState === 'WAKE_LISTENING') {
      return {
        label: 'Hands-Free (Wake)',
        dotClass: 'bg-pink-400 shadow-[0_0_8px_#f472b6] animate-pulse',
        textClass: 'text-pink-300 font-medium',
        modeLabel: 'HANDS-FREE',
      };
    }

    switch (sessionState) {
      case 'OFFLINE':
        return {
          label: voiceMode === 'HANDS_FREE' ? 'Hands-Free' : 'Manual Ready',
          dotClass: 'bg-purple-400/80',
          textClass: 'text-purple-300',
          modeLabel: voiceMode,
        };
      case 'CONNECTING':
        return {
          label: 'Connecting...',
          dotClass: 'bg-purple-400 animate-ping',
          textClass: 'text-purple-300',
          modeLabel: voiceMode,
        };
      case 'READY':
        return {
          label: voiceMode === 'HANDS_FREE' ? 'Hands-Free Ready' : 'Ready',
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
          textClass: 'text-emerald-300',
          modeLabel: voiceMode,
        };
      case 'LISTENING':
      case 'USER_SPEAKING':
        return {
          label: 'Listening',
          dotClass: 'bg-purple-300 shadow-[0_0_8px_#d8b4fe] animate-pulse',
          textClass: 'text-purple-200',
          modeLabel: voiceMode,
        };
      case 'REVA_SPEAKING':
        return {
          label: 'Speaking',
          dotClass: 'bg-purple-400 shadow-[0_0_10px_#c084fc] animate-pulse',
          textClass: 'text-purple-200',
          modeLabel: voiceMode,
        };
      case 'INTERRUPTED':
        return {
          label: 'Interrupted',
          dotClass: 'bg-amber-400',
          textClass: 'text-amber-300',
          modeLabel: voiceMode,
        };
      case 'ERROR':
        return {
          label: 'Voice Error',
          dotClass: 'bg-rose-500',
          textClass: 'text-rose-400',
          modeLabel: voiceMode,
        };
      default:
        return {
          label: 'Online',
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
          textClass: 'text-emerald-300',
          modeLabel: voiceMode,
        };
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

export const RevaStatus = React.memo(RevaStatusComponent);
