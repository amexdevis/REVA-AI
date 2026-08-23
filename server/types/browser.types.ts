/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChromiumTabInfo {
  id: string;
  title: string;
  url: string;
  type: string;
  description?: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
  faviconUrl?: string;
}

export interface ChromiumVersionInfo {
  browser: string;
  protocolVersion: string;
  userAgent: string;
  v8Version?: string;
  webSocketDebuggerUrl?: string;
}

export type BrowserCapabilityState =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface ChromiumDiagnostics {
  browserName: string;
  capabilityState: BrowserCapabilityState;
  chromium: 'AVAILABLE' | 'NOT_AVAILABLE';
  cdp: 'AVAILABLE' | 'NOT_AVAILABLE';
  browserControl: 'READY' | 'NOT_AVAILABLE';
  chromiumDetected: 'YES' | 'NO';
  chromiumRunning: 'YES' | 'NO';
  cdpAvailable: 'YES' | 'NO';
  cdpConnected: 'YES' | 'NO';
  activeTabUrl: string;
  activeTabTitle: string;
  tabsCount: number;
  cdpPort: number;
  browserVersion?: string;
  executablePath?: string;
  developerRequirement?: string;
  developerMessage: string;
  lastCheckedAt: string;
}

export interface ChromiumOperationResult {
  success: boolean;
  action: string;
  url?: string;
  title?: string;
  tabId?: string;
  tabs?: ChromiumTabInfo[];
  tabCount?: number;
  verified?: boolean;
  spokenSummary: string;
  error?: string;
  errorCode?: 'CDP_NOT_AVAILABLE' | 'CHROMIUM_NOT_FOUND' | 'NAVIGATION_TIMEOUT' | 'NAVIGATION_VERIFICATION_FAILED' | 'INVALID_URL' | 'BROWSER_CLOSED' | 'PERMISSION_DENIED';
  developerRequirement?: string;
  permissionLevel: 'READ_ONLY' | 'REVERSIBLE' | 'SENSITIVE' | 'DESTRUCTIVE';
}
