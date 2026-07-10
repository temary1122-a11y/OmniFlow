import { describe, expect, it } from 'vitest';
import { mergeResearchReports, splitGoalIntoAspects } from '../../../src/pipeline/researchUtils';
import type { ResearchReport } from '../../../shared/types';

describe('splitGoalIntoAspects', () => {
  it('returns single goal when no clear facets', () => {
    expect(splitGoalIntoAspects('Build a todo app')).toEqual(['Build a todo app']);
  });

  it('splits on semicolons and newlines', () => {
    const aspects = splitGoalIntoAspects('Add auth; Add tests\nAdd docs');
    expect(aspects.length).toBeGreaterThan(1);
    expect(aspects.length).toBeLessThanOrEqual(3);
  });

  it('caps at three facets', () => {
    const aspects = splitGoalIntoAspects('one; two; three; four; five');
    expect(aspects).toHaveLength(3);
  });
});

describe('mergeResearchReports', () => {
  const base = (taskId: string, summary: string): ResearchReport => ({
    taskId,
    summary,
    terms: [summary],
    bestPractices: [`bp-${summary}`],
    patterns: [`pat-${summary}`],
    sources: [`src-${summary}`],
  });

  it('returns empty shell when no reports', () => {
    const merged = mergeResearchReports('t1', 'My goal', []);
    expect(merged.taskId).toBe('t1');
    expect(merged.summary).toContain('My goal');
    expect(merged.terms).toEqual([]);
  });

  it('deduplicates terms and merges summaries', () => {
    const merged = mergeResearchReports('t1', 'goal', [
      base('t1', 'alpha'),
      base('t1', 'beta'),
      { ...base('t1', 'alpha'), terms: ['alpha'] },
    ]);
    expect(merged.summary).toContain('alpha');
    expect(merged.summary).toContain('beta');
    expect(merged.terms).toEqual(['alpha', 'beta']);
    expect(merged.sources).toHaveLength(2);
  });
});
