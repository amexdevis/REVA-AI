/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';
import { WebSocket } from 'ws';
import {
  ChromiumTabInfo,
  ChromiumVersionInfo,
  ChromiumDiagnostics,
} from '../types/browser.types.js';

/**
 * ChromiumConnectionManager
 * Responsibilities:
 * - Detect whether Chromium CDP control endpoint is available (default 127.0.0.1:9222)
 * - Connect to DevTools Protocol
 * - Maintain connection and detect disconnects
 * - Reconnect safely without creating duplicate connections
 * - Provide safe HTTP & WebSocket CDP primitives for tab management and navigation
 */
export class ChromiumConnectionManager {
  private static instance: ChromiumConnectionManager | null = null;

  public static readonly DEFAULT_CDP_PORT = 9222;
  public static readonly HOST = '127.0.0.1';

  private cdpPort: number;
  private isConnected = false;
  private ws: WebSocket | null = null;
  private messageIdCounter = 1;
  private pendingCommands = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private cachedVersion: ChromiumVersionInfo | null = null;
  private cachedTabs: ChromiumTabInfo[] = [];
  private lastCheckedTime = 0;
  private checkIntervalHandle: NodeJS.Timeout | null = null;

  private constructor() {
    this.cdpPort = parseInt(process.env.CHROMIUM_CDP_PORT || `${ChromiumConnectionManager.DEFAULT_CDP_PORT}`, 10);
    this.startPeriodicStatusCheck();
  }

  public static getInstance(): ChromiumConnectionManager {
    if (!ChromiumConnectionManager.instance) {
      ChromiumConnectionManager.instance = new ChromiumConnectionManager();
    }
    return ChromiumConnectionManager.instance;
  }

  public getPort(): number {
    return this.cdpPort;
  }

  public setPort(port: number): void {
    if (port > 0 && port < 65536 && this.cdpPort !== port) {
      this.cdpPort = port;
      this.disconnectWs();
      this.checkConnection();
    }
  }

  /**
   * Periodically checks connection without spamming logs.
   */
  private startPeriodicStatusCheck(): void {
    if (this.checkIntervalHandle) return;
    // Periodic light polling every 10 seconds
    this.checkIntervalHandle = setInterval(() => {
      this.checkConnection().catch(() => {});
    }, 10000);
    // Initial check
    this.checkConnection().catch(() => {});
  }

  /**
   * Checks if Chromium CDP HTTP endpoint is reachable and updates state.
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const version = await this.fetchJsonVersion();
      if (version) {
        this.cachedVersion = version;
        this.isConnected = true;
        this.lastCheckedTime = Date.now();

        // Refresh cached tabs
        const tabs = await this.fetchJsonList();
        this.cachedTabs = tabs;
        return true;
      }
    } catch {
      // Endpoint not reachable
    }

    this.isConnected = false;
    this.cachedVersion = null;
    this.cachedTabs = [];
    this.lastCheckedTime = Date.now();
    this.disconnectWs();
    return false;
  }

  /**
   * Helper to perform HTTP GET to DevTools endpoint with timeout.
   */
  private httpGetJson<T>(pathname: string, timeoutMs = 2500): Promise<T | null> {
    return new Promise((resolve) => {
      const req = http.get(
        {
          hostname: ChromiumConnectionManager.HOST,
          port: this.cdpPort,
          path: pathname,
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve(parsed as T);
              } catch {
                resolve(null);
              }
            });
          } else {
            res.resume();
            resolve(null);
          }
        }
      );

      req.on('error', () => {
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Helper to perform HTTP PUT/GET to DevTools endpoint (e.g. for /json/new).
   */
  private httpAction(pathname: string, method = 'PUT', timeoutMs = 3000): Promise<any | null> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: ChromiumConnectionManager.HOST,
          port: this.cdpPort,
          path: pathname,
          method,
          timeout: timeoutMs,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            try {
              if (body) {
                resolve(JSON.parse(body));
              } else {
                resolve({ success: res.statusCode === 200 });
              }
            } catch {
              resolve({ raw: body, statusCode: res.statusCode });
            }
          });
        }
      );

      req.on('error', () => {
        // Some older Chromium versions accept GET instead of PUT
        if (method === 'PUT') {
          this.httpGetJson(pathname, timeoutMs).then(resolve).catch(() => resolve(null));
        } else {
          resolve(null);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
  }

  /**
   * GET /json/version
   */
  public async fetchJsonVersion(): Promise<ChromiumVersionInfo | null> {
    const raw = await this.httpGetJson<any>('/json/version', 2000);
    if (!raw) return null;

    return {
      browser: raw.Browser || raw['Browser'] || 'Chromium',
      protocolVersion: raw['Protocol-Version'] || '1.3',
      userAgent: raw['User-Agent'] || '',
      v8Version: raw['V8-Version'],
      webSocketDebuggerUrl: raw.webSocketDebuggerUrl,
    };
  }

  /**
   * GET /json/list
   * Returns active tabs (pages).
   */
  public async fetchJsonList(): Promise<ChromiumTabInfo[]> {
    const rawList = await this.httpGetJson<any[]>('/json/list', 2500);
    if (!Array.isArray(rawList)) return [];

    return rawList
      .filter((item) => item && (item.type === 'page' || !item.type))
      .map((item) => ({
        id: item.id || '',
        title: item.title || 'Untitled',
        url: item.url || 'about:blank',
        type: item.type || 'page',
        description: item.description,
        webSocketDebuggerUrl: item.webSocketDebuggerUrl,
        devtoolsFrontendUrl: item.devtoolsFrontendUrl,
        faviconUrl: item.faviconUrl,
      }));
  }

  /**
   * Opens a new tab with the given URL via /json/new?${url}.
   */
  public async createTab(url = 'about:blank'): Promise<ChromiumTabInfo | null> {
    const encodedUrl = encodeURIComponent(url);
    const result = await this.httpAction(`/json/new?${encodedUrl}`, 'PUT', 3000);
    if (result && result.id) {
      const tab: ChromiumTabInfo = {
        id: result.id,
        title: result.title || 'New Tab',
        url: result.url || url,
        type: result.type || 'page',
        webSocketDebuggerUrl: result.webSocketDebuggerUrl,
      };
      await this.checkConnection();
      return tab;
    }
    return null;
  }

  /**
   * Focuses/activates a specific tab window via /json/activate/${id}.
   */
  public async activateTab(targetId: string): Promise<boolean> {
    if (!targetId) return false;
    const res = await this.httpAction(`/json/activate/${encodeURIComponent(targetId)}`, 'GET', 2000);
    return res !== null;
  }

  /**
   * Closes a specific tab via /json/close/${id}.
   */
  public async closeTab(targetId: string): Promise<boolean> {
    if (!targetId) return false;
    const res = await this.httpAction(`/json/close/${encodeURIComponent(targetId)}`, 'GET', 2000);
    await this.checkConnection();
    return res !== null;
  }

  /**
   * Safely connects a WebSocket to Chromium CDP if not already connected.
   */
  public async ensureWebSocketConnection(): Promise<WebSocket | null> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    const version = await this.fetchJsonVersion();
    if (!version || !version.webSocketDebuggerUrl) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(version.webSocketDebuggerUrl!);

        const timer = setTimeout(() => {
          try {
            ws.close();
          } catch {}
          resolve(null);
        }, 3000);

        ws.on('open', () => {
          clearTimeout(timer);
          this.ws = ws;
          this.isConnected = true;
          resolve(ws);
        });

        ws.on('message', (data: any) => {
          this.handleWsMessage(data);
        });

        ws.on('close', () => {
          this.ws = null;
          this.rejectAllPending('WebSocket connection closed');
        });

        ws.on('error', () => {
          clearTimeout(timer);
          this.ws = null;
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  private handleWsMessage(raw: any): void {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pendingCommands.has(msg.id)) {
        const { resolve, reject, timer } = this.pendingCommands.get(msg.id)!;
        clearTimeout(timer);
        this.pendingCommands.delete(msg.id);

        if (msg.error) {
          reject(new Error(msg.error.message || 'CDP Command Error'));
        } else {
          resolve(msg.result);
        }
      }
    } catch (_) {}
  }

  private rejectAllPending(reason: string): void {
    for (const [, { reject, timer }] of this.pendingCommands.entries()) {
      clearTimeout(timer);
      reject(new Error(reason));
    }
    this.pendingCommands.clear();
  }

  private disconnectWs(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.rejectAllPending('Disconnected');
  }

  /**
   * Sends a structured CDP command over WebSocket.
   */
  public async sendCdpCommand<T = any>(
    method: string,
    params: Record<string, any> = {},
    sessionId?: string,
    timeoutMs = 4000
  ): Promise<T> {
    const ws = await this.ensureWebSocketConnection();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Chromium CDP WebSocket is not connected');
    }

    const id = this.messageIdCounter++;
    const payload: any = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingCommands.has(id)) {
          this.pendingCommands.delete(id);
          reject(new Error(`CDP command "${method}" timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingCommands.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify(payload));
    });
  }

  /**
   * Navigates a specific tab via its debugger WebSocket or HTTP.
   */
  public async navigateTab(targetTabId: string, url: string): Promise<boolean> {
    const tabs = await this.fetchJsonList();
    const tab = tabs.find((t) => t.id === targetTabId) || (tabs.length > 0 ? tabs[0] : null);

    if (tab && tab.webSocketDebuggerUrl) {
      return new Promise<boolean>((resolve) => {
        try {
          const ws = new WebSocket(tab.webSocketDebuggerUrl!);
          const timer = setTimeout(() => {
            try {
              ws.close();
            } catch (_) {}
            resolve(false);
          }, 3000);

          ws.on('open', () => {
            const cmd = JSON.stringify({
              id: 1,
              method: 'Page.navigate',
              params: { url },
            });
            ws.send(cmd);
          });

          ws.on('message', () => {
            clearTimeout(timer);
            try {
              ws.close();
            } catch (_) {}
            resolve(true);
          });

          ws.on('error', () => {
            clearTimeout(timer);
            resolve(false);
          });
        } catch {
          resolve(false);
        }
      });
    }

    // Fallback: create tab with new url
    const newTab = await this.createTab(url);
    return newTab !== null;
  }

  /**
   * Verifies whether any open tab in Chromium has navigated to the expected target URL or domain.
   */
  public async verifyNavigation(targetUrl: string, maxWaitMs = 3500): Promise<{ verified: boolean; activeTab?: ChromiumTabInfo }> {
    const startTime = Date.now();
    let targetHost = '';
    try {
      targetHost = new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      targetHost = targetUrl.toLowerCase();
    }

    while (Date.now() - startTime < maxWaitMs) {
      const tabs = await this.fetchJsonList();
      const match = tabs.find((t) => {
        if (!t.url || t.url === 'about:blank') return false;
        try {
          const tabHost = new URL(t.url).hostname.replace(/^www\./, '').toLowerCase();
          return (
            t.url.toLowerCase().startsWith(targetUrl.toLowerCase()) ||
            tabHost === targetHost ||
            tabHost.includes(targetHost) ||
            targetHost.includes(tabHost)
          );
        } catch {
          return t.url.toLowerCase().includes(targetHost);
        }
      });

      if (match) {
        this.cachedTabs = tabs;
        return { verified: true, activeTab: match };
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return { verified: false };
  }

  /**
   * Diagnostics status provider.
   */
  public getDiagnostics(executableDetected = false, executablePath?: string): ChromiumDiagnostics {
    const isControlConnected = this.isConnected;
    const activeTab = this.cachedTabs.length > 0 ? this.cachedTabs[0] : null;

    return {
      browserName: 'Chromium',
      capabilityState: isControlConnected ? 'CONNECTED' : 'NOT_AVAILABLE',
      chromium: executableDetected || isControlConnected ? 'AVAILABLE' : 'NOT_AVAILABLE',
      cdp: isControlConnected ? 'AVAILABLE' : 'NOT_AVAILABLE',
      browserControl: isControlConnected ? 'READY' : 'NOT_AVAILABLE',
      chromiumDetected: executableDetected || isControlConnected ? 'YES' : 'NO',
      chromiumRunning: isControlConnected || this.cachedVersion !== null ? 'YES' : 'NO',
      cdpAvailable: isControlConnected ? 'YES' : 'NO',
      cdpConnected: isControlConnected ? 'YES' : 'NO',
      activeTabUrl: activeTab ? activeTab.url : 'None',
      activeTabTitle: activeTab ? activeTab.title : 'None',
      tabsCount: this.cachedTabs.length,
      cdpPort: this.cdpPort,
      browserVersion: this.cachedVersion?.browser,
      executablePath: executablePath || undefined,
      developerRequirement: !isControlConnected
        ? 'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.'
        : undefined,
      developerMessage:
        'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.',
      lastCheckedAt: new Date(this.lastCheckedTime || Date.now()).toISOString(),
    };
  }

  public getCachedTabs(): ChromiumTabInfo[] {
    return [...this.cachedTabs];
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}
