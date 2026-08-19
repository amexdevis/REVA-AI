/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { TimeService } from '../services/time.service.js';

export const timeRouter = Router();
const timeService = TimeService.getInstance();

/**
 * GET /api/time/current
 * Returns the current time calculated strictly in the user's detected browser/system timezone
 */
timeRouter.get('/current', (_req: Request, res: Response) => {
  try {
    const timeContext = timeService.getTimeContext();
    const toolData = timeService.getCurrentTimeToolResult();
    res.json({
      success: true,
      timeZone: timeService.getUserTimezone(),
      localTime: timeContext.localTimeFormatted,
      localDate: timeContext.localDateFormatted,
      periodOfDay: timeContext.periodOfDay,
      isLateNight: timeContext.isLateNight,
      timeContext,
      toolData,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get current time' });
  }
});

/**
 * POST /api/time/sync
 * Receives the browser's Intl.DateTimeFormat().resolvedOptions().timeZone and synchronizes it
 */
timeRouter.post('/sync', (req: Request, res: Response) => {
  try {
    const { timezone, offsetMinutes } = req.body;
    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required string parameter "timezone" (e.g. Intl.DateTimeFormat().resolvedOptions().timeZone).',
      });
    }

    const updated = timeService.setUserTimezone(timezone, typeof offsetMinutes === 'number' ? offsetMinutes : undefined);
    if (!updated) {
      return res.status(400).json({
        success: false,
        error: `Invalid IANA timezone identifier: "${timezone}"`,
      });
    }

    const timeContext = timeService.getTimeContext();
    res.json({
      success: true,
      timeZone: timeService.getUserTimezone(),
      localTime: timeContext.localTimeFormatted,
      localDate: timeContext.localDateFormatted,
      timeContext,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to sync timezone' });
  }
});
