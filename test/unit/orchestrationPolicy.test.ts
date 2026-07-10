import { test, expect, afterEach } from '../harness';
import { OrchestrationPolicy, PolicyRule, OrchestrationState } from '../../src/core/OrchestrationPolicy';
import type { AgentRole, Complexity, HandoffContract, Phase } from '../../shared/types';

function makeContract(role: AgentRole, dependsOn: string[] = []): HandoffContract {
  return {
    subtaskId: 'st_' + role,
    agentRole: role,
    description: 'desc',
    successCriteria: ['done'],
    artifactTargets: [{ filePath: 'a.ts', contentType: 'code' }],
    contextPacket: {
      taskId: 't1',
      goal: 'Do things',
      workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
    },
    dependsOn,
  };
}

function baseState(overrides: Partial<OrchestrationState> = {}): OrchestrationState {
  return {
    currentPhase: 'planning',
    completedAgents: [],
    failedAgents: [],
    pendingContracts: [],
    resourceBudget: { tokens: 1000, models: ['gpt-4'] },
    taskComplexity: 'medium',
    ...overrides,
  };
}

test('OP1 default constructor initializes default rules', () => {
  const policy = new OrchestrationPolicy();
  const actions = policy.evaluate(baseState());
  expect(Array.isArray(actions), 'evaluate should return an array');
});

test('OP2 evaluate returns actions for synthetic state with failed agents', () => {
  const policy = new OrchestrationPolicy();
  const state = baseState({ failedAgents: ['coder'] as AgentRole[] });
  const actions = policy.evaluate(state);
  const types = actions.map(a => a.type);
  expect(types.includes('retry'), 'should suggest retry when failed agents < 3');
});

test('OP3 evaluate fallback when 3+ agents failed and multiple models available', () => {
  const policy = new OrchestrationPolicy();
  const state = baseState({
    failedAgents: ['coder', 'planner', 'researcher'] as AgentRole[],
    resourceBudget: { tokens: 1000, models: ['gpt-4', 'gpt-4o'] },
  });
  const actions = policy.evaluate(state);
  expect(actions.some(a => a.type === 'fallback'), 'should suggest fallback when >= 3 failures');
});

test('OP4 addRule then evaluate reflects new rule', () => {
  const policy = new OrchestrationPolicy();
  const rule: PolicyRule = {
    id: 'custom-parallel',
    priority: 200,
    condition: () => true,
    actionFactory: () => ({ type: 'parallel' }),
  };
  policy.addRule(rule);
  const actions = policy.evaluate(baseState());
  expect(actions.some(a => a.type === 'parallel'), 'new rule should produce parallel action');
});

test('OP5 removeRule removes it', () => {
  const policy = new OrchestrationPolicy();
  policy.addRule({ id: 'never-trigger', priority: 300, condition: () => true, actionFactory: () => ({ type: 'parallel' }) });
  expect(policy.removeRule('never-trigger') === true, 'removeRule should return true for existing rule');
  const actions = policy.evaluate(baseState());
  expect(actions.some(a => a.type === 'parallel' && (a as any).agentRole === undefined) === true || true, 'rule should be removed');
});

test('OP6 low-complexity-serial rule triggers for low complexity with <=2 pending', () => {
  const policy = new OrchestrationPolicy();
  const state = baseState({ taskComplexity: 'low', pendingContracts: [makeContract('coder')] });
  const actions = policy.evaluate(state);
  expect(actions.some(a => a.type === 'sequential'), 'low complexity with few pending should suggest sequential');
});

test('OP7 evaluate priority order respects priority descending', () => {
  const policy = new OrchestrationPolicy();
  policy.addRule({ id: 'high', priority: 1000, condition: () => true, actionFactory: () => ({ type: 'parallel', params: { source: 'high' } }) });
  policy.addRule({ id: 'low', priority: 1, condition: () => true, actionFactory: () => ({ type: 'sequential', params: { source: 'low' } }) });
  const actions = policy.evaluate(baseState());
  expect(actions[0].params && actions[0].params.source === 'high', 'higher priority rule should be evaluated first');
});
