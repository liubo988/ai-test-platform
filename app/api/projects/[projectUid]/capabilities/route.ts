import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  listProjectCapabilities,
  upsertProjectCapabilities,
  type KnowledgeStatus,
  type ProjectCapabilityInput,
} from '@/lib/db/repository';
import { type CapabilityType } from '@/lib/project-knowledge';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeStatus(input: string | null | undefined): KnowledgeStatus | 'all' {
  if (input === 'archived' || input === 'all') return input;
  return 'active';
}

function normalizeCapabilityType(input: unknown, allowAll = false): CapabilityType | 'all' {
  if (input === 'auth' || input === 'navigation' || input === 'action' || input === 'assertion' || input === 'query' || input === 'composite') {
    return input;
  }
  if (allowAll && input === 'all') return 'all';
  throw new Error('无效的能力类型');
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeCapabilityInput(input: unknown): ProjectCapabilityInput {
  if (!input || typeof input !== 'object') {
    throw new Error('能力配置格式错误');
  }

  const value = input as Record<string, unknown>;
  return {
    slug: String(value.slug || '').trim(),
    name: String(value.name || '').trim(),
    description: String(value.description || '').trim(),
    capabilityType: normalizeCapabilityType(value.capabilityType) as CapabilityType,
    entryUrl: value.entryUrl ? String(value.entryUrl) : '',
    triggerPhrases: normalizeStringArray(value.triggerPhrases),
    preconditions: normalizeStringArray(value.preconditions),
    steps: normalizeStringArray(value.steps),
    assertions: normalizeStringArray(value.assertions),
    cleanupNotes: value.cleanupNotes ? String(value.cleanupNotes) : '',
    dependsOn: normalizeStringArray(value.dependsOn),
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Number(value.sortOrder) : 100,
    status: normalizeStatus(value.status as string) === 'archived' ? 'archived' : 'active',
    sourceDocumentUid: value.sourceDocumentUid ? String(value.sourceDocumentUid) : '',
    meta: value.meta,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目能力库');
    const { searchParams } = new URL(req.url);
    const items = await listProjectCapabilities(projectUid, {
      status: normalizeStatus(searchParams.get('status')),
      capabilityType: normalizeCapabilityType(searchParams.get('capabilityType') || 'all', true),
    });

    return applyActorCookie(NextResponse.json({ items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载项目能力库失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限维护项目能力库');
    const body = await req.json();
    const rawItems = Array.isArray(body?.items) ? body.items : [body];
    const inputs = rawItems.map(normalizeCapabilityInput);

    if (inputs.length === 0) {
      return NextResponse.json({ error: '缺少能力配置' }, { status: 400 });
    }

    const items = await upsertProjectCapabilities(projectUid, inputs, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ items }, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '写入项目能力失败');
  }
}
