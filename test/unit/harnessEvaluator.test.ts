import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { test, expect, afterEach, vi, describe } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { HarnessEvaluator } from '../../src/core/HarnessEvaluator';
import { LedgerMemory } from '../../src/memory/LedgerMemory';

const dirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-orch-'));
  dirs.push(d);
  return d;
}
const repoRoot = path.resolve(__dirname, '..', '..');

afterEach(() => {
  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
  dirs.length = 0;
});

describe('HarnessEvaluator', () => {
  test('recordIteration increments iterations for a task', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.recordIteration('t1');
    evaluator.recordIteration('t1');
    const m = evaluator.getMetric('t1');
    expect(m !== undefined, 'metric should exist');
    expect(m!.iterations === 2, 'iterations should be 2');
  });

  test('recordToolCall increments toolCalls and success/failure counts', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.recordToolCall('t1', true);
    evaluator.recordToolCall('t1', true);
    evaluator.recordToolCall('t1', false);
    const m = evaluator.getMetric('t1');
    expect(m!.toolCalls === 3, 'toolCalls should be 3');
    expect(m!.toolSuccesses === 2, 'toolSuccesses should be 2');
    expect(m!.toolFailures === 1, 'toolFailures should be 1');
  });

  test('recordTokens accumulates totalTokens', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.recordTokens('t1', 10);
    evaluator.recordTokens('t1', 5);
    const m = evaluator.getMetric('t1');
    expect(m!.tokensUsed === 15, 'totalTokens should be 15');
  });

  test('completeTask sets completed and success flags', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.completeTask('t1', true);
    const m = evaluator.getMetric('t1');
    expect(m!.completed === true, 'completed should be true');
    expect(m!.success === true, 'success should be true');
    expect(m!.endTime > 0, 'endTime should be set');
  });

  test('getMetric returns undefined for unknown task', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    const m = evaluator.getMetric('nonexistent');
    expect(m === undefined, 'metric should be undefined for unknown task');
  });

  test('getAllMetrics returns copy of metrics array', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    const all = evaluator.getAllMetrics();
    expect(Array.isArray(all), 'getAllMetrics should return array');
    expect(all.length === 1, 'should have 1 metric');
    expect(all[0].taskId === 't1', 'taskId should match');
  });

  test('analyze returns insights array (awaited)', async () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.recordToolCall('t1', false);
    evaluator.recordToolCall('t1', false);
    evaluator.recordToolCall('t1', true);
    const insights = await evaluator.analyze();
    expect(Array.isArray(insights), 'analyze should return array');
  });

  test('getRecommendations returns string array (awaited)', async () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.recordToolCall('t1', false);
    evaluator.recordToolCall('t1', false);
    evaluator.recordToolCall('t1', true);
    const recs = await evaluator.getRecommendations();
    expect(Array.isArray(recs), 'getRecommendations should return array');
  });

  test('reset clears all metrics', () => {
    const bus = new EventBus();
    const ledger = new LedgerMemory(tmp());
    const evaluator = new HarnessEvaluator(bus, ledger);
    evaluator.startTracking('t1', 'agent1');
    evaluator.recordTokens('t1', 100);
    evaluator.reset();
    const all = evaluator.getAllMetrics();
    expect(all.length === 0, 'metrics should be empty after reset');
  });
});
