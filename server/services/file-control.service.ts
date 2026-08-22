/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import os from 'os';
import {
  FileSearchResult,
  FileOperationResult,
  MultiStepPlan,
  MultiStepExecutionResult,
  ToolExecutionResult,
} from '../types/tools.types.js';
import { AllowedDirectoriesService } from './allowed-directories.service.js';
import { ProjectShortcutService } from './project-shortcut.service.js';
import { ConfirmationService } from './confirmation.service.js';

export class FileControlService {
  private static instance: FileControlService | null = null;
  private allowedDirs: AllowedDirectoriesService;
  private projectShortcuts: ProjectShortcutService;
  private confirmationService: ConfirmationService;

  // Listeners for file open events to synchronize with connected browser UI
  private onFileOpenCallbacks: Array<(filePath: string, name: string) => void> = [];

  private constructor() {
    this.allowedDirs = AllowedDirectoriesService.getInstance();
    this.projectShortcuts = ProjectShortcutService.getInstance();
    this.confirmationService = ConfirmationService.getInstance();
  }

  public static getInstance(): FileControlService {
    if (!FileControlService.instance) {
      FileControlService.instance = new FileControlService();
    }
    return FileControlService.instance;
  }

  public onFileOpen(callback: (filePath: string, name: string) => void): () => void {
    this.onFileOpenCallbacks.push(callback);
    return () => {
      this.onFileOpenCallbacks = this.onFileOpenCallbacks.filter((cb) => cb !== callback);
    };
  }

  // ==========================================
  // 1. SEARCH FILES
  // ==========================================

  public async searchFiles(params: {
    query?: string;
    directory?: string;
    extension?: string;
    limit?: number;
  }): Promise<{
    count: number;
    files: FileSearchResult[];
    searchedLocations: string[];
    spokenSummary: string;
  }> {
    const rawQuery = (params.query || '').toLowerCase().trim();
    const extFilter = (params.extension || '').toLowerCase().replace(/^\./, '').trim();
    const targetDirAlias = (params.directory || '').trim();
    const maxResults = Math.min(50, Math.max(1, params.limit || 20));

    let scanRoots: string[] = [];

    // Check if target directory is specified
    if (targetDirAlias) {
      // Check shortcut or alias first
      const shortcut = this.projectShortcuts.resolveShortcut(targetDirAlias);
      if (shortcut) {
        scanRoots.push(shortcut.path);
      } else {
        const securePath = this.allowedDirs.resolveSecurePath(targetDirAlias);
        if (securePath.isValid && fs.existsSync(securePath.resolvedPath)) {
          scanRoots.push(securePath.resolvedPath);
        } else {
          // Check standard directory aliases
          const standardPath = this.allowedDirs.getDirectoryByAlias(targetDirAlias);
          if (standardPath && fs.existsSync(standardPath)) {
            scanRoots.push(standardPath);
          }
        }
      }
    }

    // Default to searching all allowed directories
    if (scanRoots.length === 0) {
      scanRoots = this.allowedDirs
        .getAllowedDirectories()
        .filter((d) => d.exists)
        .map((d) => d.path);
    }

    const matches: FileSearchResult[] = [];
    const maxDepth = 4;

    for (const rootPath of scanRoots) {
      if (matches.length >= maxResults) break;

      const scanDirectory = (currentDir: string, depth: number) => {
        if (depth > maxDepth || matches.length >= maxResults) return;

        try {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (matches.length >= maxResults) break;

            // Skip hidden, git, node_modules, build caches
            if (
              entry.name.startsWith('.') ||
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === '.git'
            ) {
              continue;
            }

            const fullPath = path.join(currentDir, entry.name);
            const ext = path.extname(entry.name).replace(/^\./, '').toLowerCase();

            if (entry.isDirectory()) {
              const nameMatches = rawQuery ? entry.name.toLowerCase().includes(rawQuery) : true;
              if (nameMatches && !extFilter) {
                matches.push({
                  name: entry.name,
                  path: fullPath,
                  relativePath: path.basename(fullPath),
                  extension: 'folder',
                  sizeBytes: 0,
                  sizeFormatted: 'folder',
                  modifiedAt: new Date().toISOString(),
                  isDirectory: true,
                  parentDir: path.basename(currentDir),
                });
              }
              scanDirectory(fullPath, depth + 1);
            } else if (entry.isFile()) {
              const nameMatches = rawQuery ? entry.name.toLowerCase().includes(rawQuery) : true;
              const extMatches = extFilter ? ext === extFilter : true;

              if (nameMatches && extMatches) {
                try {
                  const stat = fs.statSync(fullPath);
                  const kb = (stat.size / 1024).toFixed(1);
                  matches.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath: path.basename(fullPath),
                    extension: ext || 'file',
                    sizeBytes: stat.size,
                    sizeFormatted: `${kb} KB`,
                    modifiedAt: stat.mtime.toISOString(),
                    isDirectory: false,
                    parentDir: path.basename(currentDir),
                  });
                } catch {
                  // Skip unreadable files
                }
              }
            }
          }
        } catch {
          // Skip unreadable folders
        }
      };

      scanDirectory(rootPath, 1);
    }

    const spokenSummary =
      matches.length > 0
        ? `Found ${matches.length} matching item${matches.length === 1 ? '' : 's'}: ${matches
            .slice(0, 3)
            .map((m) => `${m.name}${m.parentDir ? ` in ${m.parentDir}` : ''}`)
            .join(', ')}${matches.length > 3 ? `, and ${matches.length - 3} more` : ''}.`
        : `No files matching "${rawQuery || extFilter}" were found in approved locations.`;

    return {
      count: matches.length,
      files: matches,
      searchedLocations: scanRoots.map((p) => path.basename(p)),
      spokenSummary,
    };
  }

  // ==========================================
  // 2. OPEN FILE
  // ==========================================

  public async openFile(params: {
    filePathOrName: string;
    directory?: string;
  }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const rawTarget = (params.filePathOrName || '').trim();

    if (!rawTarget) {
      return {
        success: false,
        tool: 'open_file',
        error: 'Please specify the file name or path to open.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'READ_ONLY',
      };
    }

    // 1. Check Project Shortcuts (e.g. "REVA", "REVA project")
    const shortcut = this.projectShortcuts.resolveShortcut(rawTarget);
    let resolvedPath = '';

    if (shortcut) {
      resolvedPath = shortcut.path;
    } else {
      // 2. Resolve secure path inside allowed directories
      const pathValidation = this.allowedDirs.resolveSecurePath(rawTarget, params.directory);
      if (pathValidation.isValid && fs.existsSync(pathValidation.resolvedPath)) {
        resolvedPath = pathValidation.resolvedPath;
      } else {
        // 3. Search for matching files across allowed directories if direct path not found
        const searchResult = await this.searchFiles({
          query: path.basename(rawTarget),
          directory: params.directory,
          limit: 5,
        });

        if (searchResult.files.length === 0) {
          return {
            success: false,
            tool: 'open_file',
            error: `I couldn't find a file matching "${rawTarget}" in your approved directories.`,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            permissionLevel: 'READ_ONLY',
          };
        }

        if (searchResult.files.length > 1) {
          // Multiple matching files: Ask the user which one, do not guess!
          const candidateList = searchResult.files
            .map((f, i) => `${i + 1}. ${f.name} in ${f.parentDir || 'folder'}`)
            .join('; ');

          return {
            success: false,
            tool: 'open_file',
            result: {
              multipleMatches: true,
              candidates: searchResult.files,
              spokenSummary: `I found ${searchResult.files.length} matching files: ${candidateList}. Which one would you like me to open?`,
            },
            error: `Multiple matching files found. Please specify which one: ${candidateList}`,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            permissionLevel: 'READ_ONLY',
          };
        }

        resolvedPath = searchResult.files[0].path;
      }
    }

    // Verify existence on disk
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        tool: 'open_file',
        error: `File "${path.basename(resolvedPath)}" does not exist on disk.`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'READ_ONLY',
      };
    }

    const fileName = path.basename(resolvedPath);

    // Notify connected frontend clients
    this.onFileOpenCallbacks.forEach((cb) => {
      try {
        cb(resolvedPath, fileName);
      } catch (err) {
        console.warn('[REVA][FILE] Error in onFileOpen callback:', err);
      }
    });

    // Attempt system launch (open / xdg-open)
    const platform = os.platform();
    if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
      const opener = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      try {
        execFile(opener, [resolvedPath], (err) => {
          if (err) {
            console.log(`[REVA][FILE] System opener note: ${err.message}`);
          }
        });
      } catch {
        // Safe fallback in container
      }
    }

    return {
      success: true,
      tool: 'open_file',
      result: {
        path: resolvedPath,
        name: fileName,
        opened: true,
        spokenSummary: `Opened ${fileName}.`,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'READ_ONLY',
    };
  }

  // ==========================================
  // 3. CREATE FILE
  // ==========================================

  public async createFile(params: {
    fileName: string;
    content?: string;
    directory?: string;
    overwrite?: boolean;
  }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const rawFileName = (params.fileName || '').trim();
    const fileContent = params.content || '';
    const targetDirPreference = params.directory || 'Documents';

    if (!rawFileName) {
      return {
        success: false,
        tool: 'create_file',
        error: 'Please provide a file name to create.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Validate path security inside allowed directory
    const validation = this.allowedDirs.resolveSecurePath(rawFileName, targetDirPreference);
    if (!validation.isValid) {
      return {
        success: false,
        tool: 'create_file',
        error: validation.error || 'Destination path is outside approved directories.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const targetPath = validation.resolvedPath;
    const parentDir = path.dirname(targetPath);

    // Ensure parent directory exists
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch (err: any) {
        return {
          success: false,
          tool: 'create_file',
          error: `Could not create parent directory: ${err.message}`,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          permissionLevel: 'REVERSIBLE',
        };
      }
    }

    // Overwrite Protection: If file already exists and overwrite not confirmed, prompt for confirmation
    if (fs.existsSync(targetPath) && !params.overwrite) {
      const fileName = path.basename(targetPath);
      const conf = this.confirmationService.createPendingConfirmation({
        type: 'COPY_OVERWRITE',
        summary: `Overwrite existing file "${fileName}"`,
        promptQuestion: `The file "${fileName}" already exists in ${validation.allowedDirName || 'your folder'}. Do you want me to replace it?`,
        details: { targetPath, content: fileContent },
        executor: () => this.createFile({ ...params, overwrite: true }),
      });

      return {
        success: true,
        tool: 'create_file',
        requiresConfirmation: true,
        result: {
          pendingConfirmation: true,
          confirmationId: conf.confirmationId,
          spokenSummary: conf.promptQuestion,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Write file and verify real filesystem creation
    try {
      await fs.promises.writeFile(targetPath, fileContent, 'utf-8');

      // Strict post-write verification
      const stat = await fs.promises.stat(targetPath);
      const fileName = path.basename(targetPath);

      return {
        success: true,
        tool: 'create_file',
        result: {
          action: 'created',
          path: targetPath,
          relativePath: validation.relativePath,
          name: fileName,
          sizeBytes: stat.size,
          allowedDirectory: validation.allowedDirName,
          spokenSummary: `Created ${fileName} in ${validation.allowedDirName || 'your folder'}.`,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'create_file',
        error: `Failed to create file: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }
  }

  // ==========================================
  // 4. CREATE FOLDER
  // ==========================================

  public async createFolder(params: {
    folderName: string;
    directory?: string;
  }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const rawFolderName = (params.folderName || '').trim();
    const targetDirPreference = params.directory || 'Documents';

    if (!rawFolderName) {
      return {
        success: false,
        tool: 'create_folder',
        error: 'Please provide a folder name to create.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const validation = this.allowedDirs.resolveSecurePath(rawFolderName, targetDirPreference);
    if (!validation.isValid) {
      return {
        success: false,
        tool: 'create_folder',
        error: validation.error || 'Destination path is outside approved directories.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const targetPath = validation.resolvedPath;

    try {
      if (!fs.existsSync(targetPath)) {
        await fs.promises.mkdir(targetPath, { recursive: true });
      }

      // Strict post-creation verification
      const stat = await fs.promises.stat(targetPath);
      if (!stat.isDirectory()) {
        throw new Error('Created path is not a directory.');
      }

      const folderName = path.basename(targetPath);

      return {
        success: true,
        tool: 'create_folder',
        result: {
          action: 'created',
          path: targetPath,
          relativePath: validation.relativePath,
          name: folderName,
          isDirectory: true,
          allowedDirectory: validation.allowedDirName,
          spokenSummary: `Created folder "${folderName}" in ${validation.allowedDirName || 'your folder'}.`,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'create_folder',
        error: `Failed to create folder: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }
  }

  // ==========================================
  // 5. RENAME FILE
  // ==========================================

  public async renameFile(params: {
    sourcePathOrName: string;
    newName: string;
    directory?: string;
    confirmed?: boolean;
  }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const sourceRaw = (params.sourcePathOrName || '').trim();
    const newNameRaw = (params.newName || '').trim();

    if (!sourceRaw || !newNameRaw) {
      return {
        success: false,
        tool: 'rename_file',
        error: 'Please specify both the original file and the new name.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // 1. Resolve source
    const sourceValidation = this.allowedDirs.resolveSecurePath(sourceRaw, params.directory);
    if (!sourceValidation.isValid) {
      return {
        success: false,
        tool: 'rename_file',
        error: `Source file: ${sourceValidation.error}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const sourcePath = sourceValidation.resolvedPath;
    if (!fs.existsSync(sourcePath)) {
      return {
        success: false,
        tool: 'rename_file',
        error: `File "${path.basename(sourcePath)}" does not exist.`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // 2. Resolve destination (in the same directory if only filename provided)
    const sourceDir = path.dirname(sourcePath);
    const destCandidate = path.isAbsolute(newNameRaw) ? newNameRaw : path.join(sourceDir, newNameRaw);

    const destValidation = this.allowedDirs.resolveSecurePath(destCandidate);
    if (!destValidation.isValid) {
      return {
        success: false,
        tool: 'rename_file',
        error: `Target location: ${destValidation.error}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const destPath = destValidation.resolvedPath;
    const oldName = path.basename(sourcePath);
    const newName = path.basename(destPath);

    // Overwrite check if target exists
    if (fs.existsSync(destPath) && sourcePath !== destPath && !params.confirmed) {
      const conf = this.confirmationService.createPendingConfirmation({
        type: 'RENAME',
        summary: `Rename "${oldName}" to "${newName}" (overwriting existing file)`,
        promptQuestion: `"${newName}" already exists. Do you want me to replace it and rename "${oldName}"?`,
        details: { sourcePath, destPath },
        executor: () => this.renameFile({ ...params, confirmed: true }),
      });

      return {
        success: true,
        tool: 'rename_file',
        requiresConfirmation: true,
        result: {
          pendingConfirmation: true,
          confirmationId: conf.confirmationId,
          spokenSummary: conf.promptQuestion,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Perform rename
    try {
      await fs.promises.rename(sourcePath, destPath);

      // Verify post-rename
      if (!fs.existsSync(destPath)) {
        throw new Error('Rename verification failed; target file not found after operation.');
      }

      return {
        success: true,
        tool: 'rename_file',
        result: {
          action: 'renamed',
          oldName,
          newName,
          path: destPath,
          spokenSummary: `Renamed "${oldName}" to "${newName}".`,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'rename_file',
        error: `Failed to rename: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }
  }

  // ==========================================
  // 6. COPY FILE
  // ==========================================

  public async copyFile(params: {
    sourcePathOrName: string;
    destinationPathOrDir: string;
    overwrite?: boolean;
  }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const sourceRaw = (params.sourcePathOrName || '').trim();
    const destRaw = (params.destinationPathOrDir || '').trim();

    if (!sourceRaw || !destRaw) {
      return {
        success: false,
        tool: 'copy_file',
        error: 'Please specify both the source file and destination location.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // 1. Resolve source
    const sourceValidation = this.allowedDirs.resolveSecurePath(sourceRaw);
    if (!sourceValidation.isValid) {
      return {
        success: false,
        tool: 'copy_file',
        error: `Source location: ${sourceValidation.error}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const sourcePath = sourceValidation.resolvedPath;
    if (!fs.existsSync(sourcePath)) {
      return {
        success: false,
        tool: 'copy_file',
        error: `Source file "${path.basename(sourcePath)}" does not exist.`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // 2. Resolve destination
    let destTarget = destRaw;
    const destValidation = this.allowedDirs.resolveSecurePath(destTarget);
    if (!destValidation.isValid) {
      return {
        success: false,
        tool: 'copy_file',
        error: `Destination location: ${destValidation.error}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    let finalDest = destValidation.resolvedPath;

    // If destination is an existing folder, append the source filename
    if (fs.existsSync(finalDest) && fs.statSync(finalDest).isDirectory()) {
      finalDest = path.join(finalDest, path.basename(sourcePath));
    }

    // Overwrite check
    if (fs.existsSync(finalDest) && !params.overwrite) {
      const fileName = path.basename(finalDest);
      const conf = this.confirmationService.createPendingConfirmation({
        type: 'COPY_OVERWRITE',
        summary: `Copy and overwrite "${fileName}"`,
        promptQuestion: `A file named "${fileName}" already exists at the destination. Do you want me to replace it?`,
        details: { sourcePath, destPath: finalDest },
        executor: () => this.copyFile({ ...params, overwrite: true }),
      });

      return {
        success: true,
        tool: 'copy_file',
        requiresConfirmation: true,
        result: {
          pendingConfirmation: true,
          confirmationId: conf.confirmationId,
          spokenSummary: conf.promptQuestion,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    try {
      await fs.promises.cp(sourcePath, finalDest, { recursive: true, force: true });

      // Verify post-copy
      if (!fs.existsSync(finalDest)) {
        throw new Error('Copy verification failed; destination not found after copy.');
      }

      const fileName = path.basename(sourcePath);
      const destDirName = path.basename(path.dirname(finalDest));

      return {
        success: true,
        tool: 'copy_file',
        result: {
          action: 'copied',
          source: sourcePath,
          destination: finalDest,
          name: fileName,
          spokenSummary: `Copied "${fileName}" to ${destDirName}.`,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'copy_file',
        error: `Failed to copy: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }
  }

  // ==========================================
  // 7. MOVE FILE
  // ==========================================

  public async moveFile(params: {
    sourcePathOrName: string;
    destinationPathOrDir: string;
    overwrite?: boolean;
    confirmed?: boolean;
  }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const sourceRaw = (params.sourcePathOrName || '').trim();
    const destRaw = (params.destinationPathOrDir || '').trim();

    if (!sourceRaw || !destRaw) {
      return {
        success: false,
        tool: 'move_file',
        error: 'Please specify both the source file and destination directory.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // 1. Resolve source
    const sourceValidation = this.allowedDirs.resolveSecurePath(sourceRaw);
    if (!sourceValidation.isValid) {
      return {
        success: false,
        tool: 'move_file',
        error: `Source location: ${sourceValidation.error}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    const sourcePath = sourceValidation.resolvedPath;
    if (!fs.existsSync(sourcePath)) {
      return {
        success: false,
        tool: 'move_file',
        error: `Source item "${path.basename(sourcePath)}" does not exist.`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // 2. Resolve destination
    const destValidation = this.allowedDirs.resolveSecurePath(destRaw);
    if (!destValidation.isValid) {
      return {
        success: false,
        tool: 'move_file',
        error: `Destination location: ${destValidation.error}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    let finalDest = destValidation.resolvedPath;

    // If destination is a directory, append source name
    if (fs.existsSync(finalDest) && fs.statSync(finalDest).isDirectory()) {
      finalDest = path.join(finalDest, path.basename(sourcePath));
    }

    // Overwrite check
    if (fs.existsSync(finalDest) && sourcePath !== finalDest && !params.overwrite) {
      const fileName = path.basename(finalDest);
      const conf = this.confirmationService.createPendingConfirmation({
        type: 'MOVE',
        summary: `Move "${path.basename(sourcePath)}" to replace existing "${fileName}"`,
        promptQuestion: `A file named "${fileName}" already exists in the destination folder. Replace it?`,
        details: { sourcePath, destPath: finalDest },
        executor: () => this.moveFile({ ...params, overwrite: true, confirmed: true }),
      });

      return {
        success: true,
        tool: 'move_file',
        requiresConfirmation: true,
        result: {
          pendingConfirmation: true,
          confirmationId: conf.confirmationId,
          spokenSummary: conf.promptQuestion,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    try {
      await fs.promises.rename(sourcePath, finalDest);

      // Verify post-move
      if (!fs.existsSync(finalDest)) {
        throw new Error('Move verification failed; target not found after move.');
      }

      const itemName = path.basename(sourcePath);
      const destDirName = path.basename(path.dirname(finalDest));

      return {
        success: true,
        tool: 'move_file',
        result: {
          action: 'moved',
          source: sourcePath,
          destination: finalDest,
          name: itemName,
          spokenSummary: `Moved "${itemName}" to ${destDirName}.`,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'move_file',
        error: `Failed to move: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }
  }

  // ==========================================
  // 8. MULTI-STEP PLAN EXECUTION & SAFE ROLLBACK
  // ==========================================

  public async executeMultiStep(
    plan: MultiStepPlan,
    executeToolFn: (toolName: string, args: Record<string, any>) => Promise<ToolExecutionResult>
  ): Promise<MultiStepExecutionResult> {
    const executedSteps: Array<{
      stepNumber: number;
      tool: string;
      description?: string;
      success: boolean;
      result?: any;
      error?: string;
    }> = [];

    // Track artifacts created during this multi-step sequence for safe rollback
    const createdArtifacts: Array<{ type: 'folder' | 'file'; path: string }> = [];

    let allSucceeded = true;
    let failedStepIndex = -1;
    let failureReason = '';

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepNumber = i + 1;

      try {
        const stepResult = await executeToolFn(step.tool, step.args);

        if (stepResult.success) {
          executedSteps.push({
            stepNumber,
            tool: step.tool,
            description: step.description,
            success: true,
            result: stepResult.result,
          });

          // Track newly created artifacts for safe rollback
          if (step.tool === 'create_folder' && stepResult.result?.path) {
            createdArtifacts.push({ type: 'folder', path: stepResult.result.path });
          } else if (step.tool === 'create_file' && stepResult.result?.path) {
            createdArtifacts.push({ type: 'file', path: stepResult.result.path });
          }
        } else {
          allSucceeded = false;
          failedStepIndex = i;
          failureReason = stepResult.error || 'Step execution failed';

          executedSteps.push({
            stepNumber,
            tool: step.tool,
            description: step.description,
            success: false,
            error: failureReason,
          });

          // Stop execution on failure
          break;
        }
      } catch (err: any) {
        allSucceeded = false;
        failedStepIndex = i;
        failureReason = err.message || 'Unexpected failure during step';

        executedSteps.push({
          stepNumber,
          tool: step.tool,
          description: step.description,
          success: false,
          error: failureReason,
        });
        break;
      }
    }

    // Safe Rollback handling if later step failed
    let rolledBack = false;
    let rollbackDetails: string | undefined;

    if (!allSucceeded && createdArtifacts.length > 0) {
      // Safe rollback: Only remove newly created empty folders if subsequent file creation failed
      const rollbackActions: string[] = [];

      for (const artifact of createdArtifacts.reverse()) {
        try {
          if (artifact.type === 'folder' && fs.existsSync(artifact.path)) {
            const files = fs.readdirSync(artifact.path);
            if (files.length === 0) {
              fs.rmdirSync(artifact.path);
              rollbackActions.push(`removed empty folder ${path.basename(artifact.path)}`);
            }
          }
        } catch {
          // Ignore rollback cleanup errors
        }
      }

      if (rollbackActions.length > 0) {
        rolledBack = true;
        rollbackDetails = rollbackActions.join(', ');
      }
    }

    // Build truthful, honest spoken summary
    let spokenSummary = '';
    if (allSucceeded) {
      spokenSummary = `Completed all ${plan.steps.length} actions successfully.`;
    } else {
      const succeededCount = executedSteps.filter((s) => s.success).length;
      if (succeededCount > 0) {
        const firstSuccess = executedSteps[0];
        spokenSummary = `Step 1 (${firstSuccess.tool.replace(/_/g, ' ')}) succeeded, but step ${failedStepIndex + 1} failed: ${failureReason}.${
          rolledBack ? ` Cleaned up temporary items.` : ''
        }`;
      } else {
        spokenSummary = `The operation could not be completed: ${failureReason}.`;
      }
    }

    return {
      totalSteps: plan.steps.length,
      completedSteps: executedSteps.filter((s) => s.success).length,
      allSucceeded,
      steps: executedSteps,
      rolledBack,
      rollbackDetails,
      spokenSummary,
    };
  }
}
