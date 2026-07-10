import { test, expect } from '../harness';
import { EventBus } from '../../src/core/EventBus';
import { RouterHealthMonitor } from '../../src/core/RouterHealthMonitor';

function makeMonitor(overrides?: any): { bus: EventBus; mon: RouterHealthMonitor } {
  const bus = new EventBus();
  const mon = new RouterHealthMonitor(bus, overrides);
  return { bus, mon };
}

// H1: circuit breaker opens after failureThreshold consecutive failures.
test('H1 circuit breaker opens after failureThreshold failures', () => {
  const { mon } = makeMonitor({ failureThreshold: 3 });
  const p: any = 'openrouter';
  const m = 'meta-llama/llama-3.2-3b-instruct:free';
  expect(mon.canAttempt(p, m) === true, 'healthy provider should be attemptable');
  mon.recordFailure(p, m, 'boom1');
  mon.recordFailure(p, m, 'boom2');
  expect(mon.canAttempt(p, m) === true, 'still attemptable before threshold');
  mon.recordFailure(p, m, 'boom3');
  const status = mon.getStatus(p, m);
  expect(status.healthy === false, 'provider must be unhealthy after threshold');
  expect(status.consecutiveFailures >= 3, 'consecutiveFailures must reach threshold');
});

// H2: half-open state allows exactly halfOpenMaxCalls after opening, then blocks.
test('H2 half-open allows limited recovery calls then blocks', () => {
  const { mon } = makeMonitor({ failureThreshold: 2, halfOpenMaxCalls: 1 });
  const p: any = 'kilo-gateway';
  const m = 'stepfun/step-3.7-flash:free';
  mon.recordFailure(p, m, 'x');
  mon.recordFailure(p, m, 'x');
  expect(mon.canAttempt(p, m) === true, 'first half-open attempt allowed');
  expect(mon.canAttempt(p, m) === false, 'second attempt blocked while still unhealthy');
  // A success resets the breaker.
  mon.recordSuccess(p, m, 50);
  expect(mon.canAttempt(p, m) === true, 'healthy again after success');
});

// H3: rate-limit window blocks canAttempt and is reflected in getHealthyProviders.
test('H3 rate-limit blocks attempts and removes provider from healthy list', () => {
  const { mon } = makeMonitor();
  const p: any = 'openrouter';
  const m = 'm';
  mon.recordRateLimit(p, m, 60000);
  expect(mon.canAttempt(p, m) === false, 'rate-limited provider must not be attemptable');
  mon.recordSuccess(p, m, 10); // success does not clear rateLimitUntil
  expect(mon.canAttempt(p, m) === false, 'rate-limit persists despite a success');
  const healthy = mon.getHealthyProviders();
  expect(!healthy.includes(p), 'rate-limited provider excluded from healthy providers');
});

// H4: getStatus lazily creates a healthy default status.
test('H4 getStatus returns a healthy default for unseen provider/model', () => {
  const { mon } = makeMonitor();
  const s = mon.getStatus('codik' as any, 'codik-free');
  expect(s.healthy === true, 'default status healthy');
  expect(s.successRate === 1, 'default successRate 1');
});

// H5: reset clears state.
test('H5 reset clears recorded failures', () => {
  const { mon } = makeMonitor({ failureThreshold: 1 });
  mon.recordFailure('ollama' as any, 'llama3.2', 'x');
  mon.reset('ollama' as any, 'llama3.2');
  const s = mon.getStatus('ollama' as any, 'llama3.2');
  expect(s.healthy === true, 'status healthy after reset');
  expect(s.consecutiveFailures === 0, 'failures cleared after reset');
});
