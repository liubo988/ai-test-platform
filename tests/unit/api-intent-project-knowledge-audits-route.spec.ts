import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-project-knowledge', () => ({
  listIntentProjectKnowledgeAuditEntries: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  requireProjectRole: vi.fn(),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { GET } from '../../app/api/intent-e2e/project-knowledge/audits/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listIntentProjectKnowledgeAuditEntries } from '@/lib/intent-project-knowledge';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('intent project knowledge audits route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listIntentProjectKnowledgeAuditEntries).mockResolvedValue({
      auditLogPath: 'reports/intent-e2e.project-knowledge.audit.jsonl',
      items: [],
    } as never);
  });

  it('lists global audit entries without project auth when no project is specified', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/audits?limit=8');
    const res = await GET(req);

    expect(listIntentProjectKnowledgeAuditEntries).toHaveBeenCalledWith(8, '');
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      auditLogPath: 'reports/intent-e2e.project-knowledge.audit.jsonl',
      items: [],
    });
  });

  it('checks project permissions when filtering by project uid', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/audits?limit=6&projectUid=proj_1');
    const res = await GET(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目知识审计');
    expect(listIntentProjectKnowledgeAuditEntries).toHaveBeenCalledWith(6, 'proj_1');
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
