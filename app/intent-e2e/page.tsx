import type { Metadata } from 'next';
import { Suspense } from 'react';
import IntentE2EWorkbench from '@/components/IntentE2EWorkbench';

export const metadata: Metadata = {
  title: 'AI 意图驱动 E2E 工作台',
  description: '一句话 + 图片，自动规划、生成、执行并修复 E2E 测试。',
};

export default function IntentE2EPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f3eb] p-6 text-slate-600">正在加载意图工作台…</div>}>
      <IntentE2EWorkbench />
    </Suspense>
  );
}
