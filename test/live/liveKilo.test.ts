/**
 * Part 2 — LIVE smoke tests (real Kilo Gateway call).
 *
 * These are the ONLY tests that touch the network, and they run ONLY when the
 * environment variable KILO_GATEWAY_API_KEY is set (read from process.env, never
 * hardcoded, never logged in full). Under the default `npm test` (no key) every
 * test below is SKIPPED, so the offline run stays fast and key-free.
 *
 * The key is meant to live in a gitignored .env or be exported in the shell:
 *   set KILO_GATEWAY_API_KEY=...   (Windows)
 *   export KILO_GATEWAY_API_KEY=... (bash)
 */
import * as path from 'path';
import { it as vitestIt, expect } from '../harness';

const apiKey = process.env['KILO_GATEWAY_API_KEY'] ?? '';
const repoRoot = path.resolve(__dirname, '..', '..');
const SLUG = 'stepfun/step-3.7-flash:free';

// Skip the entire live suite when the key is absent.
const live = vitestIt.skipIf(!apiKey);

if (!apiKey) {
  // Surface clearly that live tests were skipped (offline run).
  // eslint-disable-next-line no-console
  console.log('[live] KILO_GATEWAY_API_KEY not set — skipping live smoke tests (offline run).');
}

live(
  'L1 real LLMClient call to kilo-gateway/' + SLUG + ' returns content',
  async () => {
    const { LLMClient } = await import('../../src/routing/LLMClient');
    const client = new LLMClient();
    const res = await client.complete(
      { provider: 'kilo-gateway', modelId: SLUG, costTier: 'free', maxTokens: 256 } as any,
      [
        { role: 'system', content: 'You are a concise assistant.' },
        { role: 'user', content: 'Reply with exactly: OK' },
      ],
      { 'kilo-gateway': apiKey },
      { agentRole: 'researcher', phase: 'research' },
      60000
    );

    expect(res.usedFallback === false, `live call must not fall back (usedFallback=${res.usedFallback}, error=${res.error ?? ''})`);
    expect(res.provider === 'kilo-gateway', `provider should be kilo-gateway, got ${res.provider}`);
    expect(!!res.content && res.content.trim().length > 0, 'live response must contain non-empty content');
  },
  60000
);

live(
  'L2 end-to-end router→LLMClient→kilo-gateway returns researcher content (1 call, not full loop)',
  async () => {
    const { ModelRouter } = await import('../../src/routing/ModelRouter');
    const router = new ModelRouter('free', repoRoot);
    router.setPreferredProvider('kilo-gateway');
    router.setApiKeys({ 'kilo-gateway': apiKey });

    const res = await router.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'What is the best practice for structuring a small TypeScript API? Answer in one sentence.',
      'You are a technical research agent. Be concise.',
      { 'kilo-gateway': apiKey }
    );

    expect(res.usedFallback === false, `router live call must not fall back (usedFallback=${res.usedFallback}, error=${res.error ?? ''})`);
    expect(res.provider === 'kilo-gateway', `provider should be kilo-gateway, got ${res.provider}`);
    expect(res.modelId.includes('stepfun'), `live model should be a stepfun slug, got ${res.modelId}`);
    expect(!!res.content && res.content.trim().length > 0, 'live router response must contain non-empty content');
  },
  60000
);
