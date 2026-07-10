import * as path from 'path';
import { test, expect } from '../harness';
import { FreeModelCapabilityRegistry } from '../../src/routing/ModelCapabilityRegistry';

const repoRoot = path.resolve(__dirname, '..', '..');

test('B registry loads models from free-models-index.md', () => {
  const registry = new FreeModelCapabilityRegistry(repoRoot);
  const models = registry.getModels();
  expect(models.length > 0, `registry should load >0 models, got ${models.length}`);
});

test('B getBestModelForRole returns a researcher model', () => {
  const registry = new FreeModelCapabilityRegistry(repoRoot);
  const best = registry.getBestModelForRole('researcher');
  expect(best !== undefined, 'getBestModelForRole("researcher") should be defined');
});

test('B provider lowercasing works for kilo-gateway', () => {
  const registry = new FreeModelCapabilityRegistry(repoRoot);
  const kiloModels = registry.getModelsByProvider('kilo-gateway');
  expect(kiloModels.length > 0, `getModelsByProvider('kilo-gateway') should return >0, got ${kiloModels.length}`);
});
