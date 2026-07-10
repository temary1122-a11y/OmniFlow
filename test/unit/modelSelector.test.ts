import * as path from 'path';
import { test, expect } from '../harness';
import { FreeModelCapabilityRegistry, ModelCapability } from '../../src/routing/ModelCapabilityRegistry';
import { ModelSelector } from '../../src/routing/ModelSelector';
import type { RequestClassification } from '../../src/routing/RequestClassifier';

const repoRoot = path.resolve(__dirname, '..', '..');

function makeRegistry(): FreeModelCapabilityRegistry {
  const registry = new FreeModelCapabilityRegistry(repoRoot);
  const models: ModelCapability[] = [
    { modelId: 'sel-free-kilo', provider: 'kilo-gateway', price: 'Free', contextWindow: 8192, benchmarks: { mmlu: 62, gsm8k: 72, humanEval: 40, mtBench: 9.9 }, roleSuitability: ['researcher', 'all'] },
    { modelId: 'sel-free-2', provider: 'openrouter', price: 'Free', contextWindow: 4096, benchmarks: { mmlu: 55, gsm8k: 68, humanEval: 30, mtBench: 5.0 }, roleSuitability: ['researcher', 'all'] },
    { modelId: 'sel-paid-openai', provider: 'openai', price: 'Paid', contextWindow: 128000, benchmarks: { mmlu: 88, gsm8k: 95, humanEval: 90, mtBench: 9.95 }, roleSuitability: ['researcher', 'all'] },
  ];
  registry.addModels(models);
  return registry;
}

function classification(complexity: 'simple' | 'medium' | 'complex'): RequestClassification {
  return {
    complexity, confidence: 0.8,
    dimensions: { tokenCount: 100, codePresence: false, toolUseDetection: false, reasoningComplexity: 0, domainSpecificity: 0, multiHopRequirements: false, creativityLevel: 0, precisionNeeds: 0, contextLengthRequirements: 4096, latencySensitivity: 0, costTolerance: 0, securityRequirements: 0, languageComplexity: 0, outputFormatConstraints: [] },
    reasoning: '',
  };
}

const PROVIDERS = ['openrouter', 'kilo-gateway', 'codik', 'ollama'] as const;

test('M1 free budget selects a FREE model and maps provider correctly', () => {
  const registry = makeRegistry();
  const selector = new ModelSelector(registry, { budget: 'free', preferredProvider: 'openrouter' });
  const sel = selector.select(classification('medium'), 'researcher', [...PROVIDERS]);
  expect(sel.provider === 'kilo-gateway', `free selection provider should map to kilo-gateway, got ${sel.provider}`);
  expect(sel.modelId === 'sel-free-kilo', `free selection model should be the best free researcher model, got ${sel.modelId}`);
  expect(sel.costTier === 'free', `free budget must yield a free costTier, got ${sel.costTier}`);
  expect(sel.maxTokens === 4096, `maxTokens should be capped at 4096, got ${sel.maxTokens}`);
  expect(Array.isArray(sel.fallbackChain), 'selection should include a fallbackChain array');
});

test('M2 high budget may select a PAID best model', () => {
  const registry = makeRegistry();
  const selector = new ModelSelector(registry, { budget: 'high', preferredProvider: 'openrouter' });
  const sel = selector.select(classification('medium'), 'researcher', [...PROVIDERS]);
  expect(sel.modelId === 'sel-paid-openai', `high budget should pick the best (paid) model, got ${sel.modelId}`);
  expect(sel.costTier === 'premium', `a Paid model should map to premium costTier, got ${sel.costTier}`);
});

test('M3 fallback chain excludes primary, skips non-free on free budget, respects depth', () => {
  const registry = makeRegistry();
  const selector = new ModelSelector(registry, { budget: 'free', preferredProvider: 'openrouter', maxFallbackDepth: 2 });
  const sel = selector.select(classification('medium'), 'researcher', [...PROVIDERS]);
  expect(sel.fallbackChain.length <= 2, `fallback chain must respect maxFallbackDepth (2), got ${sel.fallbackChain.length}`);
  const containsPrimary = sel.fallbackChain.some((c) => c.modelId === sel.modelId);
  expect(!containsPrimary, 'fallback chain must not include the primary model');
  const allFree = sel.fallbackChain.every((c) => c.costTier === 'free');
  expect(allFree, 'on free budget the fallback chain must contain only free models');
});

test('M4 estimated cost/savings are finite numbers', () => {
  const registry = makeRegistry();
  const selector = new ModelSelector(registry, { budget: 'free' });
  const sel = selector.select(classification('simple'), 'researcher', [...PROVIDERS]);
  expect(typeof sel.estimatedCost === 'number' && isFinite(sel.estimatedCost), 'estimatedCost must be a finite number');
  expect(typeof sel.estimatedSavings === 'number' && isFinite(sel.estimatedSavings), 'estimatedSavings must be a finite number');
});

test('M5 updateConfig switches budget and changes selection', () => {
  const registry = makeRegistry();
  const selector = new ModelSelector(registry, { budget: 'free' });
  const freeSel = selector.select(classification('medium'), 'researcher', [...PROVIDERS]);
  expect(freeSel.modelId === 'sel-free-kilo', 'initial free selection should be the free model');
  selector.updateConfig({ budget: 'high' });
  const highSel = selector.select(classification('medium'), 'researcher', [...PROVIDERS]);
  expect(highSel.modelId === 'sel-paid-openai', 'after switching to high budget, paid model should be selected');
});
