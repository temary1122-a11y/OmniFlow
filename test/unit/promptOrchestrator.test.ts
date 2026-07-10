import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { test, expect, afterEach, vi, describe } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { PromptOrchestrator, SelfPromptingAgent } from '../../src/core/PromptOrchestrator';

const repoRoot = path.resolve(__dirname, '..', '..');

describe('PromptOrchestrator', () => {
  afterEach(() => {});

  test('registerAgent stores agent and getRegisteredAgents returns role', () => {
    const bus = new EventBus();
    const orchestrator = new PromptOrchestrator({ eventBus: bus, maxRounds: 3, convergenceThreshold: 0.8 });

    const mockAgent: SelfPromptingAgent = {
      agentId: 'researcher',
      generatePromptFor: async () => 'prompt',
      respondToPrompt: async () => ({ content: 'resp', confidence: 0.9, needsMoreInfo: false }),
      evaluateConversation: async () => 0.9,
    };

    orchestrator.registerAgent(mockAgent);
    const agents = orchestrator.getRegisteredAgents();
    expect(Array.isArray(agents), 'getRegisteredAgents should return array');
    expect(agents.length === 1 && agents[0] === 'researcher', 'registered agent should be researcher');
  });

  test('registerAgent with multiple agents returns all roles', () => {
    const bus = new EventBus();
    const orchestrator = new PromptOrchestrator({ eventBus: bus, maxRounds: 3, convergenceThreshold: 0.8 });

    const makeAgent = (id: string): SelfPromptingAgent => ({
      agentId: id,
      generatePromptFor: async () => 'prompt',
      respondToPrompt: async () => ({ content: 'resp', confidence: 0.9, needsMoreInfo: false }),
      evaluateConversation: async () => 0.9,
    });

    orchestrator.registerAgent(makeAgent('a'));
    orchestrator.registerAgent(makeAgent('b'));
    orchestrator.registerAgent(makeAgent('c'));

    const agents = orchestrator.getRegisteredAgents();
    expect(agents.length === 3, 'should have 3 agents');
    expect(agents.includes('a'), 'should include a');
    expect(agents.includes('b'), 'should include b');
    expect(agents.includes('c'), 'should include c');
  });

  test('getHistory returns empty array initially', () => {
    const bus = new EventBus();
    const orchestrator = new PromptOrchestrator({ eventBus: bus, maxRounds: 3, convergenceThreshold: 0.8 });
    const history = orchestrator.getHistory();
    expect(Array.isArray(history), 'history should be array');
    expect(history.length === 0, 'history should be empty initially');
  });

  test('clearHistory resets history to empty', () => {
    const bus = new EventBus();
    const orchestrator = new PromptOrchestrator({ eventBus: bus, maxRounds: 3, convergenceThreshold: 0.8 });
    orchestrator.clearHistory();
    const history = orchestrator.getHistory();
    expect(history.length === 0, 'history should be empty after clear');
  });
});
