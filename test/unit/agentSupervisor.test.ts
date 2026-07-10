import * as path from 'path';
import { test, expect, afterEach, vi, describe } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { PhaseEngine } from '../../src/core/PhaseEngine';
import { AgentSupervisor } from '../../src/core/AgentSupervisor';
import type { HandoffContract, ContextPacket } from '../../shared/types';

const repoRoot = path.resolve(__dirname, '..', '..');

function makeContract(subtaskId: string, dependsOn: string[] = []): HandoffContract {
  return {
    subtaskId,
    agentRole: 'coder' as any,
    description: `Task ${subtaskId}`,
    successCriteria: [],
    artifactTargets: [],
    contextPacket: {} as ContextPacket,
    dependsOn,
  };
}

describe('AgentSupervisor', () => {
  test('analyzeTasks returns TaskDependency[] with canRunInParallel', () => {
    const bus = new EventBus();
    const phaseEngine = new PhaseEngine(bus);
    const supervisor = new AgentSupervisor(bus, phaseEngine);
    const contracts = [
      makeContract('a'),
      makeContract('b', ['a']),
      makeContract('c'),
    ];
    const deps = supervisor.analyzeTasks(contracts);
    expect(Array.isArray(deps), 'analyzeTasks should return array');
    expect(deps.length === 3, 'should have 3 dependencies');

    const a = deps.find(d => d.subtaskId === 'a');
    expect(a!.canRunInParallel === true, 'a with no deps should run in parallel');
    expect(a!.dependsOn.length === 0, 'a should have no deps');

    const b = deps.find(d => d.subtaskId === 'b');
    expect(b!.canRunInParallel === false, 'b with deps should not run in parallel');
    expect(b!.dependsOn[0] === 'a', 'b should depend on a');

    const c = deps.find(d => d.subtaskId === 'c');
    expect(c!.canRunInParallel === true, 'c with no deps should run in parallel');
  });

  test('analyzeTasks filters invalid dependencies', () => {
    const bus = new EventBus();
    const phaseEngine = new PhaseEngine(bus);
    const supervisor = new AgentSupervisor(bus, phaseEngine);
    const contracts = [
      makeContract('a'),
      makeContract('b', ['nonexistent']),
    ];
    const deps = supervisor.analyzeTasks(contracts);
    const b = deps.find(d => d.subtaskId === 'b');
    expect(b!.dependsOn.length === 0, 'invalid deps should be filtered out');
    expect(b!.canRunInParallel === true, 'should run in parallel with no valid deps');
  });

  test('getSystemState returns Record<AgentRole, AgentStatus> with initial idle states', () => {
    const bus = new EventBus();
    const phaseEngine = new PhaseEngine(bus);
    const supervisor = new AgentSupervisor(bus, phaseEngine);
    const state = supervisor.getSystemState();
    expect(typeof state === 'object', 'getSystemState should return object');
    expect(state.orchestrator === 'idle', 'orchestrator should be idle initially');
    expect(state.coder === 'idle', 'coder should be idle initially');
  });

  test('getSystemState contains all agent roles', () => {
    const bus = new EventBus();
    const phaseEngine = new PhaseEngine(bus);
    const supervisor = new AgentSupervisor(bus, phaseEngine);
    const state = supervisor.getSystemState();
    const expectedRoles = ['orchestrator', 'clarifier', 'researcher', 'planner', 'coder', 'auditor', 'security', 'verifier'];
    for (const role of expectedRoles) {
      expect(state[role] !== undefined, `${role} should be in system state`);
    }
  });
});
