import { createHash } from 'node:crypto';
export {
  cloneIntentE2ERunControl,
  compareIntentE2ERunPriority,
  normalizeIntentE2ERunControl,
  resolveIntentE2ERunControl,
} from '@/lib/intent-e2e-run-control-shared';
export type {
  IntentE2ERunControl,
  IntentE2ERunPriority,
  ResolvedIntentE2ERunControl,
} from '@/lib/intent-e2e-run-control-shared';

export interface IntentE2ERunFingerprintInput {
  input?: string;
  targetUrl?: string;
  projectUid?: string;
  moduleUid?: string;
  auth?: {
    loginUrl?: string;
    username?: string;
    loginDescription?: string;
  };
  runtimeGovernance?: {
    environmentProfile?: string;
    credential?: {
      source?: string;
      accountRef?: string;
      sessionMode?: string;
    };
    fixture?: {
      strategy?: string;
      owner?: string;
      idempotencyKey?: string;
    };
  };
}

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildIntentE2ERunRequestFingerprint(input: IntentE2ERunFingerprintInput): string {
  const payload = {
    input: normalizeTrimmedString(input.input),
    targetUrl: normalizeTrimmedString(input.targetUrl),
    projectUid: normalizeTrimmedString(input.projectUid),
    moduleUid: normalizeTrimmedString(input.moduleUid),
    auth: {
      loginUrl: normalizeTrimmedString(input.auth?.loginUrl),
      username: normalizeTrimmedString(input.auth?.username),
      loginDescription: normalizeTrimmedString(input.auth?.loginDescription),
    },
    runtimeGovernance: {
      environmentProfile: normalizeTrimmedString(input.runtimeGovernance?.environmentProfile),
      credential: {
        source: normalizeTrimmedString(input.runtimeGovernance?.credential?.source),
        accountRef: normalizeTrimmedString(input.runtimeGovernance?.credential?.accountRef),
        sessionMode: normalizeTrimmedString(input.runtimeGovernance?.credential?.sessionMode),
      },
      fixture: {
        strategy: normalizeTrimmedString(input.runtimeGovernance?.fixture?.strategy),
        owner: normalizeTrimmedString(input.runtimeGovernance?.fixture?.owner),
        idempotencyKey: normalizeTrimmedString(input.runtimeGovernance?.fixture?.idempotencyKey),
      },
    },
  };

  return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}
