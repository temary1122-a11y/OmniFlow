import type { ResearchReport } from '../../shared/types';

/**
 * Split a goal into independent research facets for parallel research.
 * Returns the original goal unchanged when there are no clear facets.
 */
export function splitGoalIntoAspects(goal: string): string[] {
  const parts = goal
    .split(/\n|;| and /i)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);
  const unique = Array.from(new Set(parts));
  if (unique.length <= 1) return [goal];
  return unique.slice(0, 3);
}

/** Merge several ResearchReports into a single consolidated report. */
export function mergeResearchReports(
  taskId: string,
  goal: string,
  reports: ResearchReport[]
): ResearchReport {
  if (reports.length === 0) {
    return {
      taskId,
      summary: `Research for ${goal.slice(0, 100)}`,
      terms: [],
      bestPractices: [],
      patterns: [],
      sources: [],
    };
  }
  const summary = reports.map((r) => r.summary).filter(Boolean).join(' ');
  const terms = Array.from(new Set(reports.flatMap((r) => r.terms ?? [])));
  const bestPractices = Array.from(new Set(reports.flatMap((r) => r.bestPractices ?? [])));
  const patterns = Array.from(new Set(reports.flatMap((r) => r.patterns ?? [])));
  const sources = Array.from(new Set(reports.flatMap((r) => r.sources ?? [])));
  return {
    taskId,
    summary: summary || `Research for ${goal.slice(0, 100)}`,
    terms,
    bestPractices,
    patterns,
    sources,
  };
}
