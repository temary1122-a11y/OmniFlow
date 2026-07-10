import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { test, expect, afterEach, vi } from '../harness';
import { EventBus, WebviewBridge } from '../../src/core/EventBus';

const dirs: string[] = [];
function tmp(): string { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-orch-')); dirs.push(d); return d; }
afterEach(() => { for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} } dirs.length = 0; });

test('EB1 new EventBus() constructs without arguments', () => {
  const bus = new EventBus();
  expect(bus !== undefined, 'EventBus should construct');
});

test('EB2 emit records into getLedgerEntries', () => {
  const bus = new EventBus();
  bus.emit({ type: 'PHASE_TRANSITION', payload: { from: 'intake', to: 'research', timestamp: 10 } });
  const entries = bus.getLedgerEntries();
  expect(entries.length === 1, 'one ledger entry should exist');
  expect(entries[0].type === 'phase_transition', 'event type should be mapped');
  expect(entries[0].data.from === 'intake', 'payload should be stored under data');
});

test('EB3 multiple emits accumulate', () => {
  const bus = new EventBus();
  bus.emit({ type: 'ARTIFACT_CREATED', payload: { filePath: 'a.txt', agentId: 'a', taskId: '1' } });
  bus.emit({ type: 'ERROR_OCCURRED', payload: { error: 'oops', phase: 'build', recoverable: true } });
  expect(bus.getLedgerEntries().length === 2, 'two events should accumulate');
});

test('EB4 setWebviewBridge accepts a fake bridge', () => {
  const bus = new EventBus();
  const send = vi.fn();
  const bridge: WebviewBridge = { send };
  bus.setWebviewBridge(bridge);
  expect(true, 'setWebviewBridge should not throw');
});

test('EB5 emit after bridge set calls bridge.send', () => {
  const bus = new EventBus();
  const send = vi.fn();
  const bridge: WebviewBridge = { send };
  bus.setWebviewBridge(bridge);
  const event = { type: 'PHASE_TRANSITION' as const, payload: { from: 'intake', to: 'planning', timestamp: 1 } };
  bus.emit(event);
  expect(send.mock.calls.length === 1, 'bridge.send should be invoked once');
  expect(send.mock.calls[0][0] === event, 'bridge.send should receive the same event object');
});

test('EB6 mapEventType falls back to phase_transition for unknown types', () => {
  const bus = new EventBus();
  bus.emit({ type: 'UNKNOWN_EVENT', payload: {} });
  const entries = bus.getLedgerEntries();
  expect(entries.length === 1, 'unknown event should still be recorded');
  expect(entries[0].type === 'phase_transition', 'unknown type should default to phase_transition');
});

test('EB7 on registers subscriber and emit invokes it', () => {
  const bus = new EventBus();
  const handler = vi.fn();
  bus.on('PHASE_TRANSITION', handler);
  bus.emit({ type: 'PHASE_TRANSITION', payload: { from: 'a', to: 'b', timestamp: 1 } });
  expect(handler.mock.calls.length === 1, 'handler should be called');
});

test('EB8 unregister removes subscriber', () => {
  const bus = new EventBus();
  const handler = vi.fn();
  const off = bus.on('PHASE_TRANSITION', handler);
  off();
  bus.emit({ type: 'PHASE_TRANSITION', payload: { from: 'a', to: 'b', timestamp: 1 } });
  expect(handler.mock.calls.length === 0, 'unregistered handler should not be called');
});
