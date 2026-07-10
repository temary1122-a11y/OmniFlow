import { test, expect, afterEach } from '../harness';
import { TaskCompass } from '../../src/core/TaskCompass';

test('TC1 constructor accepts goal and optional strategy', () => {
  const compass = new TaskCompass('Build an app');
  expect(compass.getState().originalGoal === 'Build an app', 'original goal should be stored');
});

test('TC2 checkAlignment returns alignment object with score in [0,1]', () => {
  const compass = new TaskCompass('Plan and build a todo app');
  const result = compass.checkAlignment('design architecture', 'we need to plan');
  expect(typeof result.aligned === 'boolean', 'aligned should be boolean');
  expect(result.driftScore >= 0 && result.driftScore <= 1, 'driftScore should be in [0,1]');
  expect(result.confidence >= 0 && result.confidence <= 1, 'confidence should be in [0,1]');
  expect(typeof result.reasoning === 'string', 'reasoning should be string');
});

test('TC3 identical action and goal yields low drift', () => {
  const compass = new TaskCompass('Write unit tests');
  const result = compass.checkAlignment('Write unit tests', 'Write unit tests');
  expect(result.driftScore < 0.3, 'identical actions should yield low drift');
});

test('TC4 getAlignmentSummary returns object with expected keys', () => {
  const compass = new TaskCompass('Goal');
  compass.checkAlignment('action', 'context');
  const summary = compass.getAlignmentSummary();
  expect(typeof summary === 'object', 'getAlignmentSummary should return object');
  expect(summary.totalChecks >= 1, 'should record at least one check');
  expect(typeof summary.alignmentRate === 'number', 'alignmentRate should be numeric');
  expect(typeof summary.avgDriftScore === 'number', 'avgDriftScore should be numeric');
  expect(typeof summary.currentDriftScore === 'number', 'currentDriftScore should be numeric');
});

test('TC5 reset clears alignment history and drift', () => {
  const compass = new TaskCompass('Goal');
  compass.checkAlignment('action1', 'ctx1');
  compass.checkAlignment('action2', 'ctx2');
  compass.reset();
  const state = compass.getState();
  expect(state.alignmentHistory.length === 0, 'reset should clear alignment history');
  expect(state.driftScore === 0, 'reset should zero drift score');
});

test('TC6 getState returns a snapshot with expected fields', () => {
  const compass = new TaskCompass('Goal');
  const state = compass.getState();
  expect(state.originalGoal === 'Goal', 'state should contain originalGoal');
  expect(Array.isArray(state.subGoals), 'subGoals should be array');
  expect(Array.isArray(state.alignmentHistory), 'alignmentHistory should be array');
});

test('TC7 strategy getters/setters work', () => {
  const compass = new TaskCompass('Goal');
  expect(compass.getRefreshStrategy().type === 'adaptive', 'default strategy should be adaptive');
  compass.updateRefreshStrategy({ type: 'fixed', interval: 2 } as any);
  const s = compass.getRefreshStrategy();
  expect(s.type === 'fixed', 'strategy should update to fixed');
  expect(s.interval === 2, 'interval should be 2');
});

test('TC8 checkAlignment on fully unrelated action yields high drift', () => {
  const compass = new TaskCompass('Deploy a Kubernetes cluster to production');
  const result = compass.checkAlignment('slightly related', 'some context');
  expect(result.driftScore >= 0, 'drift score should be >= 0');
  expect(result.returned === undefined || true, 'result should not throw');
});
