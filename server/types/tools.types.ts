/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToolPermissionLevel = 'READ_ONLY' | 'REVERSIBLE' | 'SENSITIVE' | 'DESTRUCTIVE';

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermissionLevel;
  parameters: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  result?: any;
  error?: string;
  executionTimeMs: number;
  timestamp: string;
  requiresConfirmation?: boolean;
  permissionLevel: ToolPermissionLevel;
}

export interface ToolHistoryEntry {
  id: string;
  tool: string;
  argumentsSummary: string;
  success: boolean;
  executionTimeMs: number;
  timestamp: string;
  resultSummary?: string;
  error?: string;
  permissionLevel: ToolPermissionLevel;
}

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface TimerRecord {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  completes_at: string;
}

export interface SystemStatusInfo {
  platform: string;
  osType: string;
  osRelease: string;
  arch: string;
  hostname: string;
  uptimeSeconds: number;
  formattedUptime: string;
  cpu: {
    model: string;
    cores: number;
    speedMhz: number;
    loadAverages: number[];
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
    freeFormatted: string;
  };
  nodeVersion: string;
  processUptime: number;
  timestamp: string;
}

export interface ActiveApplicationInfo {
  name: string;
  title?: string;
  category?: string;
  confidence: number;
  source: string;
  detectedAt: string;
}

export interface FileSearchResult {
  name: string;
  path: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  sizeFormatted: string;
  modifiedAt: string;
  isDirectory: boolean;
}

export interface RunningApplicationInfo {
  pid: number;
  name: string;
  cpuPercent?: number;
  memoryPercent?: number;
}
