/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Search,
  Zap,
  BookOpen,
  FolderGit2,
  User,
  Activity,
  Cpu,
} from 'lucide-react';
import {
  MemoryRecord,
  MemoryCategory,
  EpisodicMemoryRecord,
  ProjectMemoryRecord,
  UserProfile,
  WorkingMemoryState,
  ConsolidationReport,
} from '../types/voice.types.js';

interface MemoryManagerPanelProps {
  memories: MemoryRecord[];
  episodicMemories?: EpisodicMemoryRecord[];
  projects?: ProjectMemoryRecord[];
  userProfile?: UserProfile | null;
  workingMemory?: WorkingMemoryState | null;
  searchResults?: MemoryRecord[] | null;
  consolidationReport?: ConsolidationReport | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  onCreateMemory: (params: { category: MemoryCategory; content: string; importance: number; project_id?: string }) => Promise<boolean>;
  onUpdateMemory: (id: string, updates: Partial<Pick<MemoryRecord, 'content' | 'category' | 'importance'>>) => Promise<boolean>;
  onDeleteMemory: (id: string) => Promise<boolean>;
  onClearAllMemories: () => Promise<boolean>;
  onConsolidate: () => Promise<ConsolidationReport | null>;
  onExecuteCommand: (text: string) => Promise<{ handled: boolean; responseText?: string }>;
  onCreateEpisodic?: (params: { summary: string; topic: string; importance?: number }) => Promise<boolean>;
  onDeleteEpisodic?: (id: string) => Promise<boolean>;
  onSaveProject?: (params: { name: string; description: string; goals?: string[]; status?: 'active' | 'completed' | 'paused' }) => Promise<boolean>;
  onDeleteProject?: (id: string) => Promise<boolean>;
}

type TabType = 'semantic' | 'working' | 'episodic' | 'profile' | 'projects';

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  USER_PROFILE: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
  PREFERENCE: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
  PROJECT: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
  GOAL: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
  INTEREST: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
  HABIT: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
  ROUTINE: 'bg-teal-950/80 text-teal-300 border-teal-700/60',
  IMPORTANT_FACT: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
  CONVERSATION_CONTEXT: 'bg-zinc-900 text-zinc-300 border-zinc-700',
  OTHER: 'bg-zinc-900 text-zinc-400 border-zinc-800',
};

export const MemoryManagerPanel: React.FC<MemoryManagerPanelProps> = ({
  memories,
  episodicMemories = [],
  projects = [],
  userProfile,
  workingMemory,
  searchResults,
  consolidationReport,
  isLoading,
  error,
  onRefresh,
  onSearch,
  onCreateMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearAllMemories,
  onConsolidate,
  onExecuteCommand,
  onCreateEpisodic,
  onDeleteEpisodic,
  onSaveProject,
  onDeleteProject,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('semantic');
  const [searchQuery, setSearchQuery] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [commandResponse, setCommandResponse] = useState<string | null>(null);
  const [isConsolidating, setIsConsolidating] = useState(false);

  // New memory form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<MemoryCategory>('PREFERENCE');
  const [newContent, setNewContent] = useState('');
  const [newImportance, setNewImportance] = useState(0.9);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryCategory>('PREFERENCE');
  const [editImportance, setEditImportance] = useState(0.8);

  // Clear all confirmation dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // New Episodic form
  const [showAddEpisodic, setShowAddEpisodic] = useState(false);
  const [epiSummary, setEpiSummary] = useState('');
  const [epiTopic, setEpiTopic] = useState('');

  // New Project form
  const [showAddProject, setShowAddProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const displayMemories = searchResults !== null && searchResults !== undefined ? searchResults : memories;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onSearch(val);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    const success = await onCreateMemory({
      category: newCategory,
      content: newContent.trim(),
      importance: newImportance,
    });
    setIsSubmitting(false);

    if (success) {
      setNewContent('');
      setShowAddForm(false);
    }
  };

  const handleConsolidateClick = async () => {
    setIsConsolidating(true);
    await onConsolidate();
    setIsConsolidating(false);
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const res = await onExecuteCommand(commandInput.trim());
    if (res.responseText) {
      setCommandResponse(res.responseText);
    } else {
      setCommandResponse(res.handled ? 'Command handled.' : 'Command not recognized.');
    }
    setCommandInput('');
  };

  const handleAddEpisodicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epiSummary.trim() || !epiTopic.trim() || !onCreateEpisodic) return;
    const success = await onCreateEpisodic({ summary: epiSummary.trim(), topic: epiTopic.trim() });
    if (success) {
      setEpiSummary('');
      setEpiTopic('');
      setShowAddEpisodic(false);
    }
  };

  const handleAddProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !projDesc.trim() || !onSaveProject) return;
    const success = await onSaveProject({ name: projName.trim(), description: projDesc.trim() });
    if (success) {
      setProjName('');
      setProjDesc('');
      setShowAddProject(false);
    }
  };

  const startEdit = (mem: MemoryRecord) => {
    setEditingId(mem.id);
    setEditContent(mem.content);
    setEditCategory(mem.category);
    setEditImportance(mem.importance);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await onUpdateMemory(id, {
      content: editContent.trim(),
      category: editCategory,
      importance: editImportance,
    });
    setEditingId(null);
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    await onClearAllMemories();
    setIsClearing(false);
    setShowClearConfirm(false);
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      id="memory-manager-panel"
      className="w-full max-w-2xl bg-zinc-900/95 border border-zinc-800 rounded-xl p-5 shadow-2xl backdrop-blur-md text-left font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono text-zinc-200 uppercase tracking-widest font-semibold">
            REVA Advanced Memory Engine
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleConsolidateClick}
            disabled={isConsolidating}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-mono text-xs transition-colors cursor-pointer"
            title="Consolidate duplicate memories and handle contradictions"
          >
            <Zap className={`w-3 h-3 text-indigo-400 ${isConsolidating ? 'animate-spin' : ''}`} />
            <span>{isConsolidating ? 'Consolidating...' : 'Consolidate'}</span>
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Refresh memory database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 font-mono text-xs mb-4">
        <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500">Semantic</span>
          <span id="stat-memory-count" className="font-bold text-cyan-300 text-sm">
            {memories.length}
          </span>
        </div>

        <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500">Episodic</span>
          <span className="font-bold text-purple-300 text-sm">
            {episodicMemories.length}
          </span>
        </div>

        <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500">Projects</span>
          <span className="font-bold text-emerald-300 text-sm">
            {projects.length}
          </span>
        </div>

        <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500">Search Engine</span>
          <span className="font-bold text-indigo-300 text-[11px] truncate">
            Hybrid (FTS5+Vec)
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-zinc-800 font-mono text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('semantic')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'semantic'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Semantic Facts</span>
        </button>

        <button
          onClick={() => setActiveTab('working')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'working'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Working Memory</span>
        </button>

        <button
          onClick={() => setActiveTab('episodic')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'episodic'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Episodic</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>User Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Projects</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Consolidation report banner if recently run */}
      {consolidationReport && (
        <div className="mb-3 p-2.5 rounded-lg bg-indigo-950/50 border border-indigo-800/80 font-mono text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Consolidated: {consolidationReport.mergedCount} merged, {consolidationReport.supersededCount} superseded contradictions, {consolidationReport.reinforcedCount} reinforced.
            </span>
          </div>
        </div>
      )}

      {/* Natural Voice Command Bar */}
      <form onSubmit={handleCommandSubmit} className="mb-3 flex gap-2 font-mono text-xs">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder='Test voice command (e.g. "Remember that I love dark interfaces" or "Forget that")'
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold disabled:opacity-40 cursor-pointer"
        >
          Execute
        </button>
      </form>

      {commandResponse && (
        <div className="mb-3 p-2 rounded bg-zinc-950 border border-zinc-800 text-cyan-300 text-xs font-mono flex items-center justify-between">
          <span>{commandResponse}</span>
          <button onClick={() => setCommandResponse(null)} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* TAB CONTENT: Semantic Memories */}
      {activeTab === 'semantic' && (
        <>
          {/* Hybrid Search Bar */}
          <div className="relative mb-3 font-mono text-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Hybrid search memories (keyword + semantic similarity ranking)..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-8 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  onSearch('');
                }}
                className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions Toolbar */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              id="btn-add-memory"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Close Form' : 'Add Semantic Fact'}</span>
            </button>

            {memories.length > 0 && (
              <button
                id="btn-clear-all-memories"
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-mono text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Add Memory Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddSubmit}
              className="mb-4 p-4 rounded-lg bg-zinc-950/90 border border-zinc-800 font-mono text-xs space-y-3"
            >
              <div className="flex items-center justify-between text-zinc-400 font-semibold border-b border-zinc-800 pb-2">
                <span>Store Semantic Fact</span>
                <span className="text-[10px] text-zinc-500">Hybrid Indexed</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="PREFERENCE">PREFERENCE (Colors, UI, Styles)</option>
                    <option value="PROJECT">PROJECT (REVA, Tools, Code)</option>
                    <option value="USER_PROFILE">USER_PROFILE (Name, Identity)</option>
                    <option value="GOAL">GOAL (Aspirations, Plans)</option>
                    <option value="INTEREST">INTEREST (Hobbies, Topics)</option>
                    <option value="HABIT">HABIT (Daily routines)</option>
                    <option value="IMPORTANT_FACT">IMPORTANT_FACT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Importance ({newImportance.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseFloat(e.target.value))}
                    className="w-full mt-2 accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Fact Content</label>
                <input
                  type="text"
                  placeholder="e.g. The user prefers purple accent themes"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newContent.trim()}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save to SQLite'}
                </button>
              </div>
            </form>
          )}

          {/* Memory List */}
          {displayMemories.length === 0 ? (
            <div className="py-8 px-4 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
              <Database className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="text-sm font-mono text-zinc-400 font-medium">
                {searchQuery ? 'No matching memories found' : 'No stored memories yet'}
              </div>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto font-mono">
                Say <span className="text-cyan-300 font-semibold">"Remember that I prefer dark interfaces"</span> or save facts above.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {displayMemories.map((mem) => {
                const isEditing = editingId === mem.id;
                const categoryBadgeClass = CATEGORY_COLORS[mem.category] || CATEGORY_COLORS.OTHER;

                return (
                  <div
                    key={mem.id}
                    className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all font-mono space-y-2"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                            className="bg-zinc-900 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                          >
                            <option value="PREFERENCE">PREFERENCE</option>
                            <option value="PROJECT">PROJECT</option>
                            <option value="USER_PROFILE">USER_PROFILE</option>
                            <option value="GOAL">GOAL</option>
                            <option value="INTEREST">INTEREST</option>
                            <option value="HABIT">HABIT</option>
                            <option value="IMPORTANT_FACT">IMPORTANT_FACT</option>
                            <option value="OTHER">OTHER</option>
                          </select>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400">Imp:</span>
                            <input
                              type="range"
                              min="0.1"
                              max="1.0"
                              step="0.1"
                              value={editImportance}
                              onChange={(e) => setEditImportance(parseFloat(e.target.value))}
                              className="flex-1 accent-cyan-400 cursor-pointer"
                            />
                            <span className="text-[10px] text-zinc-300 font-bold">{editImportance.toFixed(1)}</span>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-zinc-900 border border-cyan-700 rounded p-2 text-zinc-200 text-xs"
                        />

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <button
                            onClick={() => saveEdit(mem.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Update</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wider ${categoryBadgeClass}`}>
                              {mem.category}
                            </span>
                            <span className="text-[10px] text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                              conf: {((mem.confidence || 0.9) * 100).toFixed(0)}%
                            </span>
                            {mem.score !== undefined && (
                              <span className="text-[10px] text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/80">
                                rank: {mem.score}
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(mem.updated_at || mem.created_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEdit(mem)}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Edit memory"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteMemory(mem.id)}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Delete memory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-zinc-200 text-xs leading-relaxed font-mono font-medium">
                          {mem.content}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-500">
                          <div className="flex items-center gap-2">
                            <span>Importance:</span>
                            <div className="w-16 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-400 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, mem.importance * 100))}%` }}
                              />
                            </div>
                            <span className="text-zinc-400">{mem.importance.toFixed(1)}</span>
                          </div>
                          <span>Accessed: {mem.access_count || 1}x</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT: Working Memory */}
      {activeTab === 'working' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Live Working Memory State
              </span>
              <span className="text-[10px] text-zinc-500">Expires after 15m idle</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-500">Current Topic: </span>
                <span className="text-zinc-200 font-semibold">{workingMemory?.currentTopic || 'General Conversation'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Current Task: </span>
                <span className="text-zinc-200 font-semibold">{workingMemory?.currentTask || 'Idle / Attentive'}</span>
              </div>
            </div>

            {workingMemory?.recentPreferences && workingMemory.recentPreferences.length > 0 && (
              <div className="pt-2 border-t border-zinc-900">
                <span className="text-[10px] text-zinc-500 block mb-1">Active Session Preferences:</span>
                <div className="flex flex-wrap gap-1">
                  {workingMemory.recentPreferences.map((p, idx) => (
                    <span key={idx} className="bg-zinc-900 border border-zinc-700/60 px-2 py-0.5 rounded text-[10px] text-amber-200">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-2">
            <span className="text-zinc-400 font-semibold block text-[11px]">Recent Context Turns ({workingMemory?.recentContext?.length || 0})</span>
            {(!workingMemory?.recentContext || workingMemory.recentContext.length === 0) ? (
              <p className="text-zinc-600 text-[11px]">No active conversation turns yet in working memory.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {workingMemory.recentContext.map((turn, i) => (
                  <div key={i} className="text-[11px] p-1.5 rounded bg-zinc-900/60 flex items-start gap-2">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${turn.role === 'user' ? 'text-cyan-400 bg-cyan-950' : 'text-emerald-400 bg-emerald-950'}`}>
                      {turn.role.toUpperCase()}
                    </span>
                    <span className="text-zinc-300 flex-1">{turn.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Episodic Memory */}
      {activeTab === 'episodic' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-[11px]">Compact Past Event Summaries</span>
            <button
              onClick={() => setShowAddEpisodic(!showAddEpisodic)}
              className="px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 text-xs font-semibold cursor-pointer"
            >
              {showAddEpisodic ? 'Cancel' : '+ Add Episode'}
            </button>
          </div>

          {showAddEpisodic && (
            <form onSubmit={handleAddEpisodicSubmit} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <input
                type="text"
                placeholder="Topic (e.g. Realtime Voice Architecture)"
                value={epiTopic}
                onChange={(e) => setEpiTopic(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
              />
              <textarea
                placeholder="Event Summary..."
                value={epiSummary}
                onChange={(e) => setEpiSummary(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
              />
              <div className="flex justify-end">
                <button type="submit" className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold cursor-pointer">
                  Save Episode
                </button>
              </div>
            </form>
          )}

          {episodicMemories.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
              No episodic memories recorded yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {episodicMemories.map((epi) => (
                <div key={epi.id} className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-300 font-semibold">{epi.topic}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">{epi.date}</span>
                      {onDeleteEpisodic && (
                        <button onClick={() => onDeleteEpisodic(epi.id)} className="text-zinc-600 hover:text-rose-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">{epi.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: User Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Compiled User Profile
              </span>
              <span className="text-[10px] text-zinc-500">Synced from SQLite facts</span>
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 block mb-1">Preferences & Traits:</span>
              {(!userProfile?.preferences || userProfile.preferences.length === 0) ? (
                <p className="text-zinc-600 text-[11px]">No explicit preferences yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {userProfile.preferences.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-950/60 border border-indigo-800/60 text-indigo-200 rounded text-[11px]">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 block mb-1">UI & Theme Preferences:</span>
              {(!userProfile?.ui_preferences || userProfile.ui_preferences.length === 0) ? (
                <p className="text-zinc-600 text-[11px]">None recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {userProfile.ui_preferences.map((u, i) => (
                    <span key={i} className="px-2 py-0.5 bg-cyan-950/60 border border-cyan-800/60 text-cyan-200 rounded text-[11px]">
                      {u}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-[11px]">Project Memory Store</span>
            <button
              onClick={() => setShowAddProject(!showAddProject)}
              className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-semibold cursor-pointer"
            >
              {showAddProject ? 'Cancel' : '+ Add Project'}
            </button>
          </div>

          {showAddProject && (
            <form onSubmit={handleAddProjectSubmit} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <input
                type="text"
                placeholder="Project Name (e.g. REVA AI Companion)"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
              />
              <textarea
                placeholder="Project Description & Decisions..."
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
              />
              <div className="flex justify-end">
                <button type="submit" className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold cursor-pointer">
                  Save Project
                </button>
              </div>
            </form>
          )}

          {projects.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
              No projects saved yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {projects.map((proj) => (
                <div key={proj.id} className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-semibold">{proj.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 uppercase">{proj.status}</span>
                      {onDeleteProject && (
                        <button onClick={() => onDeleteProject(proj.id)} className="text-zinc-600 hover:text-rose-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">{proj.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Clear All */}
      {showClearConfirm && (
        <div className="mt-4 p-4 rounded-lg bg-rose-950/90 border border-rose-700 font-mono text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-rose-300 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Confirm Permanent Erasure</span>
          </div>
          <p className="text-zinc-300 text-[11px] leading-relaxed">
            That will erase all of your saved memories, episodic logs, and profile records. Do you want to continue?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-rose-900/60">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {isClearing ? 'Erasing...' : 'Yes, Delete Everything'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
