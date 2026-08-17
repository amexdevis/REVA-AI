/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { ToolExecutionService } from '../services/tool-execution.service.js';

export const toolsRouter = Router();
const toolService = ToolExecutionService.getInstance();

/**
 * GET /api/tools
 * List available tools and metadata
 */
toolsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const tools = toolService.getAvailableTools();
    res.json({
      success: true,
      count: tools.length,
      tools,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to list tools' });
  }
});

/**
 * POST /api/tools/execute
 * Execute a specific tool with parameters
 */
toolsRouter.post('/execute', async (req: Request, res: Response) => {
  try {
    const { tool, name, args } = req.body;
    const targetTool = tool || name;

    if (!targetTool) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter "tool" or "name".',
      });
    }

    const result = await toolService.executeTool(targetTool, args || {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to execute tool',
    });
  }
});

/**
 * GET /api/tools/history
 * Get recent tool execution history
 */
toolsRouter.get('/history', (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 30), 10)));
    const history = toolService.getHistory(limit);
    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get tool history' });
  }
});

/**
 * GET /api/tools/status
 * Get current system status snapshot
 */
toolsRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const result = await toolService.executeTool('get_system_status', {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get system status' });
  }
});

/**
 * GET /api/tools/notes
 * Get all saved notes
 */
toolsRouter.get('/notes', (_req: Request, res: Response) => {
  try {
    const notes = toolService.getNotes();
    res.json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get notes' });
  }
});

/**
 * POST /api/tools/notes
 * Create a new note
 */
toolsRouter.post('/notes', async (req: Request, res: Response) => {
  try {
    const { title, content, tags } = req.body;
    const result = await toolService.executeTool('create_note', { title, content, tags });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create note' });
  }
});

/**
 * DELETE /api/tools/notes/:id
 * Delete a note
 */
toolsRouter.delete('/notes/:id', async (req: Request, res: Response) => {
  try {
    const result = await toolService.executeTool('delete_note', { idOrTitle: req.params.id });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete note' });
  }
});

/**
 * GET /api/tools/timers
 * Get all active and recent timers
 */
toolsRouter.get('/timers', (_req: Request, res: Response) => {
  try {
    const timers = toolService.getTimers();
    res.json({
      success: true,
      count: timers.length,
      timers,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get timers' });
  }
});

/**
 * POST /api/tools/timers
 * Set a new timer
 */
toolsRouter.post('/timers', async (req: Request, res: Response) => {
  try {
    const { durationSeconds, minutes, label } = req.body;
    const result = await toolService.executeTool('set_timer', { durationSeconds, minutes, label });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to set timer' });
  }
});
