/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Database, Trash2, Search, Brain, Star } from 'lucide-react';
import { MemoryRecord, UserProfile } from '../types/voice.types.js';
import { GoogleSheetsMemoryPanel } from './GoogleSheetsMemoryPanel.js';

interface RevaMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryRecord[];
  userProfile?: UserProfile | null;
  onDeleteMemory: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onRefreshMemories?: () => void;
}

export const RevaMemoryModal: React.FC<RevaMemoryModalProps> = ({
  isOpen,
  onClose,
  memories,
  userProfile,
  onDeleteMemory,
  onClearAll,
  onRefreshMemories,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredMemories = memories.filter(
    (m) =>
      m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl bg-[#0e081c] border border-purple-800/60 rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.3)] flex flex-col overflow-hidden text-zinc-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-purple-950/20">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-medium tracking-wide text-purple-100">
              REVA Long-Term Memory ({memories.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Sheets Persistent Backup Panel */}
        <div className="p-4 border-b border-purple-900/40 bg-purple-950/10">
          <GoogleSheetsMemoryPanel
            memoryCount={memories.length}
            onSyncComplete={onRefreshMemories}
          />
        </div>

        {/* User Profile Key Facts summary */}
        {userProfile && Object.keys(userProfile.preferences).length > 0 && (
          <div className="px-6 py-3 bg-purple-950/30 border-b border-purple-900/30 flex items-center gap-2 overflow-x-auto text-[11px] font-mono text-purple-200">
            <span className="text-purple-400 font-semibold flex items-center gap-1">
              <Brain className="w-3 h-3" /> Profile:
            </span>
            {userProfile.preferredName && (
              <span className="px-2 py-0.5 rounded bg-purple-900/40 border border-purple-700/40">
                Name: {userProfile.preferredName}
              </span>
            )}
            {userProfile.occupation && (
              <span className="px-2 py-0.5 rounded bg-purple-900/40 border border-purple-700/40">
                Role: {userProfile.occupation}
              </span>
            )}
          </div>
        )}

        {/* Search & Actions */}
        <div className="p-4 border-b border-purple-950 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/60" />
            <input
              type="text"
              placeholder="Search recall memories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-purple-950/40 border border-purple-900/60 rounded-lg text-xs font-mono text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
            />
          </div>
          {memories.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear all memories?')) {
                  onClearAll();
                }
              }}
              className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Memory Items List */}
        <div className="p-4 max-h-[35vh] overflow-y-auto space-y-2 text-xs font-mono">
          {filteredMemories.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              {memories.length === 0 ? 'No memories saved yet. Speak to REVA to create memories!' : 'No memories match query.'}
            </div>
          ) : (
            filteredMemories.map((m) => (
              <div
                key={m.id}
                className="p-3 bg-purple-950/20 border border-purple-900/30 hover:border-purple-700/60 rounded-xl flex items-start justify-between gap-3 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-[10px] text-purple-400/70">
                    <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300">
                      {m.category}
                    </span>
                    <span>Importance: {m.importance}/5</span>
                  </div>
                  <p className="text-zinc-200 text-xs font-sans leading-relaxed">{m.content}</p>
                </div>
                <button
                  onClick={() => onDeleteMemory(m.id)}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Delete memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
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
