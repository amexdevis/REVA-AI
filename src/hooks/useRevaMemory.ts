/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  MemoryRecord,
  MemoryCategory,
  EpisodicMemoryRecord,
  ProjectMemoryRecord,
  UserProfile,
  WorkingMemoryState,
  ConsolidationReport,
} from '../types/voice.types.js';

export function useRevaMemory() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [episodicMemories, setEpisodicMemories] = useState<EpisodicMemoryRecord[]>([]);
  const [projects, setProjects] = useState<ProjectMemoryRecord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workingMemory, setWorkingMemory] = useState<WorkingMemoryState | null>(null);
  const [searchResults, setSearchResults] = useState<MemoryRecord[] | null>(null);
  const [consolidationReport, setConsolidationReport] = useState<ConsolidationReport | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [memRes, epiRes, projRes, profRes, workRes] = await Promise.all([
        fetch('/api/memory?all=false'),
        fetch('/api/memory/episodic'),
        fetch('/api/memory/projects'),
        fetch('/api/memory/profile'),
        fetch('/api/memory/working'),
      ]);

      if (memRes.ok) {
        const data = await memRes.json();
        if (data.success) setMemories(data.memories || []);
      }
      if (epiRes.ok) {
        const data = await epiRes.json();
        if (data.success) setEpisodicMemories(data.episodes || []);
      }
      if (projRes.ok) {
        const data = await projRes.json();
        if (data.success) setProjects(data.projects || []);
      }
      if (profRes.ok) {
        const data = await profRes.json();
        if (data.success) setUserProfile(data.profile);
      }
      if (workRes.ok) {
        const data = await workRes.json();
        if (data.success) setWorkingMemory(data.workingMemory);
      }
    } catch (err: any) {
      console.error('[REVA][MEM] Error fetching memory data:', err);
      setError(err?.message || 'Error fetching memories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchMemories = async (query: string): Promise<MemoryRecord[]> => {
    if (!query.trim()) {
      setSearchResults(null);
      return memories;
    }
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results || []);
        return data.results || [];
      }
      return [];
    } catch (err: any) {
      console.error('[REVA][MEM] Search error:', err);
      return [];
    }
  };

  const createMemory = async (params: {
    category: MemoryCategory;
    content: string;
    importance?: number;
    project_id?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMemories();
        return true;
      }
      setError(data.error || 'Failed to save memory');
      return false;
    } catch (err: any) {
      console.error('[REVA][MEM] Error creating memory:', err);
      setError(err?.message || 'Failed to create memory');
      return false;
    }
  };

  const updateMemory = async (
    id: string,
    updates: Partial<Pick<MemoryRecord, 'content' | 'category' | 'importance' | 'active'>>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/memory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMemories();
        return true;
      }
      setError(data.error || 'Failed to update memory');
      return false;
    } catch (err: any) {
      console.error('[REVA][MEM] Error updating memory:', err);
      setError(err?.message || 'Failed to update memory');
      return false;
    }
  };

  const deleteMemory = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/memory/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        if (searchResults) {
          setSearchResults((prev) => (prev ? prev.filter((m) => m.id !== id) : null));
        }
        return true;
      }
      setError(data.error || 'Failed to delete memory');
      return false;
    } catch (err: any) {
      console.error('[REVA][MEM] Error deleting memory:', err);
      setError(err?.message || 'Failed to delete memory');
      return false;
    }
  };

  const clearAllMemories = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await res.json();
      if (data.success) {
        setMemories([]);
        setEpisodicMemories([]);
        setSearchResults(null);
        await fetchMemories();
        return true;
      }
      setError(data.error || 'Failed to clear memories');
      return false;
    } catch (err: any) {
      console.error('[REVA][MEM] Error clearing memories:', err);
      setError(err?.message || 'Failed to clear memories');
      return false;
    }
  };

  const consolidateMemories = async (): Promise<ConsolidationReport | null> => {
    try {
      const res = await fetch('/api/memory/consolidate', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setConsolidationReport(data.report);
        await fetchMemories();
        return data.report;
      }
      return null;
    } catch (err: any) {
      console.error('[REVA][MEM] Consolidation error:', err);
      return null;
    }
  };

  const executeVoiceCommand = async (text: string): Promise<{ handled: boolean; responseText?: string }> => {
    try {
      const res = await fetch('/api/memory/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMemories();
        return data.result;
      }
      return { handled: false };
    } catch (err: any) {
      console.error('[REVA][MEM] Voice command simulation error:', err);
      return { handled: false };
    }
  };

  const createEpisodicMemory = async (params: {
    summary: string;
    topic: string;
    importance?: number;
    confidence?: number;
    related_project?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/memory/episodic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMemories();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteEpisodicMemory = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/memory/episodic/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEpisodicMemories((prev) => prev.filter((e) => e.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const saveProject = async (params: {
    id?: string;
    name: string;
    description: string;
    goals?: string[];
    decisions?: string[];
    status?: 'active' | 'completed' | 'paused';
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/memory/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMemories();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteProject = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/memory/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return {
    memories,
    episodicMemories,
    projects,
    userProfile,
    workingMemory,
    searchResults,
    consolidationReport,
    isLoading,
    error,
    refreshMemories: fetchMemories,
    searchMemories,
    createMemory,
    updateMemory,
    deleteMemory,
    clearAllMemories,
    consolidateMemories,
    executeVoiceCommand,
    createEpisodicMemory,
    deleteEpisodicMemory,
    saveProject,
    deleteProject,
  };
}
