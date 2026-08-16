/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../lib/api-client.js';
import { SystemStatusState } from '../types/index.js';

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatusState>({
    serverStatus: 'CHECKING',
    geminiStatus: 'CHECKING',
    environment: 'Development',
    applicationReady: false,
    lastChecked: null,
    isLoading: true,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Health check
      const healthData = await ApiClient.getHealth();
      const isServerOnline = healthData.status === 'ok' && healthData.service === 'REVA';

      // 2. Config check
      const configData = await ApiClient.getConfigStatus();
      const isGeminiConfigured = Boolean(configData.geminiConfigured);

      setStatus({
        serverStatus: isServerOnline ? 'ONLINE' : 'OFFLINE',
        geminiStatus: isGeminiConfigured ? 'CONFIGURED' : 'NOT CONFIGURED',
        environment: 'Development',
        applicationReady: isServerOnline,
        lastChecked: new Date().toLocaleTimeString(),
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setStatus({
        serverStatus: 'OFFLINE',
        geminiStatus: 'NOT CONFIGURED',
        environment: 'Development',
        applicationReady: false,
        lastChecked: new Date().toLocaleTimeString(),
        isLoading: false,
        error: errorMessage,
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    refreshStatus: checkStatus,
  };
}
