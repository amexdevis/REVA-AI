/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { AllowedDirectoryInfo } from '../types/tools.types.js';

export class AllowedDirectoriesService {
  private static instance: AllowedDirectoriesService | null = null;

  // Registered allowed directories
  private allowedDirectories: Map<string, AllowedDirectoryInfo> = new Map();

  // Explicit blacklist of dangerous system root prefixes
  private readonly SYSTEM_BLACKLIST: string[] = [
    '/etc',
    '/root',
    '/sys',
    '/proc',
    '/dev',
    '/boot',
    '/usr/bin',
    '/usr/sbin',
    '/bin',
    '/sbin',
    '/var/run',
    '/var/log',
    'c:\\windows',
    'c:\\program files',
    'c:\\program files (x86)',
    'c:\\system volume information',
  ];

  private constructor() {
    this.initializeDefaultDirectories();
  }

  public static getInstance(): AllowedDirectoriesService {
    if (!AllowedDirectoriesService.instance) {
      AllowedDirectoriesService.instance = new AllowedDirectoriesService();
    }
    return AllowedDirectoriesService.instance;
  }

  /**
   * Initializes the default safe directories for the user profile & workspace.
   */
  private initializeDefaultDirectories(): void {
    const homeDir = os.homedir() || process.env.HOME || '/home/user';
    const workspaceRoot = process.cwd();

    // Standard user folders
    const standardFolders: Array<{ id: string; name: string; folderName: string; desc: string }> = [
      { id: 'documents', name: 'Documents', folderName: 'Documents', desc: 'Personal documents, notes, and records' },
      { id: 'downloads', name: 'Downloads', folderName: 'Downloads', desc: 'Downloaded files and web assets' },
      { id: 'desktop', name: 'Desktop', folderName: 'Desktop', desc: 'User desktop files and active shortcuts' },
      { id: 'pictures', name: 'Pictures', folderName: 'Pictures', desc: 'Images, photos, and graphical assets' },
      { id: 'projects', name: 'Projects', folderName: 'Projects', desc: 'Development projects and source repositories' },
    ];

    for (const folder of standardFolders) {
      let targetPath = path.join(homeDir, folder.folderName);

      // In sandboxed/cloud environments where $HOME might not have standard folders, create or fallback to user_data
      try {
        if (!fs.existsSync(targetPath)) {
          // Attempt to create user home directory
          fs.mkdirSync(targetPath, { recursive: true });
        }
      } catch {
        // Fallback to local workspace sandbox for safe isolation
        targetPath = path.join(workspaceRoot, 'user_data', folder.folderName);
        if (!fs.existsSync(targetPath)) {
          try {
            fs.mkdirSync(targetPath, { recursive: true });
          } catch {
            // Ignored
          }
        }
      }

      this.allowedDirectories.set(folder.id, {
        id: folder.id,
        name: folder.name,
        path: path.resolve(targetPath),
        description: folder.desc,
        isDefault: true,
        exists: fs.existsSync(targetPath),
      });
    }

    // Always include the project workspace directory
    this.allowedDirectories.set('workspace', {
      id: 'workspace',
      name: 'Workspace',
      path: path.resolve(workspaceRoot),
      description: 'Active project workspace directory',
      isDefault: true,
      exists: true,
    });
  }

  /**
   * Get all registered allowed directories.
   */
  public getAllowedDirectories(): AllowedDirectoryInfo[] {
    const list: AllowedDirectoryInfo[] = [];
    for (const dir of this.allowedDirectories.values()) {
      list.push({
        ...dir,
        exists: fs.existsSync(dir.path),
      });
    }
    return list;
  }

  /**
   * Register a new user-approved directory.
   */
  public addAllowedDirectory(name: string, dirPath: string, description?: string): { success: boolean; info?: AllowedDirectoryInfo; error?: string } {
    const trimmedName = (name || '').trim();
    const rawPath = (dirPath || '').trim();

    if (!trimmedName || !rawPath) {
      return { success: false, error: 'Name and directory path are required.' };
    }

    const resolved = path.resolve(rawPath);

    // Blacklist check
    const lower = resolved.toLowerCase();
    for (const blacklisted of this.SYSTEM_BLACKLIST) {
      if (lower === blacklisted || lower.startsWith(blacklisted + path.sep)) {
        return { success: false, error: `Cannot allow system-critical directory "${resolved}".` };
      }
    }

    // Must not be root directory /
    if (resolved === '/' || resolved === path.parse(resolved).root) {
      return { success: false, error: 'Cannot allow entire root filesystem as an approved directory.' };
    }

    // Ensure it exists or can be created
    if (!fs.existsSync(resolved)) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
      } catch (err: any) {
        return { success: false, error: `Directory does not exist and could not be created: ${err.message}` };
      }
    }

    const id = trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const info: AllowedDirectoryInfo = {
      id,
      name: trimmedName,
      path: resolved,
      description: description || `User-approved folder: ${trimmedName}`,
      isDefault: false,
      exists: true,
    };

    this.allowedDirectories.set(id, info);
    return { success: true, info };
  }

  /**
   * Remove an allowed directory by ID or name (cannot remove default workspace).
   */
  public removeAllowedDirectory(idOrName: string): boolean {
    const key = idOrName.toLowerCase().trim();
    for (const [id, dir] of this.allowedDirectories.entries()) {
      if (id === key || dir.name.toLowerCase() === key) {
        if (dir.id === 'workspace') return false; // Prevent removing workspace
        this.allowedDirectories.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Find an allowed directory path by alias (e.g. "documents", "downloads", "desktop", "projects", "workspace").
   */
  public getDirectoryByAlias(alias: string): string | null {
    const clean = alias.toLowerCase().trim();
    for (const [id, dir] of this.allowedDirectories.entries()) {
      if (id === clean || dir.name.toLowerCase() === clean) {
        return dir.path;
      }
    }
    return null;
  }

  /**
   * Resolve and strictly validate a user or model-provided path against approved directories.
   * Rejects path traversal (..), null bytes, unapproved locations, and system folders.
   */
  public resolveSecurePath(
    inputPath: string,
    baseDirPreference?: string
  ): {
    isValid: boolean;
    resolvedPath: string;
    relativePath: string;
    allowedDirName: string | null;
    error?: string;
  } {
    if (!inputPath || typeof inputPath !== 'string') {
      return {
        isValid: false,
        resolvedPath: '',
        relativePath: '',
        allowedDirName: null,
        error: 'Path cannot be empty.',
      };
    }

    // 1. Strict Null Byte Check
    if (inputPath.includes('\0')) {
      return {
        isValid: false,
        resolvedPath: '',
        relativePath: '',
        allowedDirName: null,
        error: 'Path contains prohibited null byte characters.',
      };
    }

    let cleanInput = inputPath.trim();

    // 2. Expand home tilde prefix (~/)
    const homeDir = os.homedir() || process.env.HOME || '/home/user';
    if (cleanInput.startsWith('~/') || cleanInput === '~') {
      cleanInput = path.join(homeDir, cleanInput.slice(1));
    }

    // 3. Determine base directory if path is relative
    let candidatePath = cleanInput;
    if (!path.isAbsolute(cleanInput)) {
      let baseDir = process.cwd(); // Default to workspace

      if (baseDirPreference) {
        const preferred = this.getDirectoryByAlias(baseDirPreference) || baseDirPreference;
        if (this.isPathAllowed(preferred)) {
          baseDir = preferred;
        }
      }

      candidatePath = path.resolve(baseDir, cleanInput);
    } else {
      candidatePath = path.resolve(cleanInput);
    }

    // 4. Normalize path
    const normalized = path.normalize(candidatePath);

    // 5. Check blacklist
    const lowerNormalized = normalized.toLowerCase();
    for (const blacklisted of this.SYSTEM_BLACKLIST) {
      if (lowerNormalized === blacklisted || lowerNormalized.startsWith(blacklisted + path.sep)) {
        return {
          isValid: false,
          resolvedPath: normalized,
          relativePath: '',
          allowedDirName: null,
          error: `Access to system-critical directory "${blacklisted}" is strictly prohibited.`,
        };
      }
    }

    // 6. Check if normalized path is within ANY registered allowed directory
    let matchedAllowed: AllowedDirectoryInfo | null = null;

    for (const allowed of this.allowedDirectories.values()) {
      const allowedRoot = path.resolve(allowed.path);
      const relative = path.relative(allowedRoot, normalized);

      // If relative does not start with ".." and is not absolute, it's inside allowedRoot
      const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);
      if (isInside) {
        matchedAllowed = allowed;
        break;
      }
    }

    if (!matchedAllowed) {
      const allowedNames = Array.from(this.allowedDirectories.values())
        .map((d) => d.name)
        .join(', ');

      return {
        isValid: false,
        resolvedPath: normalized,
        relativePath: '',
        allowedDirName: null,
        error: `Location is outside approved safe directories. Approved locations are: ${allowedNames}.`,
      };
    }

    const relToAllowed = path.relative(matchedAllowed.path, normalized);

    return {
      isValid: true,
      resolvedPath: normalized,
      relativePath: relToAllowed || '.',
      allowedDirName: matchedAllowed.name,
    };
  }

  /**
   * Fast check if a path falls inside any allowed directory.
   */
  public isPathAllowed(targetPath: string): boolean {
    const res = this.resolveSecurePath(targetPath);
    return res.isValid;
  }
}
