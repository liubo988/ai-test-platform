'use client';

import { useEffect, useRef } from 'react';

interface Props {
  code: string;
  onExecute: () => void;
  isExecuting: boolean;
}

export default function ScriptViewer({ code, onExecute, isExecuting }: Props) {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">生成代码</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!code}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            复制
          </button>
          <button
            onClick={onExecute}
            disabled={!code || isExecuting}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isExecuting ? '执行中...' : '执行测试'}
          </button>
        </div>
      </div>
      <pre
        ref={codeRef}
        className="flex-1 overflow-auto bg-gray-900 text-green-400 p-4 rounded-md text-xs font-mono leading-relaxed min-h-[200px] max-h-[400px]"
      >
        {code || '// 等待生成...'}
      </pre>
    </div>
  );
}
