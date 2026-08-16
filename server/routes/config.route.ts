/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { GeminiService } from '../services/gemini.service.js';

export const configRouter = Router();

configRouter.get('/config/status', (_req: Request, res: Response) => {
  const status = GeminiService.getStatusSummary();
  res.json({
    geminiConfigured: status.geminiConfigured,
  });
});
