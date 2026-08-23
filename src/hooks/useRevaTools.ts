/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ToolDefinition,
  ToolExecutionResult,
  SystemStatusData,
  NoteItem,
  TimerItem,
} from '../types/voice.types.js';

export interface RevaNotification {
  id: string;
  type: 'timer' | 'system';
  message: string;
}

export function useRevaTools() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [toolHistory, setToolHistory] = useState<ToolExecutionResult[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [timers, setTimers] = useState<TimerItem[]>([]);
  const [clipboardText, setClipboardText] = useState<string>('');
  const [activeNotification, setActiveNotification] = useState<RevaNotification | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/tools');
      const data = await res.json();
      if (data.success && data.tools) {
        setTools(data.tools);
      }
    } catch (err: any) {
      console.warn('[REVA][TOOLS] Failed to fetch tools list:', err);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/status');
      const data = await res.json();
      if (data.success && data.result?.system) {
        setSystemStatus(data.result.system);
      }
    } catch (err: any) {
      console.warn('[REVA][TOOLS] Failed to fetch system status:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/history?limit=30');
      const data = await res.json();
      if (data.success && data.history) {
        setToolHistory(data.history);
      }
    } catch (err: any) {
      console.warn('[REVA][TOOLS] Failed to fetch tool history:', err);
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/notes');
      const data = await res.json();
      if (data.success && data.notes) {
        setNotes(data.notes);
      }
    } catch (err: any) {
      console.warn('[REVA][TOOLS] Failed to fetch notes:', err);
    }
  }, []);

  const fetchTimers = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/timers');
      const data = await res.json();
      if (data.success && data.timers) {
        setTimers(data.timers);
      }
    } catch (err: any) {
      console.warn('[REVA][TOOLS] Failed to fetch timers:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.allSettled([
        fetchTools(),
        fetchStatus(),
        fetchHistory(),
        fetchNotes(),
        fetchTimers(),
      ]);
    } catch (err: any) {
      setError(err?.message || 'Error refreshing tools');
    } finally {
      setIsLoading(false);
    }
  }, [fetchTools, fetchStatus, fetchHistory, fetchNotes, fetchTimers]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Periodic status & timer polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchTimers();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchTimers]);

  // Execute tool via REST API
  const executeTool = useCallback(
    async (toolName: string, args: Record<string, any> = {}): Promise<ToolExecutionResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: toolName, args }),
        });
        const data = await res.json();

        // Refresh dependent state
        if (toolName.includes('note')) fetchNotes();
        if (toolName.includes('timer')) fetchTimers();
        if (toolName.includes('status')) fetchStatus();
        fetchHistory();

        return data;
      } catch (err: any) {
        const errResult: ToolExecutionResult = {
          tool: toolName,
          executionId: 'err-' + Date.now(),
          success: false,
          error: err?.message || 'Network request failed',
          permission: 'READ_ONLY',
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
        };
        setError(err?.message || 'Failed to execute tool');
        return errResult;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchNotes, fetchTimers, fetchStatus, fetchHistory]
  );

  // Note helpers
  const createNote = useCallback(
    async (content: string, title?: string, tags?: string[]) => {
      return executeTool('create_note', { content, title, tags });
    },
    [executeTool]
  );

  const deleteNote = useCallback(
    async (idOrTitle: string) => {
      return executeTool('delete_note', { idOrTitle });
    },
    [executeTool]
  );

  // Timer helpers
  const setTimer = useCallback(
    async (durationSeconds?: number, minutes?: number, label?: string) => {
      return executeTool('set_timer', { durationSeconds, minutes, label });
    },
    [executeTool]
  );

  const cancelTimer = useCallback(
    async (idOrLabel: string) => {
      return executeTool('cancel_timer', { idOrLabel });
    },
    [executeTool]
  );

  // Real-time event handlers (called by useRevaVoice)
  const addRealtimeToolResult = useCallback((result: ToolExecutionResult) => {
    setToolHistory((prev) => [result, ...prev.slice(0, 49)]);
    if (result.tool.includes('note')) fetchNotes();
    if (result.tool.includes('timer')) fetchTimers();
    if (result.tool.includes('status')) fetchStatus();
  }, [fetchNotes, fetchTimers, fetchStatus]);

  const handleTimerRing = useCallback((timer: TimerItem) => {
    setActiveNotification({
      id: 'timer-' + Date.now(),
      type: 'timer',
      message: `Timer alert: "${timer.label}" has finished!`,
    });
    fetchTimers();
  }, [fetchTimers]);

  const handleClipboardSync = useCallback((text: string) => {
    setClipboardText(text);
  }, []);

  const handleOpenUrl = useCallback((_url: string) => {
    // No artificial popup
  }, []);

  return {
    tools,
    systemStatus,
    toolHistory,
    notes,
    timers,
    clipboardText,
    activeNotification,
    isLoading,
    error,
    refreshAll,
    fetchStatus,
    fetchNotes,
    fetchTimers,
    fetchHistory,
    executeTool,
    createNote,
    deleteNote,
    setTimer,
    cancelTimer,
    addRealtimeToolResult,
    handleTimerRing,
    handleClipboardSync,
    handleOpenUrl,
    dismissNotification: () => setActiveNotification(null),
  };
}
