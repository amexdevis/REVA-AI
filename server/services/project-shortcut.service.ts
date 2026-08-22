/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import fs from 'fs';
import { AllowedDirectoriesService } from './allowed-directories.service.js';

export interface ProjectShortcut {
  name: string;
  alias: string;
  path: string;
  description: string;
  createdAt: string;
}

export class ProjectShortcutService {
  private static instance: ProjectShortcutService | null = null;
  private shortcuts: Map<string, ProjectShortcut> = new Map();
  private allowedDirs: AllowedDirectoriesService;

  private constructor() {
    this.allowedDirs = AllowedDirectoriesService.getInstance();
    this.initializeDefaultShortcuts();
  }

  public static getInstance(): ProjectShortcutService {
    if (!ProjectShortcutService.instance) {
      ProjectShortcutService.instance = new ProjectShortcutService();
    }
    return ProjectShortcutService.instance;
  }

  /**
   * Initializes default project shortcuts (e.g. REVA workspace).
   */
  private initializeDefaultShortcuts(): void {
    const workspaceRoot = process.cwd();

    this.registerShortcut({
      name: 'REVA',
      alias: 'reva',
      path: workspaceRoot,
      description: 'Main REVA Voice Companion Project Workspace',
      createdAt: new Date().toISOString(),
    });

    this.registerShortcut({
      name: 'REVA Project',
      alias: 'reva project',
      path: workspaceRoot,
      description: 'Main REVA Voice Companion Project Workspace',
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Register a new project shortcut with path validation.
   */
  public registerShortcut(shortcut: ProjectShortcut): { success: boolean; error?: string } {
    const cleanAlias = shortcut.alias.toLowerCase().trim();
    if (!cleanAlias) {
      return { success: false, error: 'Shortcut alias cannot be empty.' };
    }

    const resolved = path.resolve(shortcut.path);

    // Validate against AllowedDirectoriesService
    const validation = this.allowedDirs.resolveSecurePath(resolved);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Cannot register shortcut outside allowed directories: ${validation.error}`,
      };
    }

    if (!fs.existsSync(resolved)) {
      return {
        success: false,
        error: `Target path "${resolved}" does not exist on disk.`,
      };
    }

    this.shortcuts.set(cleanAlias, {
      ...shortcut,
      alias: cleanAlias,
      path: resolved,
    });

    return { success: true };
  }

  /**
   * Resolve a project shortcut from natural speech / user query.
   * e.g. "reva", "my reva project", "reva project"
   */
  public resolveShortcut(phrase: string): ProjectShortcut | null {
    if (!phrase || typeof phrase !== 'string') return null;

    const clean = phrase.toLowerCase().trim();

    // 1. Direct match
    if (this.shortcuts.has(clean)) {
      return this.shortcuts.get(clean)!;
    }

    // 2. Stripped variations ("my reva project" -> "reva project" or "reva")
    const simplified = clean
      .replace(/^(my|the|this)\s+/, '')
      .replace(/\s+(project|repo|directory|folder)$/, '')
      .trim();

    if (this.shortcuts.has(simplified)) {
      return this.shortcuts.get(simplified)!;
    }

    // 3. Match against all registered aliases
    for (const [alias, shortcut] of this.shortcuts.entries()) {
      if (clean.includes(alias) || alias.includes(clean)) {
        return shortcut;
      }
    }

    return null;
  }

  /**
   * List all registered project shortcuts.
   */
  public getAllShortcuts(): ProjectShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Remove a shortcut by name or alias.
   */
  public removeShortcut(alias: string): boolean {
    const clean = alias.toLowerCase().trim();
    return this.shortcuts.delete(clean);
  }
}
