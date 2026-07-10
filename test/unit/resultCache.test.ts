import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { test, expect, afterEach, vi, describe } from '../harness';
import { ResultCache } from '../../src/core/ResultCache';

const dirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-orch-'));
  dirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
  dirs.length = 0;
});

describe('ResultCache', () => {
  test('set then get returns the cached value', () => {
    const cache = new ResultCache();
    cache.set('toolA', { x: 1 }, 'result1');
    const val = cache.get('toolA', { x: 1 });
    expect(val === 'result1', 'get should return cached result');
  });

  test('get returns null for missing key', () => {
    const cache = new ResultCache();
    const val = cache.get('toolA', { x: 1 });
    expect(val === null, 'get should return null for missing key');
  });

  test('generateKey is deterministic: same input -> same key', () => {
    const cache = new ResultCache();
    const key1 = (cache as any).generateKey('toolA', { x: 1 });
    const key2 = (cache as any).generateKey('toolA', { x: 1 });
    expect(key1 === key2, 'same input should produce same key');
  });

  test('generateKey differs for different inputs', () => {
    const cache = new ResultCache();
    const key1 = (cache as any).generateKey('toolA', { x: 1 });
    const key2 = (cache as any).generateKey('toolA', { x: 2 });
    expect(key1 !== key2, 'different args should produce different keys');
  });

  test('generateArgsHash is deterministic', () => {
    const cache = new ResultCache();
    const hash1 = (cache as any).generateArgsHash({ x: 1 });
    const hash2 = (cache as any).generateArgsHash({ x: 1 });
    expect(hash1 === hash2, 'same args should produce same hash');
  });

  test('different args produce different hashes', () => {
    const cache = new ResultCache();
    const hash1 = (cache as any).generateArgsHash({ x: 1 });
    const hash2 = (cache as any).generateArgsHash({ x: 2 });
    expect(hash1 !== hash2, 'different args should produce different hashes');
  });

  test('invalidate removes cached entry', () => {
    const cache = new ResultCache();
    cache.set('toolA', { x: 1 }, 'result1');
    expect(cache.get('toolA', { x: 1 }) === 'result1', 'should be cached before invalidate');
    cache.invalidate('toolA', { x: 1 });
    expect(cache.get('toolA', { x: 1 }) === null, 'should be null after invalidate');
  });

  test('invalidate with toolName only clears all entries for that tool', () => {
    const cache = new ResultCache();
    cache.set('toolA', { x: 1 }, 'result1');
    cache.set('toolA', { x: 2 }, 'result2');
    cache.set('toolB', { x: 1 }, 'result3');
    cache.invalidate('toolA');
    expect(cache.get('toolA', { x: 1 }) === null, 'toolA entry should be cleared');
    expect(cache.get('toolA', { x: 2 }) === null, 'toolA entry 2 should be cleared');
    expect(cache.get('toolB', { x: 1 }) === 'result3', 'toolB entry should remain');
  });

  test('invalidate without args clears entire cache', () => {
    const cache = new ResultCache();
    cache.set('toolA', { x: 1 }, 'result1');
    cache.set('toolB', { x: 1 }, 'result2');
    cache.invalidate();
    expect(cache.get('toolA', { x: 1 }) === null, 'all entries should be cleared');
    expect(cache.get('toolB', { x: 1 }) === null, 'all entries should be cleared');
  });

  test('getSize returns number of entries', () => {
    const cache = new ResultCache();
    expect(cache.getSize() === 0, 'size should be 0 initially');
    cache.set('toolA', { x: 1 }, 'result1');
    expect(cache.getSize() === 1, 'size should be 1 after one set');
    cache.set('toolA', { x: 2 }, 'result2');
    expect(cache.getSize() === 2, 'size should be 2 after second set');
  });

  test('getStats returns stats object with hits/misses', () => {
    const cache = new ResultCache({ enableStats: true });
    cache.set('toolA', { x: 1 }, 'result1');
    cache.get('toolA', { x: 1 });
    cache.get('toolA', { x: 1 });
    cache.get('toolB', { x: 1 });
    const stats = cache.getStats();
    expect(stats.hits === 2, 'should have 2 hits');
    expect(stats.misses === 1, 'should have 1 miss');
    expect(stats.hitRate === 2 / 3, 'hitRate should be 2/3');
    expect(stats.totalEntries === 1, 'totalEntries should be 1');
  });

  test('pruneExpired removes expired entries', () => {
    vi.useFakeTimers();
    try {
      const cache = new ResultCache({ defaultTTL: 1000, enableStats: true });
      cache.set('toolA', { x: 1 }, 'result1');
      expect(cache.getSize() === 1, 'size should be 1');
      vi.advanceTimersByTime(1500);
      const pruned = cache.pruneExpired();
      expect(pruned === 1, 'should prune 1 expired entry');
      expect(cache.getSize() === 0, 'size should be 0 after prune');
    } finally {
      vi.useRealTimers();
    }
  });

  test('TTL expiry: get returns null after TTL', () => {
    vi.useFakeTimers();
    try {
      const cache = new ResultCache({ defaultTTL: 1000, enableStats: true });
      cache.set('toolA', { x: 1 }, 'result1', 1000);
      expect(cache.get('toolA', { x: 1 }) === 'result1', 'should hit before expiry');
      vi.advanceTimersByTime(1500);
      expect(cache.get('toolA', { x: 1 }) === null, 'should miss after expiry');
    } finally {
      vi.useRealTimers();
    }
  });

  test('invalidateByFile removes entries matching file path', () => {
    const cache = new ResultCache({ enableStats: true, enableFileInvalidation: true });
    cache.set('readFile', { path: '/project/src/index.ts' }, { path: '/project/src/index.ts', content: 'code1' });
    cache.set('readFile', { path: '/project/src/utils.ts' }, { path: '/project/src/utils.ts', content: 'code2' });
    cache.set('writeFile', { path: '/project/src/index.ts' }, { path: '/project/src/index.ts', success: true });
    cache.invalidateByFile('/project/src/index.ts');
    expect(cache.getSize() === 1, 'should have 1 remaining entry');
    expect(cache.get('writeFile', { path: '/project/src/index.ts' }) === null, 'writeFile entry should be removed');
    expect(cache.get('readFile', { path: '/project/src/utils.ts' }) !== null, 'utils entry should remain');
  });

  test('cache respects maxSize with LRU eviction', () => {
    const cache = new ResultCache({ maxSize: 2, enableStats: true });
    cache.set('toolA', { x: 1 }, 'result1');
    cache.set('toolA', { x: 2 }, 'result2');
    expect(cache.getSize() === 2, 'size should be 2');
    cache.set('toolA', { x: 3 }, 'result3');
    expect(cache.getSize() === 2, 'size should still be 2 after eviction');
    expect(cache.getStats().evictions >= 1, 'should have at least 1 eviction');
  });
});
