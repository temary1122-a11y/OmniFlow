import * as path from 'path';
import { test, expect, afterEach } from '../harness';
import { LLMClient } from '../../src/routing/LLMClient';
import { ModelRouter } from '../../src/routing/ModelRouter';
import { ModelSelector } from '../../src/routing/ModelSelector';

const repoRoot = path.resolve(__dirname, '..', '..');

function installFetchMock(matchers: Array<{ match: (u: string) => boolean; res: any }>) {
  const hits: string[] = [];
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: any, _opts: any): Promise<any> => {
    hits.push(String(url));
    for (const m of matchers) if (m.match(String(url))) return m.res;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
  };
  return { hits, restore: () => { (globalThis as any).fetch = original; } };
}

// ---- LLMClient edge cases ----

// E1: missing API key for a keyed provider yields a fallback (no-api-key branch).
test('E1 LLMClient returns no-api-key fallback when key missing', async () => {
  const client = new LLMClient();
  const res = await client.complete(
    { provider: 'openrouter', model: 'm', maxTokens: 100 } as any,
    [{ role: 'user', content: 'hi' }],
    {},
    {}
  );
  expect(res.usedFallback === true, 'missing key must produce a fallback');
  expect(res.model === 'no-api-key', `model should be no-api-key, got ${res.model}`);
});

// E2: native OpenAI-compatible tool_calls are parsed into LLMResponse.toolCalls.
test('E2 LLMClient parses native tool_calls', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('openrouter.ai'), res: { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'web_search', arguments: '{"q":"x"}' } }] } }] }) } },
  ]);
  try {
    const client = new LLMClient();
    const res = await client.complete(
      { provider: 'openrouter', model: 'm', maxTokens: 100 } as any,
      [{ role: 'user', content: 'hi' }],
      { openrouter: 'k' },
      {}
    );
    expect(Array.isArray(res.toolCalls) && res.toolCalls.length === 1, 'one tool call expected');
    expect(res.toolCalls![0].name === 'web_search', 'tool name parsed');
    expect(res.toolCalls![0].arguments.q === 'x', 'tool arguments parsed as JSON');
  } finally {
    mock.restore();
  }
});

// E3: reasoning-only response (empty content) surfaces reasoning as content.
test('E3 LLMClient uses reasoning as content when content is empty', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('api.kilo.ai'), res: { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '', reasoning_content: 'thought-here' } }] }) } },
  ]);
  try {
    const client = new LLMClient();
    const res = await client.complete(
      { provider: 'kilo-gateway', model: 'm', maxTokens: 100 } as any,
      [{ role: 'user', content: 'hi' }],
      { 'kilo-gateway': 'k' },
      {}
    );
    expect(res.content === 'thought-here', `content should fall back to reasoning, got "${res.content}"`);
    expect(res.reasoning === 'thought-here', 'reasoning preserved');
  } finally {
    mock.restore();
  }
});

// E4: 429/500 HTTP error yields a fallback response carrying the error text.
test('E4 LLMClient swallows non-404 HTTP errors into fallback with error', async () => {
  const mock = installFetchMock([
    { match: (u) => u.includes('openrouter.ai'), res: { ok: false, status: 429, text: async () => 'rate limited' } },
  ]);
  try {
    const client = new LLMClient();
    const res = await client.complete(
      { provider: 'openrouter', model: 'm', maxTokens: 100 } as any,
      [{ role: 'user', content: 'hi' }],
      { openrouter: 'k' },
      {}
    );
    expect(res.usedFallback === true, 'HTTP 429 must produce a fallback response');
    expect(typeof res.error === 'string' && res.error.includes('429'), 'error text should include status');
  } finally {
    mock.restore();
  }
});

// ---- ModelRouter edge cases ----

// E5: kilo-gateway high budget resolves to a paid gpt-4o model.
test('E5 kilo-gateway high budget resolves to gpt-4o', () => {
  const router = new ModelRouter('free', repoRoot);
  const sel = router.route(
    { phase: 'research', agentRole: 'researcher', complexity: 'high', budget: 'high' },
    { openrouter: 'k' }, 'prompt', 'kilo-gateway'
  );
  expect(sel.modelId === 'gpt-4o', `high budget kilo must be gpt-4o, got ${sel.modelId}`);
});

// E6: kilo-gateway normal/low budget resolves to gpt-4o-mini.
test('E6 kilo-gateway normal budget resolves to gpt-4o-mini', () => {
  const router = new ModelRouter('free', repoRoot);
  const sel = router.route(
    { phase: 'research', agentRole: 'researcher', complexity: 'high', budget: 'normal' },
    { openrouter: 'k' }, 'prompt', 'kilo-gateway'
  );
  expect(sel.modelId === 'gpt-4o-mini', `normal budget kilo must be gpt-4o-mini, got ${sel.modelId}`);
});

// E7: markCreditsExhausted forces free-only routing and resets budget.
test('E7 markCreditsExhausted flips router to free-only', () => {
  const router = new ModelRouter('normal', repoRoot);
  expect(router.isFreeOnly() === false, 'should not be free-only initially');
  router.markCreditsExhausted();
  expect(router.isFreeOnly() === true, 'must be free-only after exhaustion');
});

// E8: custom orchestrator model is honored for the orchestrator role.
test('E8 setCustomOrchestratorModel overrides orchestrator selection', () => {
  const router = new ModelRouter('free', repoRoot);
  router.setCustomOrchestratorModel('custom/orch-model');
  const sel = router.route(
    { phase: 'intake', agentRole: 'orchestrator', complexity: 'medium' },
    { openrouter: 'k' }, 'prompt', 'openrouter'
  );
  expect(sel.modelId === 'custom/orch-model', `custom orchestrator model must be used, got ${sel.modelId}`);
});

// ---- ModelSelector edge cases ----

// E9: enableFallback:false yields an empty fallback chain.
test('E9 ModelSelector with enableFallback=false returns empty fallbackChain', () => {
  const registry = new FreeModelCapabilityRegistryFaker();
  const selector = new ModelSelector(registry, { budget: 'free', enableFallback: false });
  const sel = selector.select(classification('medium'), 'researcher', ['openrouter', 'kilo-gateway'] as any);
  expect(Array.isArray(sel.fallbackChain) && sel.fallbackChain.length === 0, 'fallbackChain must be empty');
});

// E10: empty registry falls back to a default role-based selection.
test('E10 ModelSelector with empty registry uses default selection', () => {
  const registry = new FreeModelCapabilityRegistryFaker();
  const selector = new ModelSelector(registry, { budget: 'high' });
  const sel = selector.select(classification('medium'), 'researcher', ['openrouter'] as any);
  expect(sel.provider === 'openrouter', 'default provider openrouter');
  expect(sel.modelId === 'google/gemini-2.0-flash-001:free', `default researcher model, got ${sel.modelId}`);
});

/** Minimal fake registry that behaves as if it has NO models loaded. */
class FreeModelCapabilityRegistryFaker {
  getBestModelForRole(_r: any): any { return undefined; }
  getBestModelForComplexity(_c: any): any { return undefined; }
  getModels(): any[] { return []; }
  getModelsByProvider(_p: any): any[] { return []; }
}

function classification(complexity: 'simple' | 'medium' | 'complex'): any {
  return {
    complexity,
    confidence: 0.8,
    dimensions: { tokenCount: 100, codePresence: false, toolUseDetection: false, reasoningComplexity: 0, domainSpecificity: 0, multiHopRequirements: false, creativityLevel: 0, precisionNeeds: 0, contextLengthRequirements: 4096, latencySensitivity: 0, costTolerance: 0, securityRequirements: 0, languageComplexity: 0, outputFormatConstraints: [] },
    reasoning: '',
  };
}

afterEach(() => { /* fetch restored in each test's finally */ });
