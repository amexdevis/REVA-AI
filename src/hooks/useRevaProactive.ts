/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ProactiveSettings,
  ProactiveDiagnosticsData,
  ProactiveEventType,
  ProactiveDecision,
} from '../types/voice.types.js';

export function useRevaProactive(options?: {
  onProactiveTrigger?: (type: ProactiveEventType, context?: Record<string, any>) => void;
}) {
  const [settings, setSettings] = useState<ProactiveSettings>({
    proactiveMode: true,
    quietMode: false,
    activityAwareness: true,
    applicationAwareness: true,
    longSessionAwareness: true,
    idleThresholdSeconds: 300,
    longSessionThresholdMinutes: 120,
    minimumProactiveIntervalSeconds: 600,
    importanceThreshold: 0.5,
  });

  const [diagnostics, setDiagnostics] = useState<ProactiveDiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [sessionActiveMinutes, setSessionActiveMinutes] = useState(0);
  const [currentApp, setCurrentApp] = useState('VS Code');

  const lastActivityTimestampRef = useRef<number>(Date.now());
  const isCurrentlyIdleRef = useRef<boolean>(false);
  const idleStartTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const sessionMilestoneFiredRef = useRef<Set<number>>(new Set());

  // Fetch diagnostics & settings from server
  const refreshDiagnostics = useCallback(async () => {
    try {
      const res = await fetch('/api/proactive/diagnostics');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.diagnostics) {
          setDiagnostics(data.diagnostics);
          if (data.diagnostics.settings) {
            setSettings(data.diagnostics.settings);
          }
        }
      }
    } catch (err: any) {
      console.warn('[REVA][PROACTIVE] Error fetching diagnostics:', err?.message);
    }
  }, []);

  // Update Settings via API
  const updateSettings = useCallback(
    async (partial: Partial<ProactiveSettings>) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/proactive/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        });
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
          await refreshDiagnostics();
        } else {
          setError(data.error || 'Failed to update proactive settings');
        }
      } catch (err: any) {
        setError(err?.message || 'Network error updating settings');
      } finally {
        setIsLoading(false);
      }
    },
    [refreshDiagnostics]
  );

  // Trigger Proactive Event
  const triggerEvent = useCallback(
    async (type: ProactiveEventType, context: Record<string, any> = {}): Promise<ProactiveDecision | null> => {
      setError(null);
      try {
        // If voice callback available, call it
        if (options?.onProactiveTrigger) {
          options.onProactiveTrigger(type, context);
        }

        const res = await fetch('/api/proactive/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, context }),
        });

        const data = await res.json();
        if (data.success) {
          if (data.diagnostics) {
            setDiagnostics(data.diagnostics);
          } else {
            await refreshDiagnostics();
          }
          return data.decision || null;
        } else {
          setError(data.error || 'Failed to evaluate event');
          return null;
        }
      } catch (err: any) {
        setError(err?.message || 'Network error triggering event');
        return null;
      }
    },
    [options, refreshDiagnostics]
  );

  // Real-world idle detection loop
  useEffect(() => {
    const handleUserActivity = () => {
      const now = Date.now();
      const wasIdle = isCurrentlyIdleRef.current;
      const idleDurationSeconds = Math.round((now - idleStartTimeRef.current) / 1000);

      lastActivityTimestampRef.current = now;
      setIdleSeconds(0);

      // If user was idle and is now returning:
      if (wasIdle && idleDurationSeconds >= settings.idleThresholdSeconds) {
        isCurrentlyIdleRef.current = false;
        console.log(`[REVA][PROACTIVE] User returned after ${idleDurationSeconds}s of inactivity`);
        triggerEvent('USER_RETURNED', {
          awaySeconds: idleDurationSeconds,
          awayMinutes: Math.round(idleDurationSeconds / 60),
          application: currentApp,
        });
      } else {
        isCurrentlyIdleRef.current = false;
      }
    };

    // Attach passive activity listeners
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });

    // 1-second interval timer for idle detection & session duration
    const interval = window.setInterval(() => {
      const now = Date.now();
      const currentIdleSecs = Math.round((now - lastActivityTimestampRef.current) / 1000);
      setIdleSeconds(currentIdleSecs);

      const activeMins = Math.round((now - sessionStartTimeRef.current) / 60000);
      setSessionActiveMinutes(activeMins);

      // Idle threshold check
      if (
        !isCurrentlyIdleRef.current &&
        currentIdleSecs >= settings.idleThresholdSeconds &&
        settings.activityAwareness
      ) {
        isCurrentlyIdleRef.current = true;
        idleStartTimeRef.current = lastActivityTimestampRef.current;
        console.log(`[REVA][PROACTIVE] User is now IDLE (${currentIdleSecs}s inactive)`);
        triggerEvent('USER_IDLE', { idleSeconds: currentIdleSecs });
      }

      // Long session threshold check (e.g. 120 mins, or testing milestone)
      if (
        settings.longSessionAwareness &&
        activeMins >= settings.longSessionThresholdMinutes &&
        !sessionMilestoneFiredRef.current.has(activeMins)
      ) {
        sessionMilestoneFiredRef.current.add(activeMins);
        triggerEvent('LONG_WORK_SESSION', {
          minutes: activeMins,
          hours: +(activeMins / 60).toFixed(1),
          application: currentApp,
        });
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [settings, currentApp, triggerEvent]);

  // Window Focus/Blur application change simulation detection
  useEffect(() => {
    const handleFocus = () => {
      if (settings.applicationAwareness) {
        triggerEvent('APPLICATION_CHANGED', {
          current: currentApp,
          event: 'WINDOW_FOCUS',
          timestamp: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [settings.applicationAwareness, currentApp, triggerEvent]);

  // Initial load
  useEffect(() => {
    refreshDiagnostics();
    const interval = setInterval(refreshDiagnostics, 5000);
    return () => clearInterval(interval);
  }, [refreshDiagnostics]);

  return {
    settings,
    diagnostics,
    isLoading,
    error,
    idleSeconds,
    sessionActiveMinutes,
    currentApp,
    setCurrentApp,
    updateSettings,
    triggerEvent,
    refreshDiagnostics,
  };
}
