import { test, expect, afterEach } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { PhaseEngine } from '../../src/core/PhaseEngine';

test('PE1 constructor accepts EventBus', () => {
  const engine = new PhaseEngine(new EventBus());
  expect(engine.getCurrentPhase() === 'intake', 'initial phase should be intake');
});

test('PE2 getPhaseOrder returns canonical ordered phases', () => {
  const engine = new PhaseEngine(new EventBus());
  const order = engine.getPhaseOrder();
  expect(order[0] === 'intake', 'first phase should be intake');
  expect(order[order.length - 1] === 'deliver', 'last phase should be deliver');
});

test('PE3 getCurrentPhase returns current phase string', () => {
  const engine = new PhaseEngine(new EventBus());
  expect(engine.getCurrentPhase() === 'intake', 'initial current phase should be intake');
});

test('PE4 getCompletedPhases returns empty array initially', () => {
  const engine = new PhaseEngine(new EventBus());
  const completed = engine.getCompletedPhases();
  expect(completed.length === 0, 'no completed phases at start');
});

test('PE5 transitionTo advances current phase and records previous in completed', () => {
  const engine = new PhaseEngine(new EventBus());
  engine.transitionTo('research');
  expect(engine.getCurrentPhase() === 'research', 'current phase should be research');
  const completed = engine.getCompletedPhases();
  expect(completed.includes('intake'), 'intake should be in completed');
  expect(completed.includes('research') === false, 'current phase should not be in completed');
});

test('PE6 transitionTo emits PHASE_TRANSITION event', () => {
  const bus = new EventBus();
  const engine = new PhaseEngine(bus);
  const entries: any[] = [];
  bus.on('PHASE_TRANSITION', (e) => entries.push(e.payload));
  engine.transitionTo('planning');
  expect(entries.length === 1, 'one transition event should be emitted');
  expect(entries[0].to === 'planning', 'event payload should contain target phase');
});

test('PE7 reset returns to initial state', () => {
  const engine = new PhaseEngine(new EventBus());
  engine.transitionTo('build');
  engine.transitionTo('verify');
  engine.reset();
  expect(engine.getCurrentPhase() === 'intake', 'reset should return to intake');
  expect(engine.getCompletedPhases().length === 0, 'reset should clear completed');
});

test('PE8 transitionTo same phase does not re-record completed', () => {
  const engine = new PhaseEngine(new EventBus());
  engine.transitionTo('research');
  const before = engine.getCompletedPhases().length;
  engine.transitionTo('research');
  const after = engine.getCompletedPhases().length;
  expect(after === before, 'transitioning to same phase should not change completed count');
});
