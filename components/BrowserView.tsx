'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  sessionId: string;
  isActive: boolean;
  compact?: boolean;
  hideHeader?: boolean;
}

export default function BrowserView({ sessionId, isActive, compact = false, hideHeader = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [hasReceivedFrames, setHasReceivedFrames] = useState(false);
  const lastRender = useRef(0);

  useEffect(() => {
    if (!isActive) {
      // 断开 WebSocket 但不清空画布（保留最后一帧）
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }

    // 新测试开始时重置帧计数
    setFrameCount(0);
    setHasReceivedFrames(false);

    const wsUrl = `ws://${window.location.host}/ws/screencast?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const now = Date.now();
      if (now - lastRender.current < 33) return; // ~30fps
      lastRender.current = now;

      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'frame') {
          renderFrame(data);
          setFrameCount((c) => c + 1);
          setHasReceivedFrames(true);
        }
      } catch {
        // ignore bad frame payloads
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, isActive]);

  const renderFrame = (base64: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = `data:image/jpeg;base64,${base64}`;
  };

  // 只在从未收到过帧数据且未执行时显示遮罩
  const showOverlay = !isActive && !hasReceivedFrames;

  return (
    <div className={compact ? 'rounded-lg bg-zinc-950 p-2' : 'bg-white rounded-lg shadow p-5'}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">浏览器实时画面</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className={`flex items-center gap-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
              {connected ? '已连接' : hasReceivedFrames ? '已断开 (保留最后画面)' : '未连接'}
            </span>
            {frameCount > 0 && <span>帧数: {frameCount}</span>}
          </div>
        </div>
      )}

      <div className={`${compact ? 'bg-zinc-900' : 'bg-gray-900'} rounded-lg overflow-hidden relative`}>
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-auto" />
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-gray-400 text-sm">
            点击「执行测试」后显示浏览器实时画面
          </div>
        )}
      </div>
      {hideHeader && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className={`flex items-center gap-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            {connected ? '已连接' : hasReceivedFrames ? '已断开 (保留最后画面)' : '未连接'}
          </span>
          {frameCount > 0 && <span>帧数: {frameCount}</span>}
        </div>
      )}
    </div>
  );
}
