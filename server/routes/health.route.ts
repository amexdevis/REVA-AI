/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'REVA',
    timestamp: new Date().toISOString(),
  });
});
