'use client';

import type { TestResult } from '@/lib/test-executor';

interface Props {
  result: TestResult | null;
  isExecuting: boolean;
  onRetry: () => void;
  feedbackStatus?: string;
}

export default function TestResults({ result, isExecuting, onRetry, feedbackStatus }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">测试结果</h2>

      {isExecuting && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-500">正在执行测试...</p>
          </div>
        </div>
      )}

      {!isExecuting && !result && <div className="flex-1 flex items-center justify-center text-sm text-gray-400">等待执行...</div>}

      {result && !isExecuting && (
        <div className="flex-1 space-y-3 overflow-y-auto">
          <div className={`p-3 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-lg font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.success ? '测试通过' : '测试失败'}
            </p>
            <p className="text-sm text-gray-600 mt-1">耗时: {(result.duration / 1000).toFixed(1)}s</p>
          </div>

          {result.steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">执行步骤:</p>
              {result.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{step.status === 'passed' ? '✓' : '✗'}</span>
                  <span className={step.status === 'passed' ? 'text-green-700' : 'text-red-700'}>{step.title}</span>
                  <span className="text-gray-400 text-xs ml-auto">{step.duration}ms</span>
                </div>
              ))}
            </div>
          )}

          {result.error && (
            <pre className="p-3 bg-red-50 text-red-800 text-xs rounded overflow-auto max-h-[150px]">{result.error}</pre>
          )}

          {feedbackStatus && <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">{feedbackStatus}</p>}

          <div className="flex gap-2 pt-2">
            {!result.success && (
              <button onClick={onRetry} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                重新生成
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
