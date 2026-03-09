import Link from 'next/link';
import ExecutionWorkbench from '@/components/ExecutionWorkbench';

export default async function ExecutionPage({ params }: { params: Promise<{ executionUid: string }> }) {
  const { executionUid } = await params;

  return (
    <div className="min-h-screen bg-[#f8f7f4] px-6 py-8 text-zinc-800">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            返回配置列表
          </Link>
        </div>
        <ExecutionWorkbench executionUid={executionUid} />
      </div>
    </div>
  );
}
