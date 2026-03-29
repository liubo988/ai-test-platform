'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  sessionId: string;
  isActive: boolean;
  compact?: boolean;
  hideHeader?: boolean;
  viewportClassName?: string;
  className?: string;
}

export default function BrowserView({
  sessionId,
  isActive,
  compact = false,
  hideHeader = false,
  viewportClassName = '',
  className = '',
}: Props) {
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
  const shellClassName = compact
    ? 'rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,23,0.96),rgba(8,10,14,0.98))] p-3.5 shadow-[0_28px_70px_rgba(15,23,42,0.34)]'
    : 'rounded-[28px] border border-black/5 bg-[rgba(255,251,246,0.92)] p-5 shadow-[0_18px_40px_rgba(44,37,28,0.08)]';
  const viewportToneClassName = compact ? 'bg-[#06080b]' : 'bg-gray-900';
  const canvasClassName = viewportClassName ? 'h-full w-full' : 'h-auto w-full';

  return (
    <div className={`${shellClassName} ${className}`.trim()}>
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

      <div className={`${viewportToneClassName} relative overflow-hidden rounded-[22px] ${viewportClassName}`.trim()}>
        {compact && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffb86c]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffd26f]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#89d185]" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Live Preview</span>
          </div>
        )}
        <canvas ref={canvasRef} width={1280} height={720} className={canvasClassName} />
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07090d]/78 px-6 text-center text-sm tracking-[0.01em] text-slate-300">
            {overlayMessage}
          </div>
        )}
      </div>
      {hideHeader && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
          <span className={`flex items-center gap-1 ${connected ? 'text-emerald-300' : 'text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {connected ? '已连接' : hasReceivedFrames ? '已断开 (保留最后画面)' : '未连接'}
          </span>
          {frameCount > 0 && <span>帧数: {frameCount}</span>}
        </div>
      )}
    </div>
  );
}
