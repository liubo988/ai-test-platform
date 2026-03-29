import type { CapabilityVerificationIntent } from './capability-verification';

export type CapabilityVerificationExecutionObservation = {
  capabilityUid: string;
  verificationIntent?: CapabilityVerificationIntent;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

export const CAPABILITY_VERIFICATION_OBSERVATION_EVENT_TYPE = 'capability_verification_observation';

const STORAGE_KEY_PREFIX = 'capability-verification-execution-observation:';

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const normalized = normalizeString(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function toTimestamp(value: unknown): number {
  const normalized = normalizeString(value);
  if (!normalized) return 0;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCapabilityVerificationExecutionObservation(
  value: unknown
): CapabilityVerificationExecutionObservation {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const verificationIntent =
    record.verificationIntent === 'review' || record.verificationIntent === 'verify'
      ? record.verificationIntent
      : undefined;
  return {
    capabilityUid: normalizeString(record.capabilityUid),
    verificationIntent,
    latestRepairObservationAt: normalizeString(record.latestRepairObservationAt),
    latestRepairObservationSummary: normalizeString(record.latestRepairObservationSummary),
    latestRepairObservationVerifierCheckUids: normalizeStringList(record.latestRepairObservationVerifierCheckUids),
  };
}

export function hasCapabilityVerificationExecutionObservation(value: unknown): boolean {
  const normalized = normalizeCapabilityVerificationExecutionObservation(value);
  return Boolean(normalized.latestRepairObservationSummary || normalized.latestRepairObservationVerifierCheckUids.length > 0);
}

export function pickLatestCapabilityVerificationExecutionObservationFromEvents(
  events: Array<{ eventType?: unknown; createdAt?: unknown; payload?: unknown }>
): CapabilityVerificationExecutionObservation | null {
  let latest: CapabilityVerificationExecutionObservation | null = null;
  let latestCreatedAtMs = 0;

  for (const event of events) {
    if (event?.eventType !== CAPABILITY_VERIFICATION_OBSERVATION_EVENT_TYPE) continue;
    const observation = normalizeCapabilityVerificationExecutionObservation(event.payload);
    if (!hasCapabilityVerificationExecutionObservation(observation)) continue;

    const createdAtMs = toTimestamp(event.createdAt) || toTimestamp(observation.latestRepairObservationAt);
    if (!latest || createdAtMs >= latestCreatedAtMs) {
      latest = observation;
      latestCreatedAtMs = createdAtMs;
    }
  }

  return latest;
}

function getStorageKey(executionUid: string): string {
  return `${STORAGE_KEY_PREFIX}${executionUid.trim()}`;
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function stashCapabilityVerificationExecutionObservation(
  executionUid: string,
  value: CapabilityVerificationExecutionObservation
): void {
  const normalizedExecutionUid = executionUid.trim();
  if (!normalizedExecutionUid || !canUseSessionStorage()) return;

  const normalized = normalizeCapabilityVerificationExecutionObservation(value);
  if (!hasCapabilityVerificationExecutionObservation(normalized)) {
    return;
  }

  try {
    window.sessionStorage.setItem(getStorageKey(normalizedExecutionUid), JSON.stringify(normalized));
  } catch {
    // Ignore storage failures; observation is best-effort UI context only.
  }
}

export function readCapabilityVerificationExecutionObservation(
  executionUid: string
): CapabilityVerificationExecutionObservation | null {
  const normalizedExecutionUid = executionUid.trim();
  if (!normalizedExecutionUid || !canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(normalizedExecutionUid));
    if (!raw) return null;
    const normalized = normalizeCapabilityVerificationExecutionObservation(JSON.parse(raw));
    if (!hasCapabilityVerificationExecutionObservation(normalized)) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}
