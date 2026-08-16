/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export interface ConfigStatusResponse {
  geminiConfigured: boolean;
}

export type ServerStatus = 'ONLINE' | 'OFFLINE' | 'CHECKING';
export type GeminiStatus = 'CONFIGURED' | 'NOT CONFIGURED' | 'CHECKING';

export interface SystemStatusState {
  serverStatus: ServerStatus;
  geminiStatus: GeminiStatus;
  environment: string;
  applicationReady: boolean;
  lastChecked: string | null;
  isLoading: boolean;
  error: string | null;
}
