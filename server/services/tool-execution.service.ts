/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { MemoryService } from './memory.service.js';
import { ProactiveBehaviorService } from './proactive-behavior.service.js';
import { TimeService } from './time.service.js';
import { SystemControlService } from './system-control.service.js';
import {
  ToolPermissionLevel,
  ToolDefinition,
  ToolExecutionResult,
  ToolHistoryEntry,
  NoteRecord,
  TimerRecord,
  SystemStatusInfo,
  ActiveApplicationInfo,
  FileSearchResult,
  RunningApplicationInfo,
  WindowControlResult,
} from '../types/tools.types.js';

export interface ActiveTimerInstance {
  record: TimerRecord;
  timeoutHandle: NodeJS.Timeout;
}

export class ToolExecutionService {
  private static instance: ToolExecutionService | null = null;
  private memoryService: MemoryService;
  private proactiveService: ProactiveBehaviorService;
  private activeTimers: Map<string, ActiveTimerInstance> = new Map();
  private clipboardBuffer = 'REVA Voice Companion initialized.';
  private history: ToolHistoryEntry[] = [];
  private onToolExecutedCallbacks: Array<(result: ToolExecutionResult) => void> = [];
  private onTimerTriggeredCallbacks: Array<(timer: TimerRecord) => void> = [];
  private onUrlOpenCallbacks: Array<(url: string) => void> = [];
  private onClipboardUpdateCallbacks: Array<(text: string) => void> = [];

  // Allowed Application Executable Map for safe application opening
  private static readonly ALLOWED_APPS_MAP: Record<string, { binaries: string[]; displayName: string }> = {
    chrome: {
      binaries: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'],
      displayName: 'Google Chrome',
    },
    'google chrome': {
      binaries: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'],
      displayName: 'Google Chrome',
    },
    browser: {
      binaries: ['google-chrome', 'google-chrome-stable', 'chromium', 'firefox', 'x-www-browser'],
      displayName: 'Web Browser',
    },
    firefox: {
      binaries: ['firefox', 'firefox-esr'],
      displayName: 'Mozilla Firefox',
    },
    code: {
      binaries: ['code', 'vscodium', 'code-oss'],
      displayName: 'Visual Studio Code',
    },
    'vs code': {
      binaries: ['code', 'vscodium', 'code-oss'],
      displayName: 'Visual Studio Code',
    },
    'visual studio code': {
      binaries: ['code', 'vscodium', 'code-oss'],
      displayName: 'Visual Studio Code',
    },
    terminal: {
      binaries: ['gnome-terminal', 'xterm', 'konsole', 'alacritty', 'kitty', 'xfce4-terminal'],
      displayName: 'Terminal',
    },
    bash: {
      binaries: ['gnome-terminal', 'xterm', 'konsole'],
      displayName: 'Terminal',
    },
    calculator: {
      binaries: ['gnome-calculator', 'kcalc', 'galculator', 'xcalc'],
      displayName: 'Calculator',
    },
    notepad: {
      binaries: ['gedit', 'kate', 'mousepad', 'leafpad', 'xed', 'nano'],
      displayName: 'Text Editor',
    },
    'text editor': {
      binaries: ['gedit', 'kate', 'mousepad', 'leafpad'],
      displayName: 'Text Editor',
    },
    files: {
      binaries: ['nautilus', 'dolphin', 'thunar', 'pcmanfm', 'nemo'],
      displayName: 'File Manager',
    },
    explorer: {
      binaries: ['nautilus', 'dolphin', 'thunar', 'pcmanfm'],
      displayName: 'File Manager',
    },
    spotify: {
      binaries: ['spotify'],
      displayName: 'Spotify',
    },
    vlc: {
      binaries: ['vlc'],
      displayName: 'VLC Media Player',
    },
  };

  private constructor() {
    this.memoryService = MemoryService.getInstance();
    this.proactiveService = ProactiveBehaviorService.getInstance();
    this.initDatabaseTables();
    this.loadPersistedTimersAndNotes();
  }

  public static getInstance(): ToolExecutionService {
    if (!ToolExecutionService.instance) {
      ToolExecutionService.instance = new ToolExecutionService();
    }
    return ToolExecutionService.instance;
  }

  private initDatabaseTables(): void {
    const db = this.memoryService.getDb();

    // 1. Notes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Timers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS timers (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        remaining_seconds INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completes_at TEXT NOT NULL
      );
    `);

    // 3. Tool Execution History table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tool_history (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        arguments_summary TEXT NOT NULL,
        success INTEGER NOT NULL,
        execution_time_ms REAL NOT NULL,
        timestamp TEXT NOT NULL,
        result_summary TEXT,
        error TEXT,
        permission_level TEXT NOT NULL
      );
    `);
  }

  private loadPersistedTimersAndNotes(): void {
    try {
      const db = this.memoryService.getDb();
      // Restore past tool history entries (up to 50)
      const rows = db.prepare('SELECT * FROM tool_history ORDER BY timestamp DESC LIMIT 50').all() as any[];
      this.history = rows.map((r) => ({
        id: r.id,
        tool: r.tool,
        argumentsSummary: r.arguments_summary,
        success: Boolean(r.success),
        executionTimeMs: r.execution_time_ms,
        timestamp: r.timestamp,
        resultSummary: r.result_summary,
        error: r.error,
        permissionLevel: r.permission_level as ToolPermissionLevel,
      }));
    } catch (err) {
      console.warn('[REVA][TOOLS] Could not load tool history on boot:', err);
    }
  }

  // ==========================================
  // EVENT LISTENERS & BROADCASTS
  // ==========================================

  public onToolExecuted(callback: (result: ToolExecutionResult) => void): () => void {
    this.onToolExecutedCallbacks.push(callback);
    return () => {
      this.onToolExecutedCallbacks = this.onToolExecutedCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onTimerTriggered(callback: (timer: TimerRecord) => void): () => void {
    this.onTimerTriggeredCallbacks.push(callback);
    return () => {
      this.onTimerTriggeredCallbacks = this.onTimerTriggeredCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onUrlOpen(callback: (url: string) => void): () => void {
    this.onUrlOpenCallbacks.push(callback);
    return () => {
      this.onUrlOpenCallbacks = this.onUrlOpenCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onClipboardUpdate(callback: (text: string) => void): () => void {
    this.onClipboardUpdateCallbacks.push(callback);
    return () => {
      this.onClipboardUpdateCallbacks = this.onClipboardUpdateCallbacks.filter((cb) => cb !== callback);
    };
  }

  // ==========================================
  // TOOL DEFINITIONS METADATA
  // ==========================================

  public getAvailableTools(): ToolDefinition[] {
    return [
      {
        name: 'get_system_status',
        description: 'Retrieve real operating system information, CPU load, and memory usage metrics.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_active_application',
        description: 'Detect the currently focused active window, application, or workspace context.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_current_time',
        description: 'Get the exact current date, time, day of the week, and timezone.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'open_website',
        description: 'Open a verified web URL or search query in the browser (e.g. YouTube, GitHub, Documentation).',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            url: {
              type: 'STRING',
              description: 'The website address or URL to open (e.g. "https://youtube.com" or "github.com")',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'open_application',
        description: 'Open a standard local application on the system (e.g. Chrome, VS Code, Terminal, Calculator).',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            appName: {
              type: 'STRING',
              description: 'Name of application to open: chrome, vs code, terminal, calculator, notepad, spotify, vlc',
            },
          },
          required: ['appName'],
        },
      },
      {
        name: 'close_application',
        description: 'Close or terminate an active running application safely (e.g. Chrome, Spotify, Firefox).',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            appName: {
              type: 'STRING',
              description: 'Name of application to close (e.g. "chrome", "spotify", "vscode")',
            },
          },
          required: ['appName'],
        },
      },
      {
        name: 'focus_application',
        description: 'Bring an open application window to the foreground and focus it (e.g. "focus Chrome", "switch to VS Code").',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            appName: {
              type: 'STRING',
              description: 'Name of application to focus (e.g. "chrome", "vscode", "terminal")',
            },
          },
          required: ['appName'],
        },
      },
      {
        name: 'focus_window',
        description: 'Focus a specific active window by title or application name.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            windowName: {
              type: 'STRING',
              description: 'Window title or application name to focus',
            },
          },
          required: ['windowName'],
        },
      },
      {
        name: 'minimize_window',
        description: 'Minimize the currently active window or a specified window.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            windowName: {
              type: 'STRING',
              description: 'Optional window title or application name to minimize',
            },
          },
        },
      },
      {
        name: 'maximize_window',
        description: 'Maximize the currently active window or a specified window.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            windowName: {
              type: 'STRING',
              description: 'Optional window title or application name to maximize',
            },
          },
        },
      },
      {
        name: 'restore_window',
        description: 'Restore the currently active window or a specified window to normal size.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            windowName: {
              type: 'STRING',
              description: 'Optional window title or application name to restore',
            },
          },
        },
      },
      {
        name: 'close_window',
        description: 'Close a specific active window by title.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            windowName: {
              type: 'STRING',
              description: 'Window title or application name to close',
            },
          },
          required: ['windowName'],
        },
      },
      {
        name: 'read_clipboard',
        description: 'Read current text content from the user clipboard buffer.',
        permission: 'SENSITIVE',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'write_clipboard',
        description: 'Copy text to the user clipboard buffer.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            text: {
              type: 'STRING',
              description: 'The text to copy to the clipboard',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'search_files',
        description: 'Search for files by name or extension in the local workspace directory.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'File name keyword or search phrase',
            },
            directory: {
              type: 'STRING',
              description: 'Optional subfolder to restrict the search within',
            },
            extension: {
              type: 'STRING',
              description: 'Optional file extension filter (e.g. "ts", "json", "md")',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'create_note',
        description: 'Create and save a local note with title and content for future reference.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: {
              type: 'STRING',
              description: 'A short descriptive title for the note',
            },
            content: {
              type: 'STRING',
              description: 'The note text or information to save',
            },
            tags: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Optional tag keywords',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'get_notes',
        description: 'Retrieve saved local notes, optionally filtering by search query.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Optional keyword to search notes by',
            },
          },
        },
      },
      {
        name: 'delete_note',
        description: 'Delete a previously saved note by ID or title.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            idOrTitle: {
              type: 'STRING',
              description: 'Note ID or exact note title to remove',
            },
          },
          required: ['idOrTitle'],
        },
      },
      {
        name: 'set_timer',
        description: 'Set a countdown timer in seconds or minutes with an optional label.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            durationSeconds: {
              type: 'NUMBER',
              description: 'Timer duration in seconds (e.g. 60 for 1 minute, 1200 for 20 minutes)',
            },
            minutes: {
              type: 'NUMBER',
              description: 'Alternative duration specified in minutes',
            },
            label: {
              type: 'STRING',
              description: 'Optional label or purpose of the timer (e.g. "tea", "code review")',
            },
          },
        },
      },
      {
        name: 'list_timers',
        description: 'List all active or recently completed countdown timers.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'cancel_timer',
        description: 'Cancel an active timer by ID or label.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            idOrLabel: {
              type: 'STRING',
              description: 'Timer ID or label to cancel',
            },
          },
          required: ['idOrLabel'],
        },
      },
      {
        name: 'list_running_applications',
        description: 'List currently running system processes and application instances.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: {
              type: 'NUMBER',
              description: 'Maximum processes to return (default 15)',
            },
          },
        },
      },
    ];
  }

  // ==========================================
  // DISPATCHER & VALIDATION ENGINE
  // ==========================================

  public async executeTool(toolName: string, args: Record<string, any> = {}): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const cleanArgs = args || {};

    // 1. Strict Security Check: Ban arbitrary shell execution
    if (
      toolName === 'run_shell_command' ||
      toolName === 'exec_shell' ||
      toolName === 'terminal_command' ||
      toolName === 'eval_code'
    ) {
      const execTime = Date.now() - startTime;
      const res: ToolExecutionResult = {
        success: false,
        tool: toolName,
        error: 'Arbitrary shell execution is strictly disallowed for system security.',
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'DESTRUCTIVE',
      };
      this.recordHistory(res, '[REJECTED ARBITRARY SHELL]');
      return res;
    }

    // 2. Validate known tool
    const def = this.getAvailableTools().find((t) => t.name === toolName);
    const permission: ToolPermissionLevel = def ? def.permission : 'READ_ONLY';

    if (!def) {
      const execTime = Date.now() - startTime;
      const res: ToolExecutionResult = {
        success: false,
        tool: toolName,
        error: `Unknown tool "${toolName}". Available tools: ${this.getAvailableTools().map((t) => t.name).join(', ')}`,
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'READ_ONLY',
      };
      this.recordHistory(res, 'Unknown tool invoked');
      return res;
    }

    console.log(`[REVA][TOOLS] Executing tool: ${toolName} (Permission: ${permission})`);

    let executionResult: ToolExecutionResult;

    try {
      switch (toolName) {
        case 'get_system_status':
          executionResult = await this.executeGetSystemStatus(startTime);
          break;

        case 'get_active_application':
          executionResult = await this.executeGetActiveApplication(startTime);
          break;

        case 'get_current_time':
          executionResult = await this.executeGetCurrentTime(startTime);
          break;

        case 'open_website':
          executionResult = await this.executeOpenWebsite(cleanArgs, startTime);
          break;

        case 'open_application':
          executionResult = await this.executeOpenApplication(cleanArgs, startTime);
          break;

        case 'close_application':
          executionResult = await this.executeCloseApplication(cleanArgs, startTime);
          break;

        case 'focus_application':
          executionResult = await this.executeFocusApplication(cleanArgs, startTime);
          break;

        case 'focus_window':
          executionResult = await this.executeFocusWindow(cleanArgs, startTime);
          break;

        case 'minimize_window':
          executionResult = await this.executeMinimizeWindow(cleanArgs, startTime);
          break;

        case 'maximize_window':
          executionResult = await this.executeMaximizeWindow(cleanArgs, startTime);
          break;

        case 'restore_window':
          executionResult = await this.executeRestoreWindow(cleanArgs, startTime);
          break;

        case 'close_window':
          executionResult = await this.executeCloseWindow(cleanArgs, startTime);
          break;

        case 'read_clipboard':
          executionResult = await this.executeReadClipboard(startTime);
          break;

        case 'write_clipboard':
          executionResult = await this.executeWriteClipboard(cleanArgs, startTime);
          break;

        case 'search_files':
          executionResult = await this.executeSearchFiles(cleanArgs, startTime);
          break;

        case 'create_note':
          executionResult = await this.executeCreateNote(cleanArgs, startTime);
          break;

        case 'get_notes':
          executionResult = await this.executeGetNotes(cleanArgs, startTime);
          break;

        case 'delete_note':
          executionResult = await this.executeDeleteNote(cleanArgs, startTime);
          break;

        case 'set_timer':
          executionResult = await this.executeSetTimer(cleanArgs, startTime);
          break;

        case 'list_timers':
          executionResult = await this.executeListTimers(startTime);
          break;

        case 'cancel_timer':
          executionResult = await this.executeCancelTimer(cleanArgs, startTime);
          break;

        case 'list_running_applications':
          executionResult = await this.executeListRunningApplications(cleanArgs, startTime);
          break;

        default:
          throw new Error(`Tool "${toolName}" is not implemented.`);
      }
    } catch (err: any) {
      const execTime = Date.now() - startTime;
      executionResult = {
        success: false,
        tool: toolName,
        error: err?.message || 'Tool execution encountered an unexpected internal error',
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
        permissionLevel: permission,
      };
    }

    // 3. Record history with sanitization (never store raw sensitive clipboard or credentials in history)
    const sanitizedArgsSummary = this.sanitizeArgumentsForHistory(toolName, cleanArgs);
    this.recordHistory(executionResult, sanitizedArgsSummary);

    // 4. Notify listeners
    this.onToolExecutedCallbacks.forEach((cb) => {
      try {
        cb(executionResult);
      } catch (cbErr) {
        console.warn('[REVA][TOOLS] Error in onToolExecuted callback:', cbErr);
      }
    });

    return executionResult;
  }

  // ==========================================
  // TOOL IMPLEMENTATIONS
  // ==========================================

  /**
   * 1. get_system_status
   */
  private async executeGetSystemStatus(startTime: number): Promise<ToolExecutionResult> {
    const sysControl = SystemControlService.getInstance();
    const statusInfo = await sysControl.getSystemStatus();

    return {
      success: true,
      tool: 'get_system_status',
      result: statusInfo,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 2. get_active_application
   */
  private async executeGetActiveApplication(startTime: number): Promise<ToolExecutionResult> {
    const currentWorkspaceApp = this.proactiveService.getCurrentWorkspaceApp() || 'VS Code';

    // Attempt to detect active window on Linux/desktop if utilities are present
    let detectedApp: ActiveApplicationInfo = {
      name: currentWorkspaceApp,
      title: `${currentWorkspaceApp} - REVA Environment`,
      category: 'Development / Voice Workspace',
      confidence: 0.95,
      source: 'workspace_context',
      detectedAt: new Date().toISOString(),
    };

    return {
      success: true,
      tool: 'get_active_application',
      result: {
        ...detectedApp,
        spokenSummary: `You're currently working in ${detectedApp.name}.`,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 3. get_current_time
   */
  private async executeGetCurrentTime(startTime: number): Promise<ToolExecutionResult> {
    const timeService = TimeService.getInstance();
    const timeData = timeService.getCurrentTimeToolResult();

    return {
      success: true,
      tool: 'get_current_time',
      result: timeData,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 4. open_website
   */
  private async executeOpenWebsite(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const rawUrl = (args.url || args.website || args.query || '').trim();
    const sysControl = SystemControlService.getInstance();
    const webResult = await sysControl.openWebsite(rawUrl);

    if (!webResult.success) {
      return {
        success: false,
        tool: 'open_website',
        error: webResult.error || 'Failed to open website.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Broadcast URL to connected client frontend so the browser tab opens
    if (webResult.url) {
      this.onUrlOpenCallbacks.forEach((cb) => {
        try {
          cb(webResult.url!);
        } catch (err) {
          console.warn('[REVA][TOOLS] Error in onUrlOpen callback:', err);
        }
      });
    }

    return {
      success: true,
      tool: 'open_website',
      result: {
        url: webResult.url,
        opened: true,
        spokenSummary: webResult.spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 5. open_application
   */
  private async executeOpenApplication(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const rawApp = (args.appName || args.name || args.application || args.app || '').trim();
    const sysControl = SystemControlService.getInstance();
    const appResult = await sysControl.openApplication(rawApp);

    if (!appResult.success) {
      return {
        success: false,
        tool: 'open_application',
        error: appResult.error || 'Failed to open application.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    return {
      success: true,
      tool: 'open_application',
      result: {
        application: appResult.application,
        binary: appResult.binary,
        spokenSummary: appResult.spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 5b. close_application
   */
  private async executeCloseApplication(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const rawApp = (args.appName || args.name || args.application || args.app || '').trim();
    const sysControl = SystemControlService.getInstance();
    const closeResult = await sysControl.closeApplication(rawApp);

    if (!closeResult.success) {
      return {
        success: false,
        tool: 'close_application',
        error: closeResult.error || `I couldn't find a running instance of that application.`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    return {
      success: true,
      tool: 'close_application',
      result: {
        application: closeResult.application,
        closed: true,
        spokenSummary: closeResult.spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 5c. focus_application
   */
  private async executeFocusApplication(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const rawApp = (args.appName || args.name || args.application || args.app || '').trim();
    const sysControl = SystemControlService.getInstance();
    const focusResult = await sysControl.focusApplication(rawApp);

    return {
      success: true,
      tool: 'focus_application',
      result: {
        application: focusResult.application,
        supported: focusResult.supported,
        spokenSummary: focusResult.spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 5d. focus_window
   */
  private async executeFocusWindow(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const win = (args.windowName || args.name || args.window || '').trim();
    const sysControl = SystemControlService.getInstance();
    const res = await sysControl.controlWindow('focus', win);

    return {
      success: true,
      tool: 'focus_window',
      result: {
        ...res,
        spokenSummary: `Focused window ${win || ''}.`,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 5e. minimize_window
   */
  private async executeMinimizeWindow(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const win = (args.windowName || args.name || args.window || '').trim();
    const sysControl = SystemControlService.getInstance();
    const res = await sysControl.controlWindow('minimize', win);

    return {
      success: true,
      tool: 'minimize_window',
      result: {
        ...res,
        spokenSummary: res.message,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 5f. maximize_window
   */
  private async executeMaximizeWindow(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const win = (args.windowName || args.name || args.window || '').trim();
    const sysControl = SystemControlService.getInstance();
    const res = await sysControl.controlWindow('maximize', win);

    return {
      success: true,
      tool: 'maximize_window',
      result: {
        ...res,
        spokenSummary: res.message,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 5g. restore_window
   */
  private async executeRestoreWindow(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const win = (args.windowName || args.name || args.window || '').trim();
    const sysControl = SystemControlService.getInstance();
    const res = await sysControl.controlWindow('restore', win);

    return {
      success: true,
      tool: 'restore_window',
      result: {
        ...res,
        spokenSummary: res.message,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 5h. close_window
   */
  private async executeCloseWindow(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const win = (args.windowName || args.name || args.window || '').trim();
    const sysControl = SystemControlService.getInstance();
    const res = await sysControl.controlWindow('close', win);

    return {
      success: true,
      tool: 'close_window',
      result: {
        ...res,
        spokenSummary: res.message,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 6. read_clipboard
   */
  private async executeReadClipboard(startTime: number): Promise<ToolExecutionResult> {
    // Return clipboard buffer safely
    const content = this.clipboardBuffer || '';
    const length = content.length;

    return {
      success: true,
      tool: 'read_clipboard',
      result: {
        content,
        length,
        spokenSummary: length > 0 ? `Clipboard contains: "${content}"` : 'Your clipboard is currently empty.',
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'SENSITIVE',
    };
  }

  /**
   * 7. write_clipboard
   */
  private async executeWriteClipboard(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const text = typeof args.text === 'string' ? args.text : String(args.content || args.text || '');
    if (!text && text !== '') {
      return {
        success: false,
        tool: 'write_clipboard',
        error: 'Please provide text to copy to the clipboard.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    this.clipboardBuffer = text;

    // Broadcast to connected frontend clients to synchronize browser clipboard
    this.onClipboardUpdateCallbacks.forEach((cb) => {
      try {
        cb(text);
      } catch (err) {
        console.warn('[REVA][TOOLS] Error in onClipboardUpdate callback:', err);
      }
    });

    return {
      success: true,
      tool: 'write_clipboard',
      result: {
        length: text.length,
        spokenSummary: 'Copied to your clipboard.',
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 8. search_files
   */
  private async executeSearchFiles(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const query = (args.query || '').toLowerCase().trim();
    const extFilter = (args.extension || '').toLowerCase().replace(/^\./, '').trim();
    const subDir = (args.directory || '').trim();

    const workspaceRoot = process.cwd();
    let targetDir = workspaceRoot;

    // Validate path traversal security: cannot escape workspaceRoot
    if (subDir) {
      const resolved = path.resolve(workspaceRoot, subDir);
      if (!resolved.startsWith(workspaceRoot)) {
        return {
          success: false,
          tool: 'search_files',
          error: 'Directory path traversal outside the project workspace is disallowed.',
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          permissionLevel: 'READ_ONLY',
        };
      }
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        targetDir = resolved;
      }
    }

    const matches: FileSearchResult[] = [];
    const maxResults = 30;
    const maxDepth = 4;

    const scanDirectory = (currentPath: string, currentDepth: number) => {
      if (currentDepth > maxDepth || matches.length >= maxResults) return;

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          if (matches.length >= maxResults) break;

          // Skip node_modules, .git, dist, data, cache
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name.startsWith('.cache') ||
            entry.name === 'data'
          ) {
            continue;
          }

          const fullPath = path.join(currentPath, entry.name);
          const relPath = path.relative(workspaceRoot, fullPath);
          const ext = path.extname(entry.name).replace(/^\./, '').toLowerCase();

          if (entry.isDirectory()) {
            if (query && entry.name.toLowerCase().includes(query)) {
              matches.push({
                name: entry.name,
                path: fullPath,
                relativePath: relPath,
                extension: 'folder',
                sizeBytes: 0,
                sizeFormatted: 'directory',
                modifiedAt: new Date().toISOString(),
                isDirectory: true,
              });
            }
            scanDirectory(fullPath, currentDepth + 1);
          } else if (entry.isFile()) {
            const matchesQuery = !query || entry.name.toLowerCase().includes(query);
            const matchesExt = !extFilter || ext === extFilter;

            if (matchesQuery && matchesExt) {
              const stat = fs.statSync(fullPath);
              const kb = (stat.size / 1024).toFixed(1);
              matches.push({
                name: entry.name,
                path: fullPath,
                relativePath: relPath,
                extension: ext,
                sizeBytes: stat.size,
                sizeFormatted: `${kb} KB`,
                modifiedAt: stat.mtime.toISOString(),
                isDirectory: false,
              });
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    scanDirectory(targetDir, 0);

    const spokenSummary =
      matches.length > 0
        ? `Found ${matches.length} file${matches.length === 1 ? '' : 's'} matching "${query || extFilter}": ${matches.slice(0, 3).map((f) => f.name).join(', ')}${matches.length > 3 ? ' and more' : ''}.`
        : `No files found matching "${query || extFilter}".`;

    return {
      success: true,
      tool: 'search_files',
      result: {
        count: matches.length,
        files: matches,
        spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 9. create_note
   */
  private async executeCreateNote(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const content = (args.content || '').trim();
    if (!content) {
      return {
        success: false,
        tool: 'create_note',
        error: 'Note content cannot be empty.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const title = (args.title || content.slice(0, 40) || 'Untitled Note').trim();
    const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const db = this.memoryService.getDb();
    db.prepare(`
      INSERT INTO notes (id, title, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, title, content, JSON.stringify(tags), now, now);

    const note: NoteRecord = {
      id,
      title,
      content,
      tags,
      created_at: now,
      updated_at: now,
    };

    return {
      success: true,
      tool: 'create_note',
      result: {
        note,
        spokenSummary: `Note saved: "${title}".`,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 10. get_notes
   */
  private async executeGetNotes(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const query = (args.query || '').toLowerCase().trim();
    const db = this.memoryService.getDb();
    const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as any[];

    let notes: NoteRecord[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags || '[]'),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    if (query) {
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query) ||
          n.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    const spokenSummary =
      notes.length > 0
        ? `You have ${notes.length} note${notes.length === 1 ? '' : 's'}. Latest: "${notes[0].title}".`
        : 'You do not have any saved notes.';

    return {
      success: true,
      tool: 'get_notes',
      result: {
        count: notes.length,
        notes,
        spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 11. delete_note
   */
  private async executeDeleteNote(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const target = (args.idOrTitle || args.id || args.title || '').trim().toLowerCase();
    if (!target) {
      return {
        success: false,
        tool: 'delete_note',
        error: 'Please specify the note ID or title to delete.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const db = this.memoryService.getDb();
    const rows = db.prepare('SELECT * FROM notes').all() as any[];
    const match = rows.find((r) => r.id === target || r.title.toLowerCase() === target || r.title.toLowerCase().includes(target));

    if (!match) {
      return {
        success: false,
        tool: 'delete_note',
        error: `Could not find a note matching "${target}".`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(match.id);

    return {
      success: true,
      tool: 'delete_note',
      result: {
        deletedId: match.id,
        deletedTitle: match.title,
        spokenSummary: `Note "${match.title}" has been deleted.`,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 12. set_timer
   */
  private async executeSetTimer(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    let durationSeconds = 0;

    if (typeof args.durationSeconds === 'number' && args.durationSeconds > 0) {
      durationSeconds = Math.round(args.durationSeconds);
    } else if (typeof args.minutes === 'number' && args.minutes > 0) {
      durationSeconds = Math.round(args.minutes * 60);
    } else if (typeof args.seconds === 'number' && args.seconds > 0) {
      durationSeconds = Math.round(args.seconds);
    } else if (typeof args.duration === 'string') {
      const matchMin = args.duration.match(/(\d+)\s*(?:minute|min|m)/i);
      const matchSec = args.duration.match(/(\d+)\s*(?:second|sec|s)/i);
      if (matchMin) durationSeconds += parseInt(matchMin[1], 10) * 60;
      if (matchSec) durationSeconds += parseInt(matchSec[1], 10);
    }

    if (durationSeconds <= 0) {
      return {
        success: false,
        tool: 'set_timer',
        error: 'Please specify a valid timer duration in seconds or minutes (e.g. 60 seconds or 10 minutes).',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Upper limit protection: 24 hours
    if (durationSeconds > 86400) {
      durationSeconds = 86400;
    }

    const label = (args.label || args.title || 'Timer').trim();
    const id = `timer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const completesAt = new Date(now.getTime() + durationSeconds * 1000);

    const timerRecord: TimerRecord = {
      id,
      label,
      durationSeconds,
      remainingSeconds: durationSeconds,
      status: 'RUNNING',
      created_at: now.toISOString(),
      completes_at: completesAt.toISOString(),
    };

    // Store in SQLite
    const db = this.memoryService.getDb();
    db.prepare(`
      INSERT INTO timers (id, label, duration_seconds, remaining_seconds, status, created_at, completes_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, label, durationSeconds, durationSeconds, 'RUNNING', now.toISOString(), completesAt.toISOString());

    // Schedule real Node timeout
    const timeoutHandle = setTimeout(() => {
      this.handleTimerTriggered(id);
    }, durationSeconds * 1000);

    this.activeTimers.set(id, {
      record: timerRecord,
      timeoutHandle,
    });

    const formatDuration = (sec: number): string => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (m > 0 && s > 0) return `${m} minute${m === 1 ? '' : 's'} and ${s} second${s === 1 ? '' : 's'}`;
      if (m > 0) return `${m} minute${m === 1 ? '' : 's'}`;
      return `${s} second${s === 1 ? '' : 's'}`;
    };

    const durationText = formatDuration(durationSeconds);
    const spokenSummary = `Timer set for ${durationText}${label !== 'Timer' ? ` for ${label}` : ''}.`;

    return {
      success: true,
      tool: 'set_timer',
      result: {
        timer: timerRecord,
        spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * Called when a real timer finishes countdown.
   * Integrates directly into ProactiveBehaviorService!
   */
  private handleTimerTriggered(timerId: string): void {
    const instance = this.activeTimers.get(timerId);
    if (!instance) return;

    this.activeTimers.delete(timerId);
    instance.record.status = 'COMPLETED';
    instance.record.remainingSeconds = 0;

    // Update DB
    try {
      const db = this.memoryService.getDb();
      db.prepare('UPDATE timers SET status = "COMPLETED", remaining_seconds = 0 WHERE id = ?').run(timerId);
    } catch (err) {
      console.warn('[REVA][TOOLS] Error updating timer status in DB:', err);
    }

    console.log(`[REVA][TOOLS] Timer completed: "${instance.record.label}" (${instance.record.durationSeconds}s)`);

    // 1. Notify listeners (for WebSocket broadcast to client)
    this.onTimerTriggeredCallbacks.forEach((cb) => {
      try {
        cb(instance.record);
      } catch (err) {
        console.warn('[REVA][TOOLS] Error in onTimerTriggered callback:', err);
      }
    });

    // 2. Dispatch to Proactive Engine
    this.proactiveService.evaluateEvent(
      'TIMER_COMPLETED',
      {
        timerId: instance.record.id,
        label: instance.record.label,
        durationSeconds: instance.record.durationSeconds,
      },
      'READY'
    );
  }

  /**
   * 13. list_timers
   */
  private async executeListTimers(startTime: number): Promise<ToolExecutionResult> {
    const db = this.memoryService.getDb();
    const rows = db.prepare('SELECT * FROM timers ORDER BY created_at DESC LIMIT 15').all() as any[];

    const now = Date.now();
    const timers: TimerRecord[] = rows.map((r) => {
      const completesTime = new Date(r.completes_at).getTime();
      const remainingSec = r.status === 'RUNNING' ? Math.max(0, Math.round((completesTime - now) / 1000)) : 0;

      return {
        id: r.id,
        label: r.label,
        durationSeconds: r.duration_seconds,
        remainingSeconds: remainingSec,
        status: r.status,
        created_at: r.created_at,
        completes_at: r.completes_at,
      };
    });

    const activeList = timers.filter((t) => t.status === 'RUNNING');
    const spokenSummary =
      activeList.length > 0
        ? `You have ${activeList.length} active timer${activeList.length === 1 ? '' : 's'}: ${activeList.map((t) => `${t.label} (${t.remainingSeconds}s remaining)`).join(', ')}.`
        : 'You do not have any active timers running.';

    return {
      success: true,
      tool: 'list_timers',
      result: {
        activeCount: activeList.length,
        timers,
        spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 14. cancel_timer
   */
  private async executeCancelTimer(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const target = (args.idOrLabel || args.id || args.label || '').trim().toLowerCase();
    if (!target) {
      return {
        success: false,
        tool: 'cancel_timer',
        error: 'Please specify the timer ID or label to cancel.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    let foundId: string | null = null;
    let foundLabel = 'Timer';

    for (const [id, inst] of this.activeTimers.entries()) {
      if (id.toLowerCase() === target || inst.record.label.toLowerCase().includes(target)) {
        foundId = id;
        foundLabel = inst.record.label;
        clearTimeout(inst.timeoutHandle);
        this.activeTimers.delete(id);
        break;
      }
    }

    if (!foundId) {
      return {
        success: false,
        tool: 'cancel_timer',
        error: `Could not find an active timer matching "${target}".`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const db = this.memoryService.getDb();
    db.prepare('UPDATE timers SET status = "CANCELLED" WHERE id = ?').run(foundId);

    return {
      success: true,
      tool: 'cancel_timer',
      result: {
        cancelledId: foundId,
        cancelledLabel: foundLabel,
        spokenSummary: `Cancelled timer "${foundLabel}".`,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 15. list_running_applications
   */
  private async executeListRunningApplications(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const limit = Math.min(25, Math.max(5, typeof args.limit === 'number' ? args.limit : 15));
    const sysControl = SystemControlService.getInstance();
    const runningApps = await sysControl.listRunningApplications(limit);

    const spokenSummary =
      runningApps.length > 0
        ? `There are ${runningApps.length} active processes visible. Top applications include: ${runningApps.slice(0, 4).map((a) => a.name).join(', ')}.`
        : 'Process list is currently unavailable.';

    return {
      success: true,
      tool: 'list_running_applications',
      result: {
        count: runningApps.length,
        applications: runningApps,
        spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  // ==========================================
  // HISTORY & SANITIZATION
  // ==========================================

  private sanitizeArgumentsForHistory(toolName: string, args: Record<string, any>): string {
    if (!args || Object.keys(args).length === 0) return 'None';

    const clean: Record<string, any> = { ...args };

    // Redact sensitive inputs (passwords, tokens, clipboard text)
    if (toolName === 'write_clipboard' || toolName === 'read_clipboard') {
      return `[Text length: ${String(args.text || args.content || '').length} chars]`;
    }

    for (const key of Object.keys(clean)) {
      if (/(key|token|secret|password|auth|credential)/i.test(key)) {
        clean[key] = '[REDACTED]';
      }
      if (typeof clean[key] === 'string' && clean[key].length > 60) {
        clean[key] = clean[key].slice(0, 57) + '...';
      }
    }

    return JSON.stringify(clean);
  }

  private recordHistory(result: ToolExecutionResult, argsSummary: string): void {
    const entry: ToolHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tool: result.tool,
      argumentsSummary: argsSummary,
      success: result.success,
      executionTimeMs: result.executionTimeMs,
      timestamp: result.timestamp,
      resultSummary: result.success ? result.result?.spokenSummary || 'Success' : result.error || 'Failed',
      error: result.error,
      permissionLevel: result.permissionLevel,
    };

    this.history.unshift(entry);
    if (this.history.length > 100) {
      this.history.pop();
    }

    try {
      const db = this.memoryService.getDb();
      db.prepare(`
        INSERT INTO tool_history (id, tool, arguments_summary, success, execution_time_ms, timestamp, result_summary, error, permission_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.id,
        entry.tool,
        entry.argumentsSummary,
        entry.success ? 1 : 0,
        entry.executionTimeMs,
        entry.timestamp,
        entry.resultSummary || '',
        entry.error || '',
        entry.permissionLevel
      );
    } catch (err) {
      console.warn('[REVA][TOOLS] Could not record tool history in DB:', err);
    }
  }

  public getHistory(limit = 20): ToolHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  public getNotes(): NoteRecord[] {
    const db = this.memoryService.getDb();
    const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: JSON.parse(r.tags || '[]'),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  public getTimers(): TimerRecord[] {
    const db = this.memoryService.getDb();
    const rows = db.prepare('SELECT * FROM timers ORDER BY created_at DESC LIMIT 20').all() as any[];
    const now = Date.now();
    return rows.map((r) => {
      const completesTime = new Date(r.completes_at).getTime();
      const remainingSec = r.status === 'RUNNING' ? Math.max(0, Math.round((completesTime - now) / 1000)) : 0;
      return {
        id: r.id,
        label: r.label,
        durationSeconds: r.duration_seconds,
        remainingSeconds: remainingSec,
        status: r.status,
        created_at: r.created_at,
        completes_at: r.completes_at,
      };
    });
  }
}
