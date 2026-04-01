import { describe, expect, it } from 'vitest';
import {
  getIntentE2ESystemOnboardingManifest,
  listIntentE2ESystemOnboardingManifests,
  resolveIntentE2ECiCdProfile,
  resolveIntentE2ESystemOnboardingDefaults,
} from '@/lib/intent-e2e-system-onboarding';

describe('intent-e2e-system-onboarding', () => {
  it('loads the repo-owned non-current system onboarding sample', () => {
    const manifests = listIntentE2ESystemOnboardingManifests();
    const manifest = getIntentE2ESystemOnboardingManifest('vendor_portal_staging');

    expect(manifests).toHaveLength(1);
    expect(manifest).toMatchObject({
      manifestId: 'vendor_portal_staging',
      displayName: 'Vendor Portal Staging',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      envProfile: 'staging',
      systemProfile: {
        systemKey: 'vendor_portal',
        entryUrl: 'https://vendor.example.test/login',
      },
      benchmarkBinding: {
        mode: 'project_default',
        comparedLabel: 'vendor-portal-current',
      },
    });
  });

  it('applies manifest target url and governance defaults while preserving explicit overrides', () => {
    const resolved = resolveIntentE2ESystemOnboardingDefaults({
      onboardingManifestId: 'vendor_portal_staging',
      runtimeGovernance: {
        environmentProfile: 'test',
        credential: {
          sessionMode: 'isolated',
        },
        fixture: {
          owner: 'owner://override/vendor',
        },
      },
    });

    expect(resolved.targetUrl).toBe('https://vendor.example.test/login');
    expect(resolved.systemOnboarding).toMatchObject({
      manifestId: 'vendor_portal_staging',
      systemKey: 'vendor_portal',
      envProfile: 'staging',
    });
    expect(resolved.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      credential: {
        source: 'project',
        secretRef: 'project://vendor-portal/auth/default',
        accountRef: 'account://project/vendor-portal/shared-browser',
        sessionMode: 'isolated',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://vendor-portal/order/setup',
        cleanupRef: 'fixture://vendor-portal/order/cleanup',
        owner: 'owner://override/vendor',
        idempotencyKey: 'vendor-order-smoke',
      },
    });
  });

  it('normalizes supported cicd profiles and falls back to manual', () => {
    expect(resolveIntentE2ECiCdProfile(' scheduled_regression ')).toBe('scheduled_regression');
    expect(resolveIntentE2ECiCdProfile('unknown')).toBe('manual');
  });

  it('throws when the onboarding manifest id does not exist', () => {
    expect(() =>
      resolveIntentE2ESystemOnboardingDefaults({
        onboardingManifestId: 'missing_manifest',
      })
    ).toThrow('onboarding manifest 不存在：missing_manifest');
  });
});
