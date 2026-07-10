import type {
  ContextPacket,
  ExecutionPlan,
  WorkspaceSnapshot,
  ClarifyingQuestion,
  ClarifyingAnswer,
} from '../../shared/types';
import type { PipelineContext } from './types';

/** Minimal plan for tiers that skip the planning phase. */
export function createFastTrackPlan(
  taskId: string,
  rawGoal: string,
  refinedGoal: string,
  workspace: WorkspaceSnapshot
): ExecutionPlan {
  const slug =
    rawGoal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'task';
  return {
    planId: `plan_${taskId}`,
    stack: workspace.techStack ?? [],
    architecture: 'Direct fast-track build (no planning phase)',
    subtasks: [
      {
        subtaskId: `code_${taskId}`,
        agentRole: 'coder',
        successCriteria: ['Code generated for the goal'],
        artifactTargets: [{ filePath: `src/${slug}.ts`, contentType: 'code' }],
        contextPacket: { taskId, goal: refinedGoal, workspaceSnapshot: workspace },
      },
    ],
    estimatedDuration: 0,
    totalSubtasks: 1,
  };
}

export function compassQuestionsFromClarifications(
  questions: ClarifyingQuestion[],
  answers: ClarifyingAnswer[]
): { question: string; answer?: string }[] {
  return questions.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return {
      question: q.question,
      answer: answer ? answer.customText || answer.selectedOption : undefined,
    };
  });
}

/** Build the context packet passed to coders and downstream agents. */
export function buildContextPacket(ctx: PipelineContext): ContextPacket {
  const plan = ctx.plan!;
  const researchReport = ctx.researchReport;
  return {
    taskId: ctx.taskId,
    goal: ctx.refinedGoal,
    workspaceSnapshot: ctx.workspace,
    planSummary: plan.architecture,
    researchSummary: researchReport?.summary,
    researchReport,
    agentsMd: ctx.projectDocs?.agentsMd,
    omniMd: ctx.projectDocs?.omniMd,
    plannedStack:
      plan && Array.isArray(plan.stack) && plan.stack.length ? plan.stack : undefined,
  };
}

export function emptyExecutionPlan(taskId: string): ExecutionPlan {
  return {
    planId: `plan_${taskId}`,
    stack: [],
    architecture: 'Unparsed plan',
    subtasks: [],
    estimatedDuration: 0,
    totalSubtasks: 0,
  };
}
