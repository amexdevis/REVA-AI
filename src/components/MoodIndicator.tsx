/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart, ChevronRight } from 'lucide-react';
import { PersonalityDiagnosticsData } from '../types/voice.types.js';

interface MoodIndicatorProps {
  personality?: PersonalityDiagnosticsData;
  onClick: () => void;
}

export const MoodIndicator: React.FC<MoodIndicatorProps> = ({
  personality,
  onClick,
}) => {
  // Format real dominant emotion from personality engine
  const currentMood = personality?.dominantEmotion
    ? personality.dominantEmotion.charAt(0).toUpperCase() + personality.dominantEmotion.slice(1).toLowerCase()
    : 'Happy';

  return (
    <button
      id="reva-mood-indicator-btn"
      onClick={onClick}
      title="REVA Emotional Core & Mood"
      className="group relative flex items-center justify-between gap-4 px-4 py-3 min-w-[150px] sm:min-w-[170px] rounded-2xl bg-[#120722]/80 border border-purple-900/60 hover:border-purple-500/80 backdrop-blur-md transition-all duration-300 shadow-[0_0_20px_rgba(107,33,168,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] cursor-pointer select-none text-left"
    >
      <div className="flex items-center gap-3">
        {/* Glowing Heart Icon */}
        <div className="p-1.5 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-300 group-hover:text-purple-100 transition-colors">
          <Heart className="w-5 h-5 text-purple-400 drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
        </div>

        {/* Labels */}
        <div className="flex flex-col">
          <span className="text-xs text-zinc-300 font-sans tracking-wide">Mood</span>
          <span className="text-xs font-sans text-purple-400 font-medium tracking-wide">
            {currentMood}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-purple-400/60 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
};
