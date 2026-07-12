import { test, expect } from '../harness';
import { ModelIndexer } from '../../src/routing/ModelIndexer';

test('C static fallback models are loaded from registry', () => {
  const indexer = new ModelIndexer();
  const models = (indexer as any).getStaticFallbackModels() as Array<{ modelId: string }>;

  const withDeadSlug = models.filter((m) => m.modelId.includes('gemini-2.0-flash-exp:free'));
  expect(
    withDeadSlug.length === 0,
    `no static fallback model should contain dead slug gemini-2.0-flash-exp:free (found: ${withDeadSlug.map((m) => m.modelId).join(', ')})`
  );

  expect(
    models.length > 0,
    'static fallback models should be available'
  );
});
