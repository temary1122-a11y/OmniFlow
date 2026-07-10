import type { UserGoalPacket, ExecutionPlan, ResearchReport } from '../../shared/types';

export interface CompassQuestion {
  question: string;
  answer?: string;
}

/**
 * Builds the markdown "Compass" artifact — a project constitution that downstream
 * agents can ground their work in via explicit acceptance criteria.
 */
export function buildCompassMarkdown(
  goalPacket: UserGoalPacket,
  plan: ExecutionPlan,
  researchReport?: ResearchReport,
  questions: CompassQuestion[] = []
): string {
  const goal = goalPacket.refinedGoal ?? goalPacket.goal;

  const acceptanceCriteria: string[] = [];
  for (const subtask of plan.subtasks) {
    for (const criterion of subtask.successCriteria) {
      acceptanceCriteria.push(criterion);
    }
  }
  const verifierSubtask = plan.subtasks.find((s) => s.agentRole === 'verifier');
  if (verifierSubtask) {
    for (const criterion of verifierSubtask.successCriteria) {
      if (!acceptanceCriteria.includes(criterion)) {
        acceptanceCriteria.push(criterion);
      }
    }
  }

  const architectureAndStack = [
    `Architecture: ${plan.architecture || '(not specified)'}`,
    plan.stack && plan.stack.length
      ? `Stack: ${plan.stack.join(', ')}`
      : 'Stack: (not specified)',
  ].join('\n');

  const questionsBlock =
    questions.length > 0
      ? questions
          .map((q) => `- **Q:** ${q.question}${q.answer ? `\n  - **A:** ${q.answer}` : ''}`)
          .join('\n')
      : '(No clarifying questions were raised for this task.)';

  const constraints = [
    'DO NOT violate the tech stack / language choices listed in ## Architecture & Stack unless explicitly instructed.',
    'DO NOT introduce new dependencies or external services without updating the plan and acceptance criteria.',
    'DO NOT change public APIs or file paths assumed by other subtasks without coordinating through the orchestrator.',
    'DO NOT bypass the explicit acceptance criteria in this file — every deliverable must satisfy at least one listed criterion.',
  ].join('\n');

  return `# Compass

> This file is the project constitution for this task. Every downstream agent (coder, auditor, security, verifier)
> MUST justify its actions by referencing a specific section of this file.

## Goal

${goal}

## Acceptance Criteria

${acceptanceCriteria.length ? acceptanceCriteria.map((c) => `- ${c}`).join('\n') : '(No explicit acceptance criteria were provided.)'}

## Architecture & Stack

${architectureAndStack}

## Constraints (DO NOT)

${constraints}

## Agent Brief

You are a sub-agent working on a piece of this task. Before and while you act, ground your work in this Compass file:

1. Read ## Goal and ## Acceptance Criteria and ensure your work advances them.
2. Respect the stack and architecture in ## Architecture & Stack.
3. Honor every rule in ## Constraints (DO NOT).
4. When you report or hand off, cite the specific section (e.g. "satisfies ## Acceptance Criteria: <criterion>") that your work fulfills.

## Clarifying Questions

${questionsBlock}
`;
}
