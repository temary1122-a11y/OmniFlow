import { test, expect, afterEach } from '../harness';
import { buildCompassMarkdown } from '../../src/core/CompassArtifact';
import type { UserGoalPacket, ExecutionPlan, HandoffContract, ResearchReport, WorkspaceSnapshot } from '../../shared/types';

function makeGoal(taskId = '1'): UserGoalPacket {
  return {
    taskId,
    goal: 'Build a web API',
    intent: 'build',
    complexity: 'medium',
    workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] } as WorkspaceSnapshot,
    refinedGoal: 'Build a REST API with Node.js',
  };
}

function makePlan(): ExecutionPlan {
  const goal = 'Build a web API';
  return {
    planId: 'plan-1',
    stack: ['TypeScript', 'Express'],
    architecture: 'Monolithic',
    subtasks: [
      {
        subtaskId: 'st1',
        agentRole: 'coder',
        description: 'Implement API',
        successCriteria: ['All tests pass'],
        artifactTargets: [],
        contextPacket: {
          taskId: '1',
          goal,
          workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
        },
      },
      {
        subtaskId: 'st2',
        agentRole: 'verifier',
        description: 'Verify tests',
        successCriteria: ['Coverage > 80%'],
        artifactTargets: [],
        contextPacket: {
          taskId: '1',
          goal,
          workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
        },
      },
    ],
    estimatedDuration: 60,
    totalSubtasks: 2,
  };
}

function makeResearch(): ResearchReport {
  return {
    taskId: '1',
    summary: 'Research summary',
    terms: ['API'],
    bestPractices: ['Validate inputs'],
    patterns: ['REST'],
    sources: ['https://example.com'],
  };
}

test('CA1 returns markdown string containing goal and plan steps', () => {
  const md = buildCompassMarkdown(makeGoal(), makePlan());
  expect(typeof md === 'string', 'should return a string');
  expect(md.includes('# Compass'), 'should contain compass header');
  expect(md.includes('Build a REST API with Node.js'), 'should contain refined goal');
  expect(md.includes('All tests pass'), 'should contain acceptance criteria');
  expect(md.includes('Coverage > 80%'), 'should include verifier subtask criteria');
});

test('CA2 passes with empty/research and no questions', () => {
  const md = buildCompassMarkdown(makeGoal(), makePlan(), undefined, []);
  expect(typeof md === 'string', 'should not throw with no research and no questions');
});

test('CA3 questions included when provided', () => {
  const md = buildCompassMarkdown(makeGoal(), makePlan(), undefined, [
    { question: 'Which HTTP method?', answer: 'GET' },
    { question: 'Auth?', answer: 'JWT' },
  ]);
  expect(md.includes('Which HTTP method?'), 'should include question text');
  expect(md.includes('GET'), 'should include answer');
});

test('CA4 architecture and stack appear', () => {
  const md = buildCompassMarkdown(makeGoal(), makePlan());
  expect(md.includes('Monolithic'), 'should include architecture');
  expect(md.includes('TypeScript'), 'should include stack');
});
