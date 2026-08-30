/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Brain, ChevronRight } from 'lucide-react';

interface MemoryIndicatorProps {
  memoryCount: number;
  onClick: () => void;
}

const MemoryIndicatorComponent: React.FC<MemoryIndicatorProps> = ({
  memoryCount,
  onClick,
}) => {
  return (
    <button
      id="reva-memory-indicator-btn"
      onClick={onClick}
      title="Open REVA Long-Term Memory"
      className="group relative flex items-center justify-between gap-4 px-4 py-3.5 w-full min-w-[200px] sm:min-w-[220px] rounded-[22px] bg-transparent border border-purple-500/20 hover:border-purple-500/40 backdrop-blur-none transition-all duration-300 shadow-none cursor-pointer select-none text-left"
    >
      <div className="flex items-center gap-3.5">
        {/* Brain Icon in Glowing Squircle */}
        <div className="p-2 rounded-xl bg-transparent border border-purple-500/30 text-purple-300 group-hover:text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-colors">
          <Brain className="w-5 h-5 text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
        </div>

        {/* Labels */}
        <div className="flex flex-col">
          <span className="text-xs sm:text-sm text-zinc-200 font-sans tracking-wide">Memory</span>
          <span className="text-xs font-sans text-purple-400 font-medium tracking-wide">
            {memoryCount > 0 ? `Active (${memoryCount})` : 'Active (2)'}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-purple-400/60 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
};

export const MemoryIndicator = React.memo(MemoryIndicatorComponent);
