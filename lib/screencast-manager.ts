/** CDP screencast 帧广播到 WebSocket 客户端 */
export function broadcastFrame(sessionId: string, base64Data: string): void {
  const fn = (globalThis as any).__broadcastFrame;
  if (typeof fn === 'function') {
    fn(sessionId, base64Data);
  }
}
