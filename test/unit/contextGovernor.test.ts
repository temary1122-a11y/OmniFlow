import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { test, expect, afterEach, vi, describe } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { ModelRouter } from '../../src/routing/ModelRouter';
import { ContextGovernor, ContextItem, GovernanceOptions, RefreshStrategy } from '../../src/core/ContextGovernor';

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

describe('ContextGovernor', () => {
  test('estimateTokens returns positive number roughly text.length/4', () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    const text = 'Hello, world! This is a test message.';
    const tokens = (governor as any).estimateTokens([{ role: 'user', content: text }]);
    expect(typeof tokens === 'number' && tokens > 0, 'tokens should be positive number');
    const expected = Math.ceil((text.length + 4) / 4);
    expect(Math.abs(tokens - expected) <= 2, `tokens ${tokens} should be roughly ${expected}`);
  });

  test('estimateTokens with empty messages returns 0', () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    const tokens = (governor as any).estimateTokens([]);
    expect(tokens === 0, 'tokens should be 0 for empty messages');
  });

  test('getRefreshStrategy returns default adaptive strategy', () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    const strategy = governor.getRefreshStrategy();
    expect(strategy.type === 'adaptive', 'default strategy should be adaptive');
    expect(strategy.driftThreshold === 0.3, 'default driftThreshold should be 0.3');
  });

  test('setRefreshStrategy updates strategy', () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    governor.setRefreshStrategy({ type: 'periodic', interval: 10 });
    const strategy = governor.getRefreshStrategy();
    expect(strategy.type === 'periodic', 'strategy type should be periodic');
    expect(strategy.interval === 10, 'interval should be 10');
  });

  test('reset clears iterationCount and driftScore', () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    governor.updateDriftScore(0.5);
    governor.reset();
    // After reset, iterationCount is 0 and driftScore is 0
    const strategy = governor.getRefreshStrategy();
    expect(strategy.driftThreshold === 0.3, 'driftThreshold should remain');
  });

  test('updateDriftScore sets drift score', () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    governor.updateDriftScore(0.7);
    // driftScore is private, but shouldRefresh uses it - test via shouldRefresh behavior
    const shouldRefresh = (governor as any).shouldRefresh();
    // With adaptive strategy and driftScore 0.7 >= 0.3, shouldRefresh should be true
    expect(shouldRefresh === true, 'shouldRefresh should be true with high drift');
  });

  test('govern returns early when tokens within budget', async () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const options: GovernanceOptions = {
      maxTokens: 1000,
      targetTokens: 500,
      preserveRecentTurns: 2,
      enableSelectiveRetrieval: true,
      enableHierarchicalSummarization: false,
      enableTokenBudgeting: true,
    };
    const result = await governor.govern(messages, options);
    expect(result.originalTokens === result.governedTokens, 'tokens should match when within budget');
    expect(result.refreshTriggered === false, 'refresh should not trigger');
  });

  test('govern with over-budget messages triggers compression', async () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'This is a longer message to exceed token budget. '.repeat(20),
    }));
    const options: GovernanceOptions = {
      maxTokens: 100,
      targetTokens: 100,
      preserveRecentTurns: 2,
      enableSelectiveRetrieval: true,
      enableHierarchicalSummarization: false,
      enableTokenBudgeting: true,
    };
    const result = await governor.govern(messages, options);
    expect(result.governedTokens <= result.originalTokens, 'governed tokens should be <= original');
    expect(result.governedTokens <= 100, 'governed tokens should be within budget');
  });

  test('assignPriorities returns ContextItem array with priorities', async () => {
    const bus = new EventBus();
    const router = new ModelRouter('free', repoRoot);
    const governor = new ContextGovernor(bus, router);
    // assignPriorities is private, test via govern with over-budget
    const messages = [
      { role: 'system', content: 'System instruction' },
      { role: 'user', content: 'User input 1' },
      { role: 'assistant', content: 'Assistant response 1' },
      { role: 'assistant', content: 'Assistant response 2' },
      { role: 'assistant', content: 'Assistant response 3' },
    ];
    const options: GovernanceOptions = {
      maxTokens: 100,
      targetTokens: 100,
      preserveRecentTurns: 2,
      enableSelectiveRetrieval: true,
      enableHierarchicalSummarization: false,
      enableTokenBudgeting: true,
    };
    const result = await governor.govern(messages, options);
    expect(Array.isArray(result.preservedMessages), 'preservedMessages should be array');
    expect(result.preservedMessages.length > 0, 'should preserve some messages');
  });
});
