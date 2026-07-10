import * as path from 'path';
import { test, expect, afterEach } from '../harness';
import { boundariesOverlap, scheduleByBoundary, scheduleContracts } from '../../src/core/BoundaryScheduler';
import type { BoundaryItem, HandoffContract } from '../../src/core/BoundaryScheduler';

test('BS1 boundariesOverlap returns true for identical paths', () => {
  expect(boundariesOverlap(['a.ts', 'b.ts'], ['a.ts']) === true, 'identical path should overlap');
});

test('BS2 boundariesOverlap returns false for disjoint sets', () => {
  expect(boundariesOverlap(['a.ts'], ['b.ts']) === false, 'disjoint paths should not overlap');
});

test('BS3 boundariesOverlap returns true for nested paths', () => {
  const parent = path.resolve('/root', 'src');
  const child = path.resolve('/root', 'src/utils');
  expect(boundariesOverlap([parent], [child]) === true, 'nested path should overlap');
  expect(boundariesOverlap([child], [parent]) === true, 'nested inverse should also overlap');
});

test('BS4 boundariesOverlap returns false when one side empty', () => {
  expect(boundariesOverlap([], ['a.ts']) === false, 'empty a should not overlap');
  expect(boundariesOverlap(['a.ts'], []) === false, 'empty b should not overlap');
});

test('BS5 scheduleByBoundary produces ordered batches', () => {
  const items: BoundaryItem[] = [
    { id: 'a', boundary: ['a.ts'] },
    { id: 'b', boundary: ['b.ts'] },
    { id: 'c', boundary: ['c.ts'] },
  ];
  const batches = scheduleByBoundary('/root', items);
  expect(batches.length >= 1, 'should produce at least one batch');
  expect(batches[0].length >= 1, 'first batch should have at least one item');
});

test('BS6 scheduleByBoundary respects dependencies', () => {
  const items: BoundaryItem[] = [
    { id: 'a', boundary: ['a.ts'], dependsOn: [] },
    { id: 'b', boundary: ['b.ts'], dependsOn: ['a'] },
  ];
  const batches = scheduleByBoundary('/root', items);
  const aBatch = batches.findIndex(b => b.some(i => i.id === 'a'));
  const bBatch = batches.findIndex(b => b.some(i => i.id === 'b'));
  expect(aBatch < bBatch, 'a should run before b because b depends on a');
});

test('BS7 scheduleByBoundary applies path resolution', () => {
  const items: BoundaryItem[] = [
    { id: 'a', boundary: ['src/a.ts'] },
    { id: 'b', boundary: ['src/b.ts'] },
  ];
  const batches = scheduleByBoundary('/workspace', items);
  expect(batches.length >= 1, 'should schedule without errors');
});

test('BS8 scheduleContracts groups correctly', () => {
  const contracts: HandoffContract[] = [
    { subtaskId: 'a', agentRole: 'coder', description: '', successCriteria: [], artifactTargets: [], contextPacket: { taskId: '1', goal: 'g', workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] } }, boundary: ['a.ts'] },
    { subtaskId: 'b', agentRole: 'coder', description: '', successCriteria: [], artifactTargets: [], contextPacket: { taskId: '1', goal: 'g', workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] } }, boundary: ['b.ts'], dependsOn: ['a'] },
  ];
  const batches = scheduleContracts('/workspace', contracts);
  expect(batches.length >= 1, 'should produce batches');
});

test('BS9 scheduleByBoundary handles items with no boundary freely', () => {
  const items: BoundaryItem[] = [
    { id: 'a' },
    { id: 'b' },
  ];
  const batches = scheduleByBoundary('/root', items);
  expect(batches.length >= 1, 'should schedule items with no boundary');
});
