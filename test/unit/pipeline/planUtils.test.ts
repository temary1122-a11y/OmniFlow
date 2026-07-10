import { describe, expect, it } from 'vitest';
import { createFastTrackPlan, buildContextPacket, compassQuestionsFromClarifications } from '../../../src/pipeline/planUtils';
import type { PipelineContext } from '../../../src/pipeline/types';

function baseCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    taskId: 't1',
    rawGoal: 'Build API',
    refinedGoal: 'Build REST API',
    workspace: { fileTree: [], hasPackageJson: true, hasReadme: false, techStack: ['TypeScript'] },
    goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
    tier: 'LOW',
    phases: ['build'],
    questions: [],
    answers: [],
    artifacts: [],
    ...overrides,
  };
}

describe('createFastTrackPlan', () => {
  it('creates a single coder subtask with slugged path', () => {
    const plan = createFastTrackPlan('t1', 'Build Todo App!', 'Build Todo App', baseCtx().workspace);
    expect(plan.subtasks).toHaveLength(1);
    expect(plan.subtasks[0].artifactTargets?.[0]?.filePath).toMatch(/^src\/build-todo-app/);
    expect(plan.architecture).toContain('fast-track');
  });
});

describe('buildContextPacket', () => {
  it('includes plan and research in context packet', () => {
    const ctx = baseCtx({
      plan: createFastTrackPlan('t1', 'g', 'g', baseCtx().workspace),
      researchReport: {
        taskId: 't1',
        summary: 'research done',
        terms: [],
        bestPractices: [],
        patterns: [],
        sources: [],
      },
    });
    const packet = buildContextPacket(ctx);
    expect(packet.goal).toBe('Build REST API');
    expect(packet.planSummary).toContain('fast-track');
    expect(packet.researchSummary).toBe('research done');
  });
});

describe('compassQuestionsFromClarifications', () => {
  it('maps answers to compass question rows', () => {
    const rows = compassQuestionsFromClarifications(
      [{ id: 'q1', question: 'DB?', options: ['pg'], required: true }],
      [{ questionId: 'q1', selectedOption: 'pg' }]
    );
    expect(rows[0].answer).toBe('pg');
  });
});
