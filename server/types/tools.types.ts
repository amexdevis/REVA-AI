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
  distro?: string;
  arch: string;
  hostname: string;
  uptimeSeconds: number;
  formattedUptime: string;
  cpu: {
    model: string;
    cores: number;
    speedMhz: number;
    usagePercent: number;
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
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
    freeFormatted: string;
  };
  battery?: {
    supported: boolean;
    isCharging?: boolean;
    percent?: number;
    statusText: string;
  };
  network?: {
    connected: boolean;
    interfaces: Array<{ name: string; address: string; family: string }>;
    summary: string;
  };
  nodeVersion: string;
  processUptime: number;
  timestamp: string;
  spokenSummary: string;
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
  parentDir?: string;
}

export interface AllowedDirectoryInfo {
  id: string;
  name: string;
  path: string;
  description: string;
  isDefault: boolean;
  exists: boolean;
}

export interface FileOperationResult {
  action: string;
  path: string;
  relativePath?: string;
  sourcePath?: string;
  destPath?: string;
  name?: string;
  sizeBytes?: number;
  isDirectory?: boolean;
  created?: boolean;
  copied?: boolean;
  moved?: boolean;
  renamed?: boolean;
  overwrite?: boolean;
  spokenSummary: string;
}

export type PendingActionType =
  | 'RENAME'
  | 'COPY_OVERWRITE'
  | 'MOVE'
  | 'DISRUPTIVE_FILE'
  | 'MULTI_STEP';

export interface PendingAction {
  id: string;
  type: PendingActionType;
  summary: string;
  promptQuestion: string;
  details: Record<string, any>;
  createdAt: number;
  expiresAt: number;
  executor: () => Promise<ToolExecutionResult>;
}

export interface MultiStepPlanItem {
  tool: string;
  args: Record<string, any>;
  description?: string;
  optional?: boolean;
}

export interface MultiStepPlan {
  description?: string;
  steps: MultiStepPlanItem[];
}

export interface MultiStepExecutionResult {
  totalSteps: number;
  completedSteps: number;
  allSucceeded: boolean;
  steps: Array<{
    stepNumber: number;
    tool: string;
    description?: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  rolledBack: boolean;
  rollbackDetails?: string;
  spokenSummary: string;
}

export interface RunningApplicationInfo {
  pid: number;
  name: string;
  command?: string;
  cpuPercent?: number;
  memoryPercent?: number;
}

export interface WindowControlResult {
  action: 'focus' | 'minimize' | 'maximize' | 'restore' | 'close';
  windowNameOrId?: string;
  success: boolean;
  supported: boolean;
  message: string;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt?: string;
  isOfficial?: boolean;
}

export interface WebSearchResponse {
  query: string;
  provider: string;
  count: number;
  results: WebSearchResultItem[];
  topSource?: WebSearchResultItem;
  spokenSummary: string;
  executedAt: string;
}

export interface WebOpenSearchResult {
  success: boolean;
  query: string;
  targetUrl?: string;
  title?: string;
  source?: string;
  isOfficial?: boolean;
  action: string;
  spokenSummary: string;
  error?: string;
}
