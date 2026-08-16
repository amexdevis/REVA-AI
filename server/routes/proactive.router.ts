/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { ProactiveBehaviorService } from '../services/proactive-behavior.service.js';
import { ProactiveEventType } from '../types/voice.types.js';

const router = Router();
const proactiveService = ProactiveBehaviorService.getInstance();

// GET /api/proactive/diagnostics
router.get('/diagnostics', (req: Request, res: Response) => {
  try {
    const diagnostics = proactiveService.getDiagnostics();
    res.json({ success: true, diagnostics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get diagnostics' });
  }
});

// GET /api/proactive/settings
router.get('/settings', (req: Request, res: Response) => {
  try {
    const settings = proactiveService.getSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get settings' });
  }
});

// PATCH /api/proactive/settings
router.patch('/settings', (req: Request, res: Response) => {
  try {
    const updated = proactiveService.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update settings' });
  }
});

// POST /api/proactive/event
router.post('/event', async (req: Request, res: Response) => {
  try {
    const { type, context, voiceState } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, error: 'Event type is required' });
    }

    const decision = await proactiveService.evaluateEvent(
      type as ProactiveEventType,
      context || {},
      voiceState || 'READY'
    );

    res.json({
      success: true,
      decision,
      diagnostics: proactiveService.getDiagnostics(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to evaluate event' });
  }
});

export default router;
