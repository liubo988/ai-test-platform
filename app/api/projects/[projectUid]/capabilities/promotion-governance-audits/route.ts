import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  createIntentPromotionGovernanceAuditEntry,
  getIntentPromotionGovernanceAuditPath,
  listIntentPromotionGovernanceAuditEntries,
  writeIntentPromotionGovernanceAuditEntry,
} from '@/lib/intent-promotion-governance-audit';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeNumber(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.floor(parsed)) : fallback;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(
      req,
      projectUid,
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看 promotion governance 审计'
    );
    const { searchParams } = new URL(req.url);
    const result = await listIntentPromotionGovernanceAuditEntries(
      normalizeNumber(searchParams.get('limit'), 12, 50),
      projectUid
    );

    return applyActorCookie(NextResponse.json(result), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '读取 promotion governance 审计失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(
      req,
      projectUid,
      ['owner', 'editor'],
      '当前操作者没有权限记录 promotion governance 审计'
    );
    const body = await req.json().catch(() => ({}));
    const entry = createIntentPromotionGovernanceAuditEntry({
      projectUid,
      actorLabel: actor.displayName,
      actionKind: body?.actionKind,
      sourceView: body?.sourceView,
      batchUid: body?.batchUid,
      moduleUid: body?.moduleUid,
      moduleName: body?.moduleName,
      items: Array.isArray(body?.items) ? body.items : [],
    });
    const written = await writeIntentPromotionGovernanceAuditEntry(entry);

    return applyActorCookie(
      NextResponse.json(
        {
          auditLogPath: getIntentPromotionGovernanceAuditPath(),
          item: written,
        },
        { status: 201 }
      ),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '写入 promotion governance 审计失败');
  }
}
