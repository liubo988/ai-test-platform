import ExecutionConsole from '@/components/ExecutionConsole';

export default async function ExecutionRunPage({ params }: { params: Promise<{ executionUid: string }> }) {
  const { executionUid } = await params;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(91,135,255,0.17),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(255,176,118,0.22),transparent_24%),linear-gradient(180deg,#f7f9fe_0%,#eef2f8_100%)] px-5 py-8 text-slate-900 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1360px]">
        <ExecutionConsole executionUid={executionUid} />
      </div>
    </div>
  );
}
