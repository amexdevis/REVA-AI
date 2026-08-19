/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { healthRouter } from './routes/health.route.js';
import { configRouter } from './routes/config.route.js';
import { memoryRouter } from './routes/memory.router.js';
import { sheetsMemoryRouter } from './routes/sheets-memory.router.js';
import proactiveRouter from './routes/proactive.router.js';
import { toolsRouter } from './routes/tools.router.js';
import contextRouter from './routes/context.router.js';
import { timeRouter } from './routes/time.router.js';
import { TimeService } from './services/time.service.js';
import { GeminiService } from './services/gemini.service.js';

export function createRevaServer(): Express {
  const app = express();
  const timeService = TimeService.getInstance();

  // Basic middleware
  app.use(express.json());

  // Auto-detect browser/system timezone from client header if provided
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const tzHeader = req.headers['x-user-timezone'];
    if (typeof tzHeader === 'string' && tzHeader.trim()) {
      timeService.setUserTimezone(tzHeader.trim());
    }
    next();
  });

  // Safe request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.log(`[REVA] API Request: ${req.method} ${req.path}`);
    }
    next();
  });

  // Register API routes
  app.use('/api', healthRouter);
  app.use('/api', configRouter);
  app.use('/api/memory/sheets', sheetsMemoryRouter);
  app.use('/api/memory', memoryRouter);
  app.use('/api/proactive', proactiveRouter);
  app.use('/api/tools', toolsRouter);
  app.use('/api/context', contextRouter);
  app.use('/api/time', timeRouter);

  // 404 handler for API routes
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested REVA API endpoint does not exist.',
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[REVA] Internal Server Error:', err.message || 'Unknown error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred in the REVA backend service.',
    });
  });

  return app;
}

export function logServerInit() {
  if (GeminiService.isConfigured()) {
    console.log('[REVA] Gemini configuration detected');
  } else {
    console.log('[REVA] Gemini configuration missing');
  }
}
