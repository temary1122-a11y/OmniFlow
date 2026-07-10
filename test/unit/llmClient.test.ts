import { test, expect } from '../harness';
import { LLMClient } from '../../src/routing/LLMClient';

test('D fallback provider returns offline research JSON with summary + sources', async () => {
  const client = new LLMClient();
  const res = await client.complete(
    { provider: 'fallback', model: 'x', maxTokens: 200 } as any,
    [{ role: 'user', content: 'research the best stack' }],
    {},
    {}
  );

  expect(res.usedFallback === true, `usedFallback should be true, got ${res.usedFallback}`);
  let parsed: any;
  try {
    parsed = JSON.parse(res.content);
  } catch {
    throw new Error('fallback content is not valid JSON: ' + res.content);
  }
  expect(parsed.summary !== undefined, 'fallback JSON should include summary');
  expect(Array.isArray(parsed.sources), 'fallback JSON should include sources array');
});
