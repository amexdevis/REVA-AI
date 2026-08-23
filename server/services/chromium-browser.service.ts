/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChromiumConnectionManager } from './chromium-connection-manager.service.js';
import {
  ChromiumTabInfo,
  ChromiumDiagnostics,
  ChromiumOperationResult,
} from '../types/browser.types.js';

export type BrowserUrlCallback = (url: string) => void;

/**
 * ChromiumBrowserService
 * Core browser control engine for REVA with Chromium as the configured browser.
 * Configuration: BROWSER_NAME = 'Chromium'
 * 
 * Safety & Security Guarantees:
 * - Uses dedicated automation profile (/tmp/reva-chromium-profile)
 * - Never extracts passwords, cookies, or auth tokens
 * - Never bypasses CAPTCHAs or logins
 * - Never executes arbitrary JavaScript from Gemini
 * - Honest, accurate reporting of browser actions
 */
export class ChromiumBrowserService {
  private static instance: ChromiumBrowserService | null = null;

  public static readonly BROWSER_NAME = 'Chromium';
  private connectionManager: ChromiumConnectionManager;
  private urlCallbacks: BrowserUrlCallback[] = [];
  private resolvedExecutablePath: string | null = null;
  private hasCheckedExecutable = false;

  // Shortcut aliases for instant natural speech navigation
  private websiteAliases: Record<string, string> = {
    youtube: 'https://www.youtube.com',
    'youtube.com': 'https://www.youtube.com',
    yt: 'https://www.youtube.com',
    google: 'https://www.google.com',
    'google.com': 'https://www.google.com',
    github: 'https://github.com',
    'github.com': 'https://github.com',
    reddit: 'https://www.reddit.com',
    'reddit.com': 'https://www.reddit.com',
    twitter: 'https://x.com',
    'x.com': 'https://x.com',
    x: 'https://x.com',
    wikipedia: 'https://www.wikipedia.org',
    'wikipedia.org': 'https://www.wikipedia.org',
    maps: 'https://maps.google.com',
    'google maps': 'https://maps.google.com',
    gmail: 'https://mail.google.com',
    weather: 'https://weather.com',
    netflix: 'https://www.netflix.com',
    amazon: 'https://www.amazon.com',
    spotify: 'https://open.spotify.com',
    linkedin: 'https://www.linkedin.com',
  };

  private constructor() {
    this.connectionManager = ChromiumConnectionManager.getInstance();
  }

  public static getInstance(): ChromiumBrowserService {
    if (!ChromiumBrowserService.instance) {
      ChromiumBrowserService.instance = new ChromiumBrowserService();
    }
    return ChromiumBrowserService.instance;
  }

  public onUrlOpened(cb: BrowserUrlCallback): () => void {
    this.urlCallbacks.push(cb);
    return () => {
      this.urlCallbacks = this.urlCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyUrlOpened(url: string): void {
    for (const cb of this.urlCallbacks) {
      try {
        cb(url);
      } catch (_) {}
    }
  }

  // =========================================================================
  // EXECUTABLE DETECTION & LAUNCH
  // =========================================================================

  /**
   * Discovers the Chromium executable on the host system across Linux, macOS, and Windows.
   */
  public findChromiumExecutable(): string | null {
    if (this.resolvedExecutablePath && fs.existsSync(this.resolvedExecutablePath)) {
      return this.resolvedExecutablePath;
    }

    const platform = os.platform();
    const candidatePaths: string[] = [];

    if (platform === 'linux') {
      candidatePaths.push(
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/usr/local/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/brave-browser'
      );
    } else if (platform === 'darwin') {
      candidatePaths.push(
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        `${os.homedir()}/Applications/Chromium.app/Contents/MacOS/Chromium`,
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
      );
    } else if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      candidatePaths.push(
        path.join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
        path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
        path.join(programFilesX86, 'Chromium', 'Application', 'chrome.exe'),
        path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
    }

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK || fs.constants.R_OK);
          this.resolvedExecutablePath = p;
          this.hasCheckedExecutable = true;
          return p;
        } catch (_) {}
      }
    }

    this.hasCheckedExecutable = true;
    return null;
  }

  /**
   * Launches or connects to Chromium browser instance.
   * If Chromium is already running on the CDP port, reuses the existing instance.
   * If not running, launches a dedicated instance with remote debugging port.
   */
  public async launchChromium(targetUrl?: string): Promise<ChromiumOperationResult> {
    const isConnected = await this.connectionManager.checkConnection();

    if (isConnected) {
      // Reuse existing session
      if (targetUrl) {
        return this.openUrlInChromium(targetUrl);
      }
      return {
        success: true,
        action: 'reuse_chromium',
        spokenSummary: 'Connected to your existing Chromium session.',
        permissionLevel: 'READ_ONLY',
      };
    }

    const execPath = this.findChromiumExecutable();
    if (!execPath) {
      return {
        success: false,
        action: 'launch_chromium',
        error: "Chromium executable was not found on this system.",
        spokenSummary: "Chromium isn't available on this computer.",
        permissionLevel: 'READ_ONLY',
      };
    }

    // Dedicated automation profile to isolate user credentials/passwords/cookies
    const automationProfileDir = path.join(os.tmpdir(), 'reva-chromium-profile');
    try {
      if (!fs.existsSync(automationProfileDir)) {
        fs.mkdirSync(automationProfileDir, { recursive: true });
      }
    } catch (_) {}

    const args = [
      `--remote-debugging-port=${this.connectionManager.getPort()}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${automationProfileDir}`,
      '--disable-background-networking',
      '--disable-sync',
    ];

    if (targetUrl) {
      args.push(targetUrl);
    } else {
      args.push('about:blank');
    }

    try {
      const child = spawn(execPath, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Poll connection manager for up to 3 seconds until CDP is ready
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const ready = await this.connectionManager.checkConnection();
        if (ready) {
          if (targetUrl) {
            this.notifyUrlOpened(targetUrl);
          }
          return {
            success: true,
            action: 'launch_chromium',
            url: targetUrl || 'about:blank',
            spokenSummary: targetUrl ? `Opened ${targetUrl} in Chromium.` : 'Chromium launched and ready.',
            permissionLevel: 'REVERSIBLE',
          };
        }
      }

      // If CDP port wasn't opened in time
      return {
        success: true,
        action: 'launch_chromium',
        spokenSummary: 'Chromium was launched.',
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'launch_chromium',
        error: err?.message || 'Failed to spawn Chromium process',
        spokenSummary: "I couldn't launch Chromium.",
        permissionLevel: 'READ_ONLY',
      };
    }
  }

  // =========================================================================
  // URL NAVIGATION & SEARCH
  // =========================================================================

  /**
   * Validates and parses raw user input into a secure HTTP/HTTPS URL.
   * Handles natural aliases ("youtube", "open youtube", "search youtube for lo-fi music").
   */
  public parseAndValidateUrl(rawInput: string): {
    valid: boolean;
    url?: string;
    siteName?: string;
    error?: string;
  } {
    let target = (rawInput || '').trim();
    if (!target) {
      return { valid: false, error: 'Empty URL or website name provided.' };
    }

    // 1. Check for specific search patterns (e.g. "search youtube for lo-fi beats")
    const searchMatch = target.match(/^(?:search\s+)?(youtube|google|github|reddit|wikipedia)\s+(?:for|about)\s+(.+)$/i);
    if (searchMatch) {
      const service = searchMatch[1].toLowerCase();
      const query = encodeURIComponent(searchMatch[2].trim());
      if (service === 'youtube') {
        return {
          valid: true,
          url: `https://www.youtube.com/results?search_query=${query}`,
          siteName: 'YouTube',
        };
      } else if (service === 'google') {
        return {
          valid: true,
          url: `https://www.google.com/search?q=${query}`,
          siteName: 'Google',
        };
      } else if (service === 'github') {
        return {
          valid: true,
          url: `https://github.com/search?q=${query}`,
          siteName: 'GitHub',
        };
      } else if (service === 'reddit') {
        return {
          valid: true,
          url: `https://www.reddit.com/search/?q=${query}`,
          siteName: 'Reddit',
        };
      } else if (service === 'wikipedia') {
        return {
          valid: true,
          url: `https://en.wikipedia.org/wiki/Special:Search?search=${query}`,
          siteName: 'Wikipedia',
        };
      }
    }

    // 2. Check alias map
    const cleanKey = target.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    if (this.websiteAliases[cleanKey]) {
      target = this.websiteAliases[cleanKey];
    } else if (!/^https?:\/\//i.test(target)) {
      // If it looks like a domain name with a dot and no spaces
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        // Fallback to Google search
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }

    // 3. Security Validation: strictly allow only http: and https: schemes
    try {
      const parsed = new URL(target);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: `Unsafe scheme "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
        };
      }

      // Compute friendly site name
      let siteName = parsed.hostname.replace(/^www\./, '');
      const hostPart = siteName.split('.')[0] || siteName;
      siteName = hostPart.charAt(0).toUpperCase() + hostPart.slice(1);

      return {
        valid: true,
        url: target,
        siteName,
      };
    } catch {
      return {
        valid: false,
        error: `Invalid URL structure: "${rawInput}".`,
      };
    }
  }

  /**
   * Navigates Chromium to a verified URL.
   * Performs real navigation via CDP and verifies the active tab URL before reporting success.
   * Never fakes success.
   */
  public async navigateChromium(rawUrl: string): Promise<ChromiumOperationResult> {
    const parsed = this.parseAndValidateUrl(rawUrl);
    if (!parsed.valid || !parsed.url) {
      return {
        success: false,
        action: 'navigate_chromium',
        error: parsed.error || 'INVALID_URL',
        errorCode: 'INVALID_URL',
        spokenSummary: "I couldn't open that website because the address is invalid or uses an unsupported scheme.",
        permissionLevel: 'READ_ONLY',
      };
    }

    const validatedUrl = parsed.url;
    const siteName = parsed.siteName || 'the website';

    // 1. Check if Chromium CDP is connected
    let isConnected = await this.connectionManager.checkConnection();

    // 2. If not connected, check if Chromium executable exists and try to launch it
    if (!isConnected) {
      const execPath = this.findChromiumExecutable();
      if (execPath) {
        await this.launchChromium(validatedUrl);
        isConnected = await this.connectionManager.checkConnection();
      }
    }

    // 3. If STILL not connected, honestly report CDP unavailable (NO FAKE SUCCESS)
    if (!isConnected) {
      const execPath = this.findChromiumExecutable();
      const errorMsg = execPath
        ? 'Chromium is running, but browser control (CDP) is unavailable.'
        : 'Chromium browser control is not available in this environment.';

      return {
        success: false,
        action: 'navigate_chromium',
        error: 'CDP_NOT_AVAILABLE',
        errorCode: 'CDP_NOT_AVAILABLE',
        spokenSummary: 'Chromium browser control is not available in this environment. Chromium must be started with a supported remote-debugging endpoint.',
        developerRequirement: 'Chromium must be started with a supported remote-debugging/CDP endpoint (e.g. chromium --remote-debugging-port=9222).',
        permissionLevel: 'READ_ONLY',
      };
    }

    // 4. If connected, execute REAL navigation on tab
    try {
      const tabs = await this.connectionManager.fetchJsonList();
      let targetTabId: string | undefined;

      if (tabs.length > 0) {
        // Reuse existing tab
        const activeTab = tabs[0];
        targetTabId = activeTab.id;
        await this.connectionManager.navigateTab(activeTab.id, validatedUrl);
        await this.connectionManager.activateTab(activeTab.id);
      } else {
        // Create new tab with URL
        const createdTab = await this.connectionManager.createTab(validatedUrl);
        if (createdTab) {
          targetTabId = createdTab.id;
          await this.connectionManager.activateTab(createdTab.id);
        }
      }

      // 5. Real Verification: poll tabs to verify the active tab URL actually updated
      const verification = await this.connectionManager.verifyNavigation(validatedUrl, 3500);

      if (verification.verified && verification.activeTab) {
        this.notifyUrlOpened(validatedUrl);
        const spoken = siteName.toLowerCase().includes('youtube')
          ? 'YouTube is open.'
          : `You're on ${siteName}.`;

        return {
          success: true,
          action: 'navigate_chromium',
          url: verification.activeTab.url || validatedUrl,
          title: verification.activeTab.title || siteName,
          tabId: verification.activeTab.id,
          verified: true,
          spokenSummary: spoken,
          permissionLevel: 'REVERSIBLE',
        };
      }

      // If navigation command was sent but verification could not confirm URL change
      return {
        success: false,
        action: 'navigate_chromium',
        error: 'NAVIGATION_VERIFICATION_FAILED',
        errorCode: 'NAVIGATION_VERIFICATION_FAILED',
        spokenSummary: `I sent the command, but could not verify that Chromium navigated to ${siteName}.`,
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'navigate_chromium',
        error: err?.message || 'NAVIGATION_FAILED',
        errorCode: 'NAVIGATION_TIMEOUT',
        spokenSummary: `I couldn't navigate Chromium to ${siteName}.`,
        permissionLevel: 'REVERSIBLE',
      };
    }
  }

  /**
   * Alias for navigateChromium for tool compatibility.
   */
  public async openUrlInChromium(rawUrl: string): Promise<ChromiumOperationResult> {
    return this.navigateChromium(rawUrl);
  }

  // =========================================================================
  // TAB MANAGEMENT
  // =========================================================================

  /**
   * Lists all currently open tabs in Chromium.
   */
  public async listTabs(): Promise<ChromiumOperationResult> {
    const isConnected = await this.connectionManager.checkConnection();
    if (!isConnected) {
      return {
        success: false,
        action: 'list_tabs',
        error: 'Chromium is not connected via CDP.',
        spokenSummary: "Chromium is open, but I can't connect to its browser-control interface.",
        permissionLevel: 'READ_ONLY',
      };
    }

    const tabs = await this.connectionManager.fetchJsonList();
    const count = tabs.length;
    const spokenSummary =
      count === 0
        ? 'There are no open tabs in Chromium.'
        : count === 1
        ? `You have 1 open tab: "${tabs[0].title}".`
        : `You have ${count} open tabs in Chromium. The active one is "${tabs[0].title}".`;

    return {
      success: true,
      action: 'list_tabs',
      tabs,
      tabCount: count,
      spokenSummary,
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * Retrieves the currently active/focused tab in Chromium.
   */
  public async getActiveTab(): Promise<ChromiumOperationResult> {
    const isConnected = await this.connectionManager.checkConnection();
    if (!isConnected) {
      return {
        success: false,
        action: 'get_active_tab',
        error: 'Chromium is not connected via CDP.',
        spokenSummary: "I can't read the active tab because Chromium browser control is not connected.",
        permissionLevel: 'READ_ONLY',
      };
    }

    const tabs = await this.connectionManager.fetchJsonList();
    if (tabs.length === 0) {
      return {
        success: true,
        action: 'get_active_tab',
        spokenSummary: 'No active tabs open in Chromium.',
        permissionLevel: 'READ_ONLY',
      };
    }

    const activeTab = tabs[0];
    return {
      success: true,
      action: 'get_active_tab',
      tabId: activeTab.id,
      url: activeTab.url,
      title: activeTab.title,
      spokenSummary: `The active tab is "${activeTab.title}" at ${activeTab.url}.`,
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * Opens a new tab with an optional URL.
   */
  public async openNewTab(url = 'about:blank'): Promise<ChromiumOperationResult> {
    let target = url;
    if (target !== 'about:blank') {
      const parsed = this.parseAndValidateUrl(target);
      if (parsed.valid && parsed.url) {
        target = parsed.url;
      }
    }

    const isConnected = await this.connectionManager.checkConnection();
    if (!isConnected) {
      return this.launchChromium(target);
    }

    const tab = await this.connectionManager.createTab(target);
    if (!tab) {
      return {
        success: false,
        action: 'open_new_tab',
        error: 'Failed to create new tab via CDP.',
        spokenSummary: "I couldn't open a new tab in Chromium.",
        permissionLevel: 'REVERSIBLE',
      };
    }

    if (target !== 'about:blank') {
      this.notifyUrlOpened(target);
    }

    return {
      success: true,
      action: 'open_new_tab',
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      spokenSummary: target === 'about:blank' ? 'Opened a new blank tab.' : `Opened ${tab.title || target} in a new tab.`,
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * Focuses/activates a specific tab.
   */
  public async focusTab(tabId: string): Promise<ChromiumOperationResult> {
    if (!tabId) {
      return {
        success: false,
        action: 'focus_tab',
        error: 'Missing tab ID.',
        spokenSummary: 'Please specify which tab to focus.',
        permissionLevel: 'READ_ONLY',
      };
    }

    const success = await this.connectionManager.activateTab(tabId);
    return {
      success,
      action: 'focus_tab',
      tabId,
      spokenSummary: success ? 'Switched to that tab.' : "I couldn't switch to that tab.",
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * Closes a specific tab.
   */
  public async closeTab(tabId: string): Promise<ChromiumOperationResult> {
    if (!tabId) {
      return {
        success: false,
        action: 'close_tab',
        error: 'Missing tab ID.',
        spokenSummary: 'Please specify which tab to close.',
        permissionLevel: 'READ_ONLY',
      };
    }

    const success = await this.connectionManager.closeTab(tabId);
    return {
      success,
      action: 'close_tab',
      tabId,
      spokenSummary: success ? 'Closed the tab.' : "I couldn't close that tab.",
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * Retrieves basic, safe page metadata (title, URL, active tab) without scraping private data.
   * Explicitly prevents extracting passwords, cookies, or authentication tokens.
   */
  public async getPageInfo(): Promise<ChromiumOperationResult> {
    const isConnected = await this.connectionManager.checkConnection();
    if (!isConnected) {
      return {
        success: false,
        action: 'get_page_info',
        error: 'Chromium is not connected via CDP.',
        spokenSummary: "Chromium is open, but I can't read page information without browser control.",
        permissionLevel: 'READ_ONLY',
      };
    }

    const tabs = await this.connectionManager.fetchJsonList();
    if (tabs.length === 0) {
      return {
        success: true,
        action: 'get_page_info',
        spokenSummary: 'No active webpage is currently open in Chromium.',
        permissionLevel: 'READ_ONLY',
      };
    }

    const active = tabs[0];
    return {
      success: true,
      action: 'get_page_info',
      title: active.title,
      url: active.url,
      tabId: active.id,
      spokenSummary: `You are viewing "${active.title}" at ${active.url}.`,
      permissionLevel: 'READ_ONLY',
    };
  }

  // =========================================================================
  // DIAGNOSTICS
  // =========================================================================

  public getDiagnostics(): ChromiumDiagnostics {
    const execPath = this.findChromiumExecutable();
    return this.connectionManager.getDiagnostics(Boolean(execPath), execPath || undefined);
  }
}
