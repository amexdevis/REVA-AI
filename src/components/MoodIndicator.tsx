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
      className="group relative flex items-center justify-between gap-4 px-4 py-3.5 w-full min-w-[200px] sm:min-w-[220px] rounded-[22px] bg-[#0c051a]/80 border border-purple-900/50 hover:border-purple-500/60 backdrop-blur-2xl transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] cursor-pointer select-none text-left"
    >
      <div className="flex items-center gap-3.5">
        {/* Heart Icon in Glowing Squircle */}
        <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-600/40 text-purple-300 group-hover:text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-colors">
          <Heart className="w-5 h-5 text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
        </div>

        {/* Labels */}
        <div className="flex flex-col">
          <span className="text-xs sm:text-sm text-zinc-200 font-sans tracking-wide">Mood</span>
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
