/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChromiumBrowserService } from './chromium-browser.service.js';
import { ChromiumConnectionManager } from './chromium-connection-manager.service.js';
import {
  BrowserCapabilityState,
  ChromiumDiagnostics,
  ChromiumOperationResult,
} from '../types/browser.types.js';

/**
 * BrowserCapabilityManager
 * Manages Chromium browser control as an OPTIONAL system capability.
 * 
 * Safety & Integrity Principles:
 * - Never fakes browser control or navigation.
 * - Never claims a website is open if CDP is unavailable.
 * - Does not repeatedly spam or retry unreachable CDP ports.
 * - Leaves web search, voice, memory, and companion features working independently.
 */
export class BrowserCapabilityManager {
  private static instance: BrowserCapabilityManager | null = null;

  private state: BrowserCapabilityState = 'NOT_AVAILABLE';
  private browserService: ChromiumBrowserService;
  private connectionManager: ChromiumConnectionManager;
  private lastCheckTime = 0;
  private isChecking = false;

  private constructor() {
    this.browserService = ChromiumBrowserService.getInstance();
    this.connectionManager = ChromiumConnectionManager.getInstance();
    // Initial silent check
    this.evaluateCapability().catch(() => {});
  }

  public static getInstance(): BrowserCapabilityManager {
    if (!BrowserCapabilityManager.instance) {
      BrowserCapabilityManager.instance = new BrowserCapabilityManager();
    }
    return BrowserCapabilityManager.instance;
  }

  public getState(): BrowserCapabilityState {
    return this.state;
  }

  public isAvailable(): boolean {
    return this.state === 'AVAILABLE' || this.state === 'CONNECTED';
  }

  /**
   * Evaluates the availability of Chromium browser control.
   * State transitions:
   * - If CDP is connected: CONNECTED / AVAILABLE
   * - If CDP cannot be reached: NOT_AVAILABLE
   * - If an unexpected error occurs: ERROR / NOT_AVAILABLE
   */
  public async evaluateCapability(force = false): Promise<BrowserCapabilityState> {
    // Avoid running checks more frequently than once every 5 seconds unless forced
    const now = Date.now();
    if (!force && now - this.lastCheckTime < 5000 && this.state !== 'CONNECTING') {
      return this.state;
    }

    if (this.isChecking) {
      return this.state;
    }

    this.isChecking = true;
    try {
      this.state = 'CONNECTING';
      const isConnected = await this.connectionManager.checkConnection();
      this.lastCheckTime = Date.now();

      if (isConnected) {
        this.state = 'CONNECTED';
      } else {
        this.state = 'NOT_AVAILABLE';
      }
    } catch {
      this.state = 'NOT_AVAILABLE';
    } finally {
      this.isChecking = false;
    }

    return this.state;
  }

  /**
   * Extracts a human-friendly site name or topic from a raw URL or query.
   */
  public extractSiteTopic(rawInput: string): string {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) return 'the web';

    // Common names
    const lower = trimmed.toLowerCase();
    if (lower.includes('youtube') || lower === 'yt') return 'YouTube';
    if (lower.includes('google')) return 'Google';
    if (lower.includes('github')) return 'GitHub';
    if (lower.includes('reddit')) return 'Reddit';
    if (lower.includes('twitter') || lower.includes('x.com')) return 'X';
    if (lower.includes('wikipedia')) return 'Wikipedia';
    if (lower.includes('spotify')) return 'Spotify';
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('amazon')) return 'Amazon';
    if (lower.includes('linkedin')) return 'LinkedIn';

    // Parse URL hostname if possible
    try {
      let withProtocol = trimmed;
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        withProtocol = 'https://' + trimmed;
      }
      const parsed = new URL(withProtocol);
      const host = parsed.hostname.replace(/^www\./, '');
      const parts = host.split('.');
      if (parts.length > 0 && parts[0]) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    } catch {
      // Return raw input
    }

    return trimmed;
  }

  /**
   * Executes a navigation request via the optional browser capability.
   * If browser control is NOT_AVAILABLE, returns honest spoken explanation.
   * Never fakes success.
   */
  public async handleNavigationRequest(rawUrl: string): Promise<ChromiumOperationResult> {
    const siteTopic = this.extractSiteTopic(rawUrl);

    // Evaluate capability without aggressive polling
    const capability = await this.evaluateCapability();

    // If browser control is NOT AVAILABLE in the current runtime:
    if (capability !== 'CONNECTED' && capability !== 'AVAILABLE') {
      return {
        success: false,
        action: 'navigate_chromium',
        error: 'BROWSER_CONTROL_NOT_AVAILABLE',
        errorCode: 'CDP_NOT_AVAILABLE',
        spokenSummary: `I can search the web for ${siteTopic}, but I don't currently have access to control your Chromium browser.`,
        developerRequirement:
          'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.',
        permissionLevel: 'READ_ONLY',
      };
    }

    // If browser control IS available, execute via ChromiumBrowserService with full verification
    try {
      const result = await this.browserService.navigateChromium(rawUrl);
      if (!result.success && result.errorCode === 'CDP_NOT_AVAILABLE') {
        this.state = 'NOT_AVAILABLE';
        return {
          ...result,
          spokenSummary: `I can search the web for ${siteTopic}, but I don't currently have access to control your Chromium browser.`,
          developerRequirement:
            'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.',
        };
      }
      return result;
    } catch (err: any) {
      this.state = 'ERROR';
      return {
        success: false,
        action: 'navigate_chromium',
        error: err?.message || 'BROWSER_EXECUTION_ERROR',
        errorCode: 'CDP_NOT_AVAILABLE',
        spokenSummary: `I can search the web for ${siteTopic}, but I don't currently have access to control your Chromium browser.`,
        developerRequirement:
          'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.',
        permissionLevel: 'READ_ONLY',
      };
    }
  }

  /**
   * Generates standard developer diagnostics.
   */
  public getDiagnostics(): ChromiumDiagnostics {
    const rawDiag = this.browserService.getDiagnostics();
    const hasExecutable = rawDiag.chromiumDetected === 'YES';
    const isCdpConnected = rawDiag.cdpConnected === 'YES' && this.isAvailable();

    const chromiumStatus: 'AVAILABLE' | 'NOT_AVAILABLE' = hasExecutable ? 'AVAILABLE' : 'NOT_AVAILABLE';
    const cdpStatus: 'AVAILABLE' | 'NOT_AVAILABLE' = isCdpConnected ? 'AVAILABLE' : 'NOT_AVAILABLE';
    const browserControlStatus: 'READY' | 'NOT_AVAILABLE' = isCdpConnected ? 'READY' : 'NOT_AVAILABLE';

    return {
      browserName: 'Chromium',
      capabilityState: this.state,
      chromium: chromiumStatus,
      cdp: cdpStatus,
      browserControl: browserControlStatus,
      chromiumDetected: rawDiag.chromiumDetected,
      chromiumRunning: rawDiag.chromiumRunning,
      cdpAvailable: isCdpConnected ? 'YES' : 'NO',
      cdpConnected: isCdpConnected ? 'YES' : 'NO',
      activeTabUrl: rawDiag.activeTabUrl,
      activeTabTitle: rawDiag.activeTabTitle,
      tabsCount: rawDiag.tabsCount,
      cdpPort: rawDiag.cdpPort,
      browserVersion: rawDiag.browserVersion,
      executablePath: rawDiag.executablePath,
      developerRequirement:
        'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.',
      developerMessage:
        'Chromium browser control requires a reachable CDP endpoint in the same accessible runtime.',
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
