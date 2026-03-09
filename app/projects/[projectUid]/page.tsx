import Link from 'next/link';
import ProjectWorkspace from '@/components/ProjectWorkspace';

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectUid: string }> }) {
  const { projectUid } = await params;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(91,135,255,0.17),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(255,176,118,0.22),transparent_24%),linear-gradient(180deg,#f7f9fe_0%,#eef2f8_100%)] text-slate-900">
      <div className="mx-auto max-w-[1360px] px-5 py-8 md:px-8 lg:px-10">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/70 bg-white/80 px-4 text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:bg-white"
          >
            返回项目首页
          </Link>
        </div>
        <ProjectWorkspace projectUid={projectUid} />
      </div>
    </main>
  );
}
