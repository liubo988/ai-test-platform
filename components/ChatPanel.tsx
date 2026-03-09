'use client';

import { useEffect, useRef } from 'react';

export interface ChatMessage {
  type: 'thinking' | 'code' | 'complete' | 'error';
  content: string;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export default function ChatPanel({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">LLM 对话</h2>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {messages.length === 0 && <p className="text-sm text-gray-400">等待开始...</p>}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2.5 rounded text-sm ${
              msg.type === 'error'
                ? 'bg-red-50 text-red-700'
                : msg.type === 'thinking'
                  ? 'bg-blue-50 text-blue-800'
                  : msg.type === 'complete'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-gray-50 text-gray-700'
            }`}
          >
            {msg.type === 'thinking' && <span className="font-medium">思考: </span>}
            {msg.type === 'error' && <span className="font-medium">错误: </span>}
            {msg.type === 'complete' && <span className="font-medium">完成: </span>}
            {msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content}
          </div>
        ))}
        {isStreaming && <div className="p-2 text-sm text-gray-400 animate-pulse">正在生成...</div>}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
