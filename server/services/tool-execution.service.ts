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
import { FileControlService } from './file-control.service.js';
import { ConfirmationService } from './confirmation.service.js';
import { AllowedDirectoriesService } from './allowed-directories.service.js';
import { ProjectShortcutService } from './project-shortcut.service.js';
import { WebIntelligenceService } from './web-intelligence.service.js';
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
  MultiStepPlan,
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
        name: 'search_web',
        description:
          'Perform a live web search to answer questions with fresh, verified, up-to-date online information, latest news, official documentation, or facts. Never fabricate search results.',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The search query or topic to search on the live web',
            },
            purpose: {
              type: 'STRING',
              description: 'Optional search purpose: "latest_news", "fact_check", "documentation", "official_site", "general"',
            },
            limit: {
              type: 'NUMBER',
              description: 'Optional maximum number of search results to return (default 5)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_and_open_website',
        description:
          'Search the web for an official website, portal, or documentation, identify the verified official URL, and open it directly in the browser (e.g. "search and open React documentation", "find and open official Python site").',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Search query or name of the website/service to find and open',
            },
            preferredDomain: {
              type: 'STRING',
              description: 'Optional domain to prioritize (e.g. "react.dev", "github.com", "python.org")',
            },
          },
          required: ['query'],
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
        description: 'Search for real files by name, keyword, or extension across approved user directories (Documents, Projects, Downloads, Desktop, Pictures, Workspace).',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'File name keyword or search phrase (e.g. "presentation", "reva", "notes")',
            },
            directory: {
              type: 'STRING',
              description: 'Optional approved directory or project alias (e.g. "Documents", "Projects", "Downloads", "Desktop", "reva")',
            },
            extension: {
              type: 'STRING',
              description: 'Optional file extension filter (e.g. "txt", "pdf", "ts", "json", "md")',
            },
          },
        },
      },
      {
        name: 'open_file',
        description: 'Open a verified file inside approved user directories or via project shortcuts (e.g. "open my REVA project file", "open presentation.pptx").',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePathOrName: {
              type: 'STRING',
              description: 'File name, relative path, or project shortcut to open',
            },
            directory: {
              type: 'STRING',
              description: 'Optional approved directory to search within (e.g. "Documents", "Projects")',
            },
          },
          required: ['filePathOrName'],
        },
      },
      {
        name: 'create_file',
        description: 'Create a real file with content inside approved directories (e.g. "create ideas.txt in Documents"). Requires confirmation if file exists.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            fileName: {
              type: 'STRING',
              description: 'Name or path of the file to create (e.g. "ideas.txt", "notes/todo.txt")',
            },
            content: {
              type: 'STRING',
              description: 'Text content to write into the file',
            },
            directory: {
              type: 'STRING',
              description: 'Optional approved directory (e.g. "Documents", "Projects", "Desktop")',
            },
            overwrite: {
              type: 'BOOLEAN',
              description: 'Whether to overwrite an existing file (requires confirmation first)',
            },
          },
          required: ['fileName'],
        },
      },
      {
        name: 'create_folder',
        description: 'Create a real folder inside approved directories (e.g. "create a folder called REVA Assets in Documents").',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            folderName: {
              type: 'STRING',
              description: 'Name of folder to create (e.g. "REVA Assets", "Test")',
            },
            directory: {
              type: 'STRING',
              description: 'Optional approved directory (e.g. "Documents", "Projects", "Desktop")',
            },
          },
          required: ['folderName'],
        },
      },
      {
        name: 'rename_file',
        description: 'Rename a file or folder inside approved directories (e.g. "rename project.txt to final-project.txt"). Confirms before overwriting.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            sourcePathOrName: {
              type: 'STRING',
              description: 'Current file or folder name/path',
            },
            newName: {
              type: 'STRING',
              description: 'New file or folder name',
            },
            directory: {
              type: 'STRING',
              description: 'Optional approved directory to look in',
            },
            confirmed: {
              type: 'BOOLEAN',
              description: 'Whether rename action is confirmed',
            },
          },
          required: ['sourcePathOrName', 'newName'],
        },
      },
      {
        name: 'copy_file',
        description: 'Copy a file or folder inside approved directories (e.g. "copy notes.txt to Documents"). Confirms before overwriting.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            sourcePathOrName: {
              type: 'STRING',
              description: 'Source file or folder path/name',
            },
            destinationPathOrDir: {
              type: 'STRING',
              description: 'Destination directory or path (must be inside approved directories)',
            },
            overwrite: {
              type: 'BOOLEAN',
              description: 'Whether to overwrite if destination already exists',
            },
          },
          required: ['sourcePathOrName', 'destinationPathOrDir'],
        },
      },
      {
        name: 'move_file',
        description: 'Move a file or folder inside approved directories (e.g. "move project folder to Documents"). Confirms before overwriting.',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            sourcePathOrName: {
              type: 'STRING',
              description: 'Source file or folder path/name to move',
            },
            destinationPathOrDir: {
              type: 'STRING',
              description: 'Destination directory or path (must be inside approved directories)',
            },
            overwrite: {
              type: 'BOOLEAN',
              description: 'Whether to overwrite if destination exists',
            },
            confirmed: {
              type: 'BOOLEAN',
              description: 'Whether the move is explicitly confirmed',
            },
          },
          required: ['sourcePathOrName', 'destinationPathOrDir'],
        },
      },
      {
        name: 'execute_multi_step',
        description: 'Execute a sequential multi-step computer control plan safely with rollback on intermediate failure (e.g. "create folder Test and create hello.txt inside it").',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            description: {
              type: 'STRING',
              description: 'High-level description of the multi-step plan',
            },
            steps: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  tool: { type: 'STRING', description: 'Tool name to execute' },
                  args: { type: 'OBJECT', description: 'Arguments object for the tool' },
                  description: { type: 'STRING', description: 'Step description' },
                },
                required: ['tool', 'args'],
              },
              description: 'List of ordered steps to execute sequentially',
            },
          },
          required: ['steps'],
        },
      },
      {
        name: 'confirm_action',
        description: 'Confirm or cancel a pending sensitive or overwrite action (e.g. user answers "yes", "replace it", "sure", or "no", "cancel").',
        permission: 'REVERSIBLE',
        parameters: {
          type: 'OBJECT',
          properties: {
            responsePhrase: {
              type: 'STRING',
              description: 'The user response phrase (e.g. "yes", "replace it", "sure", "cancel", "no")',
            },
            confirmationId: {
              type: 'STRING',
              description: 'Optional specific confirmation ID',
            },
          },
          required: ['responsePhrase'],
        },
      },
      {
        name: 'list_allowed_directories',
        description: 'List all user-approved safe directory locations for file operations (Documents, Downloads, Desktop, Pictures, Projects, Workspace).',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'list_project_shortcuts',
        description: 'List all configured project shortcuts (e.g. REVA Project path).',
        permission: 'READ_ONLY',
        parameters: {
          type: 'OBJECT',
          properties: {},
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

    // 1. Strict Security Check: Ban arbitrary shell execution, browser script injections, credential extraction, and blocked destructive actions
    if (
      toolName === 'run_shell_command' ||
      toolName === 'exec_shell' ||
      toolName === 'terminal_command' ||
      toolName === 'eval_code' ||
      toolName === 'run_shell' ||
      toolName === 'eval_in_browser' ||
      toolName === 'inject_js' ||
      toolName === 'run_browser_script' ||
      toolName === 'execute_browser_javascript'
    ) {
      const execTime = Date.now() - startTime;
      const res: ToolExecutionResult = {
        success: false,
        tool: toolName,
        error: 'Arbitrary shell and browser script execution are strictly disallowed for system security. All actions must use predefined typed tools.',
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'DESTRUCTIVE',
      };
      this.recordHistory(res, '[REJECTED ARBITRARY CODE/SCRIPT EXECUTION]');
      return res;
    }

    if (
      toolName === 'extract_passwords' ||
      toolName === 'read_cookies' ||
      toolName === 'get_browser_passwords' ||
      toolName === 'bypass_auth' ||
      toolName === 'bypass_captcha' ||
      toolName === 'buy_product' ||
      toolName === 'make_payment' ||
      toolName === 'transfer_money' ||
      toolName === 'submit_order'
    ) {
      const execTime = Date.now() - startTime;
      const res: ToolExecutionResult = {
        success: false,
        tool: toolName,
        error: 'Access to credentials, cookies, authentication bypass, and automated financial purchases are strictly blocked for user privacy and security.',
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'DESTRUCTIVE',
      };
      this.recordHistory(res, '[BLOCKED PRIVACY/FINANCIAL OPERATION]');
      return res;
    }

    if (
      toolName === 'delete_file' ||
      toolName === 'delete_folder' ||
      toolName === 'format_drive' ||
      toolName === 'system_reset' ||
      toolName === 'registry_edit'
    ) {
      const execTime = Date.now() - startTime;
      const res: ToolExecutionResult = {
        success: false,
        tool: toolName,
        error: 'Permanent file or folder deletion is disabled for safety in REVA Step 7B.',
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'DESTRUCTIVE',
      };
      this.recordHistory(res, '[BLOCKED DESTRUCTIVE OPERATION]');
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

        case 'search_web':
          executionResult = await this.executeSearchWeb(cleanArgs, startTime);
          break;

        case 'search_and_open_website':
          executionResult = await this.executeSearchAndOpenWebsite(cleanArgs, startTime);
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

        case 'open_file':
          executionResult = await this.executeOpenFile(cleanArgs, startTime);
          break;

        case 'create_file':
          executionResult = await this.executeCreateFile(cleanArgs, startTime);
          break;

        case 'create_folder':
          executionResult = await this.executeCreateFolder(cleanArgs, startTime);
          break;

        case 'rename_file':
          executionResult = await this.executeRenameFile(cleanArgs, startTime);
          break;

        case 'copy_file':
          executionResult = await this.executeCopyFile(cleanArgs, startTime);
          break;

        case 'move_file':
          executionResult = await this.executeMoveFile(cleanArgs, startTime);
          break;

        case 'execute_multi_step':
          executionResult = await this.executeMultiStep(cleanArgs, startTime);
          break;

        case 'confirm_action':
          executionResult = await this.executeConfirmAction(cleanArgs, startTime);
          break;

        case 'list_allowed_directories':
          executionResult = await this.executeListAllowedDirectories(startTime);
          break;

        case 'list_project_shortcuts':
          executionResult = await this.executeListProjectShortcuts(startTime);
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
   * 3a. search_web (Step 8 Web Intelligence)
   */
  private async executeSearchWeb(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const query = (args.query || args.q || args.searchQuery || '').trim();
    const purpose = args.purpose;
    const limit = typeof args.limit === 'number' ? args.limit : 5;

    if (!query) {
      return {
        success: false,
        tool: 'search_web',
        error: 'Please specify a query to search on the web.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'READ_ONLY',
      };
    }

    const webService = WebIntelligenceService.getInstance();
    const searchRes = await webService.searchWeb({
      query,
      purpose,
      limit,
    });

    if (!searchRes.success || !searchRes.data) {
      return {
        success: false,
        tool: 'search_web',
        error: searchRes.error || "I couldn't access the web right now.",
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'READ_ONLY',
      };
    }

    return {
      success: true,
      tool: 'search_web',
      result: searchRes.data,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 3b. search_and_open_website (Step 8 Official Site Navigation)
   */
  private async executeSearchAndOpenWebsite(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const query = (args.query || args.name || args.website || '').trim();
    const preferredDomain = (args.preferredDomain || args.domain || '').trim();

    if (!query) {
      return {
        success: false,
        tool: 'search_and_open_website',
        error: 'Please specify the name of the website or documentation to find and open.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const webService = WebIntelligenceService.getInstance();
    const result = await webService.searchAndOpenWebsite(query, preferredDomain || undefined);

    // Broadcast opened URL to frontend listeners
    if (result.success && result.result?.targetUrl) {
      this.onUrlOpenCallbacks.forEach((cb) => {
        try {
          cb(result.result.targetUrl);
        } catch (err) {
          console.warn('[REVA][TOOLS] Error in onUrlOpen callback:', err);
        }
      });
    }

    return result;
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
   * 8. search_files (Step 7B File Search with safe directory support)
   */
  private async executeSearchFiles(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    const searchResult = await fileControl.searchFiles({
      query: args.query,
      directory: args.directory,
      extension: args.extension,
      limit: typeof args.limit === 'number' ? args.limit : 20,
    });

    return {
      success: true,
      tool: 'search_files',
      result: searchResult,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 8b. open_file (Step 7B Open File)
   */
  private async executeOpenFile(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    return await fileControl.openFile({
      filePathOrName: args.filePathOrName || args.path || args.fileName || args.name,
      directory: args.directory,
    });
  }

  /**
   * 8c. create_file (Step 7B Create File with Overwrite Protection)
   */
  private async executeCreateFile(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    return await fileControl.createFile({
      fileName: args.fileName || args.name || args.path,
      content: args.content,
      directory: args.directory,
      overwrite: Boolean(args.overwrite),
    });
  }

  /**
   * 8d. create_folder (Step 7B Create Folder)
   */
  private async executeCreateFolder(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    return await fileControl.createFolder({
      folderName: args.folderName || args.name || args.path,
      directory: args.directory,
    });
  }

  /**
   * 8e. rename_file (Step 7B Rename File/Folder with Confirmation)
   */
  private async executeRenameFile(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    return await fileControl.renameFile({
      sourcePathOrName: args.sourcePathOrName || args.source || args.oldName || args.name,
      newName: args.newName || args.targetName || args.newPath,
      directory: args.directory,
      confirmed: Boolean(args.confirmed),
    });
  }

  /**
   * 8f. copy_file (Step 7B Copy File/Folder with Overwrite Protection)
   */
  private async executeCopyFile(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    return await fileControl.copyFile({
      sourcePathOrName: args.sourcePathOrName || args.source || args.from,
      destinationPathOrDir: args.destinationPathOrDir || args.destination || args.dest || args.to,
      overwrite: Boolean(args.overwrite),
    });
  }

  /**
   * 8g. move_file (Step 7B Move File/Folder with Overwrite Protection)
   */
  private async executeMoveFile(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    return await fileControl.moveFile({
      sourcePathOrName: args.sourcePathOrName || args.source || args.from,
      destinationPathOrDir: args.destinationPathOrDir || args.destination || args.dest || args.to,
      overwrite: Boolean(args.overwrite),
      confirmed: Boolean(args.confirmed),
    });
  }

  /**
   * 8h. execute_multi_step (Step 7B Multi-Step Safe Sequence with Rollback)
   */
  private async executeMultiStep(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const fileControl = FileControlService.getInstance();
    const rawSteps = Array.isArray(args.steps) ? args.steps : [];

    if (rawSteps.length === 0) {
      return {
        success: false,
        tool: 'execute_multi_step',
        error: 'Multi-step plan must contain at least one step.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const multiStepResult = await fileControl.executeMultiStep(
      {
        description: args.description || 'Multi-step sequence',
        steps: rawSteps,
      },
      this.executeTool.bind(this)
    );

    return {
      success: multiStepResult.allSucceeded,
      tool: 'execute_multi_step',
      result: multiStepResult,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 8i. confirm_action (Step 7B Confirmation Service Handler)
   */
  private async executeConfirmAction(args: Record<string, any>, startTime: number): Promise<ToolExecutionResult> {
    const confirmationService = ConfirmationService.getInstance();
    const phrase = String(args.responsePhrase || args.response || args.answer || 'yes');
    const confirmationId = args.confirmationId ? String(args.confirmationId) : undefined;

    const outcome = await confirmationService.handleConfirmationResponse(phrase, confirmationId);

    return {
      success: outcome.handled,
      tool: 'confirm_action',
      result: {
        handled: outcome.handled,
        confirmed: outcome.confirmed,
        spokenSummary: outcome.message,
        executionResult: outcome.result,
      },
      error: !outcome.handled ? outcome.message : undefined,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  /**
   * 8j. list_allowed_directories (Step 7B Allowed Directories)
   */
  private async executeListAllowedDirectories(startTime: number): Promise<ToolExecutionResult> {
    const allowedDirs = AllowedDirectoriesService.getInstance();
    const directories = allowedDirs.getAllowedDirectories();

    const spokenSummary = `Approved directories are: ${directories.map((d) => d.name).join(', ')}.`;

    return {
      success: true,
      tool: 'list_allowed_directories',
      result: {
        count: directories.length,
        directories,
        spokenSummary,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  /**
   * 8k. list_project_shortcuts (Step 7B Project Shortcuts)
   */
  private async executeListProjectShortcuts(startTime: number): Promise<ToolExecutionResult> {
    const shortcutService = ProjectShortcutService.getInstance();
    const shortcuts = shortcutService.getAllShortcuts();

    const spokenSummary =
      shortcuts.length > 0
        ? `Configured shortcuts include: ${shortcuts.map((s) => `${s.name} (${s.alias})`).join(', ')}.`
        : 'No custom project shortcuts configured.';

    return {
      success: true,
      tool: 'list_project_shortcuts',
      result: {
        count: shortcuts.length,
        shortcuts,
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
    const sysControl = SystemControlService.getInstance();
    const listResult = await sysControl.listRunningApplications();

    return {
      success: true,
      tool: 'list_running_applications',
      result: listResult,
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
