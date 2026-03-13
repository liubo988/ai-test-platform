import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectCapabilityByUid } from '@/lib/db/repository';
import { getCapabilityLastVerificationAttempt } from '@/lib/capability-verification';
import { createCapabilityVerificationConfig } from '@/lib/capability-verification-service';
import { executePlan, generatePlanFromConfig, repairExecution } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectUid: string; capabilityUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { projectUid, capabilityUid } = await ctx.params;
    const capability = await getProjectCapabilityByUid(capabilityUid);
    if (!capability || capability.projectUid !== projectUid) {
      return NextResponse.json({ error: '能力不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限验证项目能力');
    const body = await req.json().catch(() => ({}));
    const moduleUid = String(body?.moduleUid || '').trim();
    const mode = String(body?.mode || 'verify').trim();

    if (mode === 'repair') {
      const lastAttempt = getCapabilityLastVerificationAttempt(capability.meta);
      if (!lastAttempt.executionUid) {
        return NextResponse.json({ error: '该能力还没有可修复的失败验证记录，请先发起一次验证' }, { status: 409 });
      }

      const repaired = await repairExecution(lastAttempt.executionUid, { actorLabel: actor.displayName });
      return applyActorCookie(
        NextResponse.json(
          {
            configUid: '',
            planUid: repaired.planUid,
            planVersion: repaired.planVersion,
            executionUid: repaired.executionUid,
            runPath: `/runs/${repaired.executionUid}`,
          },
          { status: 201 }
        ),
        actor.userUid
      );
    }

    const { config } = await createCapabilityVerificationConfig({
      projectUid,
      capabilityUid,
      moduleUid,
      actorLabel: actor.displayName,
    });
    const plan = await generatePlanFromConfig(config.configUid, { actorLabel: actor.displayName });
    const execution = await executePlan(plan.planUid, { actorLabel: actor.displayName });

    return applyActorCookie(
      NextResponse.json(
        {
          configUid: config.configUid,
          planUid: plan.planUid,
          planVersion: plan.planVersion,
          executionUid: execution.executionUid,
          runPath: `/runs/${execution.executionUid}`,
        },
        { status: 201 }
      ),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '启动能力验证失败');
  }
}
