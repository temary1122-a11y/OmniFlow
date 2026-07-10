import * as path from 'path';
import { test, expect, afterEach } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { ModelRouter, Provider } from '../../src/routing/ModelRouter';
import { ResilientModelRouter } from '../../src/core/ResilientModelRouter';

const repoRoot = path.resolve(__dirname, '..', '..');

function okResponse(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}
function failResponse(status: number, body: string) {
  return { ok: false, status, text: async () => body };
}

/** Install a fetch mock that returns a canned response for a set of url matchers. */
function installFetchMock(matchers: Array<{ match: (u: string) => boolean; res: any }>) {
  const hits: string[] = [];
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: any, _opts: any): Promise<any> => {
    const u = String(url);
    hits.push(u);
    for (const m of matchers) {
      if (m.match(u)) return m.res;
    }
    return okResponse('default');
  };
  return { hits, restore: () => { (globalThis as any).fetch = original; } };
}

/** A ModelRouter whose call() throws (to exercise ResilientModelRouter's catch block). */
class ThrowingRouter extends ModelRouter {
  constructor(budget: any, root: string, private failWith: string, preferred: Provider) {
    super(budget, root);
    this.setPreferredProvider(preferred);
  }
  async call(..._args: any[]): Promise<any> {
    throw new Error(this.failWith);
  }
}

function makeResilient(primary: ModelRouter, fallbacks: Map<Provider, ModelRouter>, providers: Provider[], maxRetries = 1) {
  const eventBus = new EventBus();
  return new ResilientModelRouter(eventBus, primary, fallbacks, {
    maxRetries,
    retryDelayMs: 1,
    providers,
  });
}

// G1: ResilientModelRouter's CATCH block is hit when a router throws (network error).
//     This is the exception path NOT covered by R1/R2 (which only produce usedFallback responses).
test('G1 thrown error (network) is caught, provider switches to kilo-gateway', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('api.kilo.ai'), res: okResponse('kilo-recovered') },
  ]);
  try {
    const primary = new ThrowingRouter('free', repoRoot, 'openrouter ECONNRESET', 'openrouter');
    const kilo = new ModelRouter('free', repoRoot);
    kilo.setPreferredProvider('kilo-gateway');
    const fallbacks = new Map<Provider, ModelRouter>();
    fallbacks.set('kilo-gateway', kilo);
    const resilient = makeResilient(primary, fallbacks, ['openrouter', 'kilo-gateway']);

    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal', 'sys',
      { openrouter: 'k', 'kilo-gateway': 'k' }
    );
    expect(res.usedFallback === false, 'should recover via kilo, not fallback');
    expect(res.provider === 'kilo-gateway', `provider must be kilo-gateway, got ${res.provider}`);
    expect(res.content === 'kilo-recovered', `content from kilo, got "${res.content}"`);
  } finally {
    mock.restore();
  }
});

// G2: A 429/rate-limit thrown error must be detected and recorded (extractRetryAfter).
test('G2 rate-limit thrown error is detected, sets rateLimitUntil on health status', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('api.kilo.ai'), res: okResponse('kilo-recovered') },
  ]);
  try {
    const primary = new ThrowingRouter('free', repoRoot, 'openrouter rate limit 429 retry after 30', 'openrouter');
    const kilo = new ModelRouter('free', repoRoot);
    kilo.setPreferredProvider('kilo-gateway');
    const fallbacks = new Map<Provider, ModelRouter>();
    fallbacks.set('kilo-gateway', kilo);
    const resilient = makeResilient(primary, fallbacks, ['openrouter', 'kilo-gateway']);

    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal', 'sys',
      { openrouter: 'k', 'kilo-gateway': 'k' }
    );
    expect(res.provider === 'kilo-gateway', 'recovered via kilo after rate-limit');
    const statuses = resilient.getHealthStatus();
    const orStatus = statuses.find((s) => s.provider === 'openrouter');
    expect(!!orStatus && typeof orStatus.rateLimitUntil === 'number' && orStatus.rateLimitUntil! > Date.now(),
      'openrouter health status must record rateLimitUntil in the future');
  } finally {
    mock.restore();
  }
});

// G3: HTTP 402 / "credits required" is swallowed by LLMClient (usedFallback) and must
//     trigger markCreditsExhausted() -> free-only routing on the primary router.
test('G3 402 / credits-exhausted triggers free-only routing on primary router', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('openrouter.ai'), res: failResponse(402, '{"error":"credits required"}') },
    { match: (u) => u.includes('api.kilo.ai'), res: okResponse('kilo-after-402') },
  ]);
  try {
    const primary = new ModelRouter('normal', repoRoot);
    primary.setPreferredProvider('openrouter');
    const kilo = new ModelRouter('free', repoRoot);
    kilo.setPreferredProvider('kilo-gateway');
    const fallbacks = new Map<Provider, ModelRouter>();
    fallbacks.set('kilo-gateway', kilo);
    const resilient = makeResilient(primary, fallbacks, ['openrouter', 'kilo-gateway']);

    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal', 'sys',
      { openrouter: 'k', 'kilo-gateway': 'k' }
    );
    expect(primary.isFreeOnly() === true, 'primary router must switch to FREE-ONLY after 402');
    expect(res.provider === 'kilo-gateway', 'still recovers via kilo after 402');
  } finally {
    mock.restore();
  }
});

// G4: maxRetries > 1 must re-run the provider loop. With 2 providers and maxRetries 2,
//     every provider fails 404 -> expect 4 fetch attempts (2 * 2), then graceful fallback.
test('G4 maxRetries loop re-attempts providers (4 hits for 2 providers @ maxRetries 2)', async () => {
  const mock = installFetchMock([
    { match: () => true, res: failResponse(404, 'dead') },
  ]);
  try {
    const primary = new ModelRouter('free', repoRoot);
    primary.setPreferredProvider('openrouter');
    const kilo = new ModelRouter('free', repoRoot);
    kilo.setPreferredProvider('kilo-gateway');
    const fallbacks = new Map<Provider, ModelRouter>();
    fallbacks.set('kilo-gateway', kilo);
    const resilient = makeResilient(primary, fallbacks, ['openrouter', 'kilo-gateway'], 2);

    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal', 'sys',
      { openrouter: 'k', 'kilo-gateway': 'k' }
    );
    const orHits = mock.hits.filter((h) => h.includes('openrouter.ai')).length;
    const kiloHits = mock.hits.filter((h) => h.includes('api.kilo.ai')).length;
    expect(orHits === 2, `openrouter should have been attempted twice, got ${orHits}`);
    expect(kiloHits === 2, `kilo-gateway should have been attempted twice, got ${kiloHits}`);
    expect(res.usedFallback === true, 'all attempts exhausted -> fallback');
  } finally {
    mock.restore();
  }
});

// G5: codik provider is exercised end-to-end as the recovery target.
test('G5 falls back through openrouter->kilo->codik and recovers via codik', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('openrouter.ai') || u.includes('api.kilo.ai'), res: failResponse(404, 'dead') },
    { match: (u) => u.includes('api.codik.ai'), res: okResponse('codik-content') },
  ]);
  try {
    const primary = new ModelRouter('free', repoRoot);
    primary.setPreferredProvider('openrouter');
    const kilo = new ModelRouter('free', repoRoot);
    kilo.setPreferredProvider('kilo-gateway');
    const codik = new ModelRouter('free', repoRoot);
    codik.setPreferredProvider('codik');
    const fallbacks = new Map<Provider, ModelRouter>();
    fallbacks.set('kilo-gateway', kilo);
    fallbacks.set('codik', codik);
    const resilient = makeResilient(primary, fallbacks, ['openrouter', 'kilo-gateway', 'codik']);

    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal', 'sys',
      { openrouter: 'k', 'kilo-gateway': 'k', codik: 'k' }
    );
    expect(res.provider === 'codik', `recovered via codik, got ${res.provider}`);
    expect(res.content === 'codik-content', `content from codik, got "${res.content}"`);
  } finally {
    mock.restore();
  }
});

// G6: ollama is keyless and must act as a valid recovery target.
test('G6 ollama (keyless) recovers when keyed providers fail', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('openrouter.ai') || u.includes('api.kilo.ai'), res: failResponse(404, 'dead') },
    { match: (u) => u.includes('localhost:11434'), res: okResponse('ollama-content') },
  ]);
  try {
    const primary = new ModelRouter('free', repoRoot);
    primary.setPreferredProvider('openrouter');
    const kilo = new ModelRouter('free', repoRoot);
    kilo.setPreferredProvider('kilo-gateway');
    const ollama = new ModelRouter('free', repoRoot);
    ollama.setPreferredProvider('ollama');
    const fallbacks = new Map<Provider, ModelRouter>();
    fallbacks.set('kilo-gateway', kilo);
    fallbacks.set('ollama', ollama);
    const resilient = makeResilient(primary, fallbacks, ['openrouter', 'kilo-gateway', 'ollama']);

    const res = await resilient.call(
      { phase: 'research', agentRole: 'researcher', complexity: 'medium' },
      'goal', 'sys',
      { openrouter: 'k', 'kilo-gateway': 'k' } // no ollama key -> ollama is keyless
    );
    expect(res.provider === 'ollama', `recovered via ollama (keyless), got ${res.provider}`);
    expect(res.content === 'ollama-content', `content from ollama, got "${res.content}"`);
  } finally {
    mock.restore();
  }
});

afterEach(() => {
  // tests above always restore fetch in finally; nothing to do here.
});
