import { test, expect } from '../harness';
import { ModelIndexer } from '../../src/routing/ModelIndexer';

test('MI2 refreshIndex merges static fallback with fetched kilo models (mocked fetcher)', async () => {
  const indexer = new ModelIndexer();
  // Mock the fetcher so we never hit the network. Only the kilo endpoint "succeeds".
  (indexer as any).fetcher = async (url: string) => {
    if (String(url).includes('kilo')) {
      return { ok: true, json: async () => ({ data: [{ id: 'kilo/fetched-model:free', context_length: 8192, pricing: { prompt: '0' } }] }) };
    }
    return { ok: false, json: async () => ({}) };
  };
  process.env['KILO_API_KEY'] = 'test-key';
  try {
    await indexer.refreshIndex();
  } finally {
    delete process.env['KILO_API_KEY'];
  }
  const models: any[] = indexer.getModels();
  const fetched = models.find((m) => m.modelId === 'kilo/fetched-model:free');
  expect(!!fetched, 'fetched kilo model should be present after refreshIndex');
  expect(fetched && fetched.price === 'Free', 'model with prompt price 0 should be classified Free');
  expect(fetched && Array.isArray(fetched.roleSuitability) && fetched.roleSuitability.length > 0, 'fetched model should have roleSuitability');
  const stepfun = models.find((m) => m.modelId === 'stepfun/step-3.7-flash:free');
  expect(!!stepfun, 'static fallback models should remain after refreshIndex (merge, not replace)');
});

test('MI3 selectModel for a role returns a usable free selection', async () => {
  const indexer = new ModelIndexer();
  await indexer.refreshIndex();
  const sel = indexer.selectModel('coder');
  expect(sel !== null, 'selectModel should return a selection for a known role');
  if (sel) {
    expect(sel.costTier === 'free', 'selectModel default costTier should be free');
    expect(typeof sel.modelId === 'string' && sel.modelId.length > 0, 'selection modelId should be non-empty');
    expect(sel.maxTokens === 4000, `coder maxTokens should be 4000, got ${sel.maxTokens}`);
  }
});