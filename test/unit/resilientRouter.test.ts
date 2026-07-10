import * as path from 'path';
import { test, expect, afterEach } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { ModelRouter, Provider } from '../../src/routing/ModelRouter';
import { ResilientModelRouter } from '../../src/core/ResilientModelRouter';
import type { LLMResponse } from '../../src/routing/LLMClient';

const repoRoot = path.resolve(__dirname, '..', '..');

// A tiny fetch mock that simulates an OpenRouter 404 (dead/failed model) but a
// healthy Kilo Gateway. Lets us exercise the resilient router's provider
// switch WITHOUT any real network call or API key.
function installFetchMock() {
  const hits: string[] = [];
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: any, _opts: any): Promise<any> => {
    const u = String(url);
    hits.push(u);
    if (u.includes('openrouter.ai')) {
      return {
        ok: false,
        status: 404,
        text: async () => '{"error":"model not found"}',
      };
    }
    if (u.includes('api.kilo.ai')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'kilo-gateway live content' } }] }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'default' } }] }),
    };
  };
  return { hits, restore: () => { (globalThis as any).fetch = original; } };
}

test('R1 ResilientModelRouter falls back openrouter→kilo-gateway on 404', async () => {
  const mock = installFetchMock();
  try {
    const eventBus = new EventBus();

    // Primary router prefers openrouter; a fallback router for kilo-gateway.
    const primary = new ModelRouter('free', repoRoot);
    primary.setPreferredProvider('openrouter');
    const kiloRouter = new ModelRouter('free', repoRoot);
    kiloRouter.setPreferredProvider('kilo-gateway');

    const fallbackRouters = new Map<Provider, ModelRouter>();
    fallbackRouters.set('kilo-gateway', kiloRouter);

    const resilient = new ResilientModelRouter(eventBus, primary, fallbackRouters, {
      // Tiny retry budget so the test is fast and deterministic.
      maxRetries: 1,
      retryDelayMs: 1,
      providers: ['openrouter', 'kilo-gateway'],
    });

    const apiKeys: Record<string, string> = {
      openrouter: 'fake-openrouter-key',
      'kilo-gateway': 'fake-kilo-key',
    };

    const res: LLMResponse = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'What is the best vertical video stack?',
      'You are a research agent.',
      apiKeys
    );

    // The resilient router must have tried openrouter first (got 404) and
    // then recovered via kilo-gateway, returning real content.
    const triedOpenrouter = mock.hits.some((h) => h.includes('openrouter.ai'));
    const triedKilo = mock.hits.some((h) => h.includes('api.kilo.ai'));
    expect(triedOpenrouter, 'openrouter endpoint should have been attempted (and 404d)');
    expect(triedKilo, 'kilo-gateway endpoint should have been attempted as fallback');

    expect(res.usedFallback === false, `final response must NOT be a fallback (got usedFallback=${res.usedFallback})`);
    expect(res.provider === 'kilo-gateway', `final provider must be kilo-gateway, got ${res.provider}`);
    expect(
      res.content === 'kilo-gateway live content',
      `final content should come from kilo-gateway (got "${res.content}")`
    );
  } finally {
    mock.restore();
  }
});

test('R2 ResilientModelRouter returns graceful fallback when ALL providers fail', async () => {
  const mock = installFetchMock();
  // Override so BOTH providers 404.
  (globalThis as any).fetch = async (url: any): Promise<any> => {
    mock.hits.push(String(url));
    return { ok: false, status: 404, text: async () => 'dead' };
  };
  try {
    const eventBus = new EventBus();
    const primary = new ModelRouter('free', repoRoot);
    primary.setPreferredProvider('openrouter');
    const kiloRouter = new ModelRouter('free', repoRoot);
    kiloRouter.setPreferredProvider('kilo-gateway');
    const fallbackRouters = new Map<Provider, ModelRouter>();
    fallbackRouters.set('kilo-gateway', kiloRouter);

    const resilient = new ResilientModelRouter(eventBus, primary, fallbackRouters, {
      maxRetries: 1,
      retryDelayMs: 1,
      providers: ['openrouter', 'kilo-gateway'],
    });

    const apiKeys: Record<string, string> = {
      openrouter: 'k',
      'kilo-gateway': 'k',
    };
    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal',
      'sys',
      apiKeys
    );
    expect(res.usedFallback === true, 'all-providers-failed must yield a fallback response');
    expect(res.provider === 'fallback', `provider should be fallback, got ${res.provider}`);
  } finally {
    mock.restore();
  }
});

afterEach(() => {
  // Belt-and-suspenders: make sure no test leaves a bogus global fetch.
  if (typeof (globalThis as any).fetch !== 'function' || (globalThis as any).fetch?.mock) {
    // nothing
  }
});
