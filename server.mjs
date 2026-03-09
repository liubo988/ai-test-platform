import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// 先创建 HTTP 服务器，传给 Next.js 以支持 HMR WebSocket
const server = createServer();
const app = next({ dev, httpServer: server });
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
  // HTTP 请求交给 Next.js 处理
  server.on('request', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // screencast WebSocket（仅处理 /ws/screencast 路径）
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);
    if (pathname === '/ws/screencast' && query.sessionId) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const sid = query.sessionId;
        if (!sessions.has(sid)) sessions.set(sid, new Set());
        sessions.get(sid).add(ws);

        ws.on('close', () => {
          const s = sessions.get(sid);
          if (s) {
            s.delete(ws);
            if (s.size === 0) sessions.delete(sid);
          }
        });
      });
    }
    // 其他 WebSocket 升级请求（如 _next/webpack-hmr）由 Next.js 自行处理
  });

  server.listen(port, () => {
    console.log(`> AI E2E 测试平台已启动: http://localhost:${port}`);
  });
});
