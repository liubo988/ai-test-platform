import { Suspense } from 'react';
import ProjectWorkspace from '@/components/ProjectWorkspace';

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectUid: string }> }) {
  const { projectUid } = await params;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(91,135,255,0.17),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(255,176,118,0.22),transparent_24%),linear-gradient(180deg,#f7f9fe_0%,#eef2f8_100%)] text-slate-900">
      <div className="mx-auto max-w-[1360px] px-5 py-8 md:px-8 lg:px-10">
        <Suspense fallback={<div className="rounded-3xl border border-slate-200/70 bg-white/80 px-6 py-10 text-sm text-slate-500 shadow-sm">正在加载项目工作台…</div>}>
          <ProjectWorkspace projectUid={projectUid} />
        </Suspense>
      </div>
    </main>
  );
}
