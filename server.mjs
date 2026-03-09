import { createServer } from 'node:http';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3666', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

// WebSocket 会话管理
const sessions = new Map(); // sessionId -> Set<WebSocket>

export function broadcastFrame(sessionId, base64Data) {
  const clients = sessions.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'frame', data: base64Data, ts: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// 导出给 lib/test-executor.ts 调用
globalThis.__broadcastFrame = broadcastFrame;

app.prepare().then(() => {
  const handleUpgrade = app.getUpgradeHandler();
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (error) {
      console.error('request handling failed', error);
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      res.end('internal server error');
    }
  });

  // screencast WebSocket（仅处理 /ws/screencast 路径）
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const sessionId = url.searchParams.get('sessionId');

    if (url.pathname === '/ws/screencast' && sessionId) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (!sessions.has(sessionId)) sessions.set(sessionId, new Set());
        sessions.get(sessionId).add(ws);

        ws.on('close', () => {
          const s = sessions.get(sessionId);
          if (s) {
            s.delete(ws);
            if (s.size === 0) sessions.delete(sessionId);
          }
        });
      });
      return;
    }

    handleUpgrade(req, socket, head);
  });

  server.listen(port, () => {
    console.log(`> AI E2E 测试平台已启动: http://localhost:${port}`);
  });
});
