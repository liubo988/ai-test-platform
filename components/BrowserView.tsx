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
  const reconnectTimerRef = useRef<number | null>(null);
  const hasReceivedFramesRef = useRef(false);
  const generationRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [hasReceivedFrames, setHasReceivedFrames] = useState(false);
  const lastRender = useRef(0);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = (socket: WebSocket | null) => {
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;

      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'inactive');
        return;
      }

      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener(
          'open',
          () => {
            socket.close(1000, 'stale');
          },
          { once: true }
        );
      }
    };

    if (!sessionId || !isActive) {
      clearReconnectTimer();
      closeSocket(wsRef.current);
      wsRef.current = null;
      setConnected(false);
      return;
    }

    setFrameCount(0);
    setHasReceivedFrames(false);
    hasReceivedFramesRef.current = false;
    lastRender.current = 0;

    let disposed = false;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/screencast?sessionId=${encodeURIComponent(sessionId)}`;

    const scheduleReconnect = () => {
      if (disposed) return;
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        openSocket();
      }, 1200);
    };

    const openSocket = () => {
      if (disposed) return;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      setConnected(false);

      socket.onopen = () => {
        if (disposed || generationRef.current !== generation || wsRef.current !== socket) {
          closeSocket(socket);
          return;
        }
        setConnected(true);
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (disposed || generationRef.current !== generation) return;
        setConnected(false);
        scheduleReconnect();
      };

      socket.onerror = () => {
        // Let onclose drive reconnects.
      };

      socket.onmessage = (event) => {
        const now = Date.now();
        if (now - lastRender.current < 33) return;
        lastRender.current = now;

        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'frame') {
            renderFrame(data);
            setFrameCount((count) => count + 1);
            if (!hasReceivedFramesRef.current) {
              hasReceivedFramesRef.current = true;
              setHasReceivedFrames(true);
            }
          }
        } catch {
          // Ignore malformed frame payloads.
        }
      };
    };

    openSocket();

    return () => {
      disposed = true;
      generationRef.current += 1;
      clearReconnectTimer();
      const socket = wsRef.current;
      wsRef.current = null;
      closeSocket(socket);
      setConnected(false);
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

  const overlayMessage = (() => {
    if (!sessionId) return '暂无执行会话';
    if (isActive && !connected && !hasReceivedFrames) return '正在连接实时画面...';
    if (isActive && connected && !hasReceivedFrames) return '已连接，正在等待浏览器首帧...';
    if (isActive && !connected && hasReceivedFrames) return '实时画面已断开，正在重连...';
    if (!isActive && !hasReceivedFrames) return '点击「执行测试」后显示浏览器实时画面';
    return '';
  })();
  const showOverlay = Boolean(overlayMessage);

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
            {overlayMessage}
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
