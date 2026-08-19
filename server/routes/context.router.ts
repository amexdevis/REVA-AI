/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { ContextAwarenessService } from '../services/context-awareness.service.js';

export const contextRouter = Router();
const contextService = ContextAwarenessService.getInstance();

/**
 * GET /api/context/diagnostics
 * Returns developer-only context diagnostics
 */
contextRouter.get('/diagnostics', (_req: Request, res: Response) => {
  try {
    const diagnostics = contextService.getDiagnostics();
    res.json({
      success: true,
      diagnostics,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get context diagnostics' });
  }
});

/**
 * GET /api/context/snapshot
 * Returns complete unified context snapshot
 */
contextRouter.get('/snapshot', (_req: Request, res: Response) => {
  try {
    const snapshot = contextService.getSnapshot();
    res.json({
      success: true,
      snapshot,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get context snapshot' });
  }
});

/**
 * GET /api/context/settings
 * Returns context awareness settings
 */
contextRouter.get('/settings', (_req: Request, res: Response) => {
  try {
    const settings = contextService.getSettings();
    res.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get context settings' });
  }
});

/**
 * PATCH /api/context/settings
 * Updates context awareness settings (e.g. toggle ON/OFF)
 */
contextRouter.patch('/settings', (req: Request, res: Response) => {
  try {
    const updated = contextService.updateSettings(req.body);
    res.json({
      success: true,
      settings: updated,
      diagnostics: contextService.getDiagnostics(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update context settings' });
  }
});

/**
 * POST /api/context/event
 * Ingests a new context or application activity event
 */
contextRouter.post('/event', (req: Request, res: Response) => {
  try {
    const { type, summary, payload } = req.body;
    if (!type || !summary) {
      return res.status(400).json({ success: false, error: 'Event "type" and "summary" are required.' });
    }

    contextService.recordContextEvent(type, summary, payload || {});
    res.json({
      success: true,
      diagnostics: contextService.getDiagnostics(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to record context event' });
  }
});

/**
 * POST /api/context/resolve
 * Tests natural ambiguity resolution on an input query
 */
contextRouter.post('/resolve', (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter is required.' });
    }

    const resolution = contextService.resolveAmbiguity(query);
    res.json({
      success: true,
      query,
      resolution,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to resolve context ambiguity' });
  }
});

export default contextRouter;
