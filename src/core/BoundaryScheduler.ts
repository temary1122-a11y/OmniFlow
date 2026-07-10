import * as path from 'path';
import type { HandoffContract } from '../../shared/types';

/**
 * Boundary-aware parallel scheduler.
 *
 * Given a set of work items (each carrying an optional write-boundary and a
 * dependsOn list), it produces execution BATCHES. Items placed in the same
 * batch may run in parallel; consecutive batches run sequentially.
 *
 * Two items are kept out of the same parallel batch when:
 *   - their write-boundaries overlap (they could touch the same file), or
 *   - one depends on the other (dependsOn not yet satisfied).
 *
 * Items with no boundary are treated as fully isolated (never overlap), so they
 * can be freely parallelised. Enforcement of the boundary at write-time is a
 * separate concern handled in ToolRegistry / ClineAgentWrapper.
 */

export interface BoundaryItem {
  id: string;
  boundary?: string[];
  dependsOn?: string[];
}

function normalize(workspaceRoot: string, boundary?: string[]): string[] {
  if (!boundary || boundary.length === 0) return [];
  return boundary.map((b) => path.resolve(workspaceRoot, b));
}

/** True when two normalized boundary sets share a file or one contains the other. */
export function boundariesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  for (const x of a) {
    for (const y of b) {
      if (x === y) return true;
      if (x.startsWith(y + path.sep) || y.startsWith(x + path.sep)) return true;
    }
  }
  return false;
}

/**
 * Returns ordered batches of item ids. Each inner array is a set of items that
 * may execute concurrently. Batches are returned in dependency order.
 */
export function scheduleByBoundary(workspaceRoot: string, items: BoundaryItem[]): BoundaryItem[][] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const norm = new Map<string, string[]>();
  for (const i of items) norm.set(i.id, normalize(workspaceRoot, i.boundary));

  const done = new Set<string>();
  const remaining = [...items];
  const batches: BoundaryItem[][] = [];

  while (remaining.length > 0) {
    const batch: BoundaryItem[] = [];
    const batchBounds: string[][] = [];

    for (let k = remaining.length - 1; k >= 0; k--) {
      const it = remaining[k];
      const deps = (it.dependsOn ?? []).filter((d) => byId.has(d));
      if (deps.some((d) => !done.has(d))) continue; // dependency not satisfied yet
      const b = norm.get(it.id)!;
      if (batchBounds.some((bb) => boundariesOverlap(bb, b))) continue; // would conflict
      batch.push(it);
      batchBounds.push(b);
      remaining.splice(k, 1);
    }

    if (batch.length === 0) {
      // No progress possible without violating constraints — force the first
      // remaining item that has its dependencies satisfied, else any item.
      const idx =
        remaining.findIndex((i) => (i.dependsOn ?? []).every((d) => !byId.has(d) || done.has(d)));
      const take = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift()!;
      batch.push(take);
    }

    for (const it of batch) done.add(it.id);
    batches.push(batch);
  }

  return batches;
}

/** Convenience helper for HandoffContract lists. */
export function scheduleContracts(workspaceRoot: string, contracts: HandoffContract[]): HandoffContract[][] {
  const items: BoundaryItem[] = contracts.map((c) => ({
    id: c.subtaskId,
    boundary: c.boundary,
    dependsOn: c.dependsOn,
  }));
  const batches = scheduleByBoundary(workspaceRoot, items);
  const map = new Map(contracts.map((c) => [c.subtaskId, c]));
  return batches.map((b) => b.map((i) => map.get(i.id)!).filter(Boolean));
}
