// Bridge module: the existing test files call `test(name, fn)` and
// `expect(cond, msg)`. We re-export vitest's `test` so vitest collects
// and runs them, and provide a small boolean `expect` shim that throws a
// descriptive Error on failure (what vitest reports as a failed assertion).
//
// All state isolation (restoreMocks, beforeEach/afterEach, vi) is delegated
// to vitest — see vitest.config.ts (restoreMocks: true). Tests that need
// per-test temp-dir cleanup register an `afterEach` here.
import { test as vitestTest, it, describe, beforeEach, afterEach, vi } from 'vitest';

/** Registers a test with vitest. Signature identical to the old harness. */
export const test = vitestTest;

/**
 * Boolean assertion shim. `expect(cond, msg)` throws if `cond` is falsy.
 * This matches the existing test source; vitest catches the Error and reports
 * the test as failed with `msg`.
 */
export function expect(cond: unknown, msg: string): void {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

export { it, describe, beforeEach, afterEach, vi };
