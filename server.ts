/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';
import express from 'express';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createRevaServer, logServerInit } from './server/index.js';
import { setupVoiceWebSocket } from './server/ws/voice.ws.js';

async function startServer() {
  const app = createRevaServer();
  const PORT = 3000;

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  setupVoiceWebSocket(wss);

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = new URL(request.url || '', `http://${request.headers.host}`);
    if (parsedUrl.pathname === '/api/ws/voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[REVA] Server started on port ${PORT}`);
    logServerInit();
  });
}

startServer().catch((err) => {
  console.error('[REVA] Failed to start server:', err);
  process.exit(1);
});
