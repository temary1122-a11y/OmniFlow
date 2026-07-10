import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AgentRuntime } from '../../../src/core/AgentRuntime';
import type { MemoryFacade } from '../../../src/memory/MemoryFacade';
import { ToolRegistry } from '../../../src/core/ToolRegistry';
import { createMemoryTools } from '../../../src/core/ToolRegistry';
import type { ToolDefinition } from '../../../src/core/ToolRegistry';
import { EventBus } from '../../../src/core/EventBus';
import { ModelRouter } from '../../../src/routing/ModelRouter';

describe('AgentRuntime contract (CoderAgent -> AgentRuntime)', () => {
  let eventBus: EventBus;
  let modelRouter: ModelRouter;
  let memory: MemoryFacade;
  let toolRegistry: ToolRegistry;
  let runtime: AgentRuntime;

  beforeEach(() => {
    eventBus = new EventBus();
    modelRouter = {} as ModelRouter;
    memory = {
      selectiveRetrieve: vi.fn(),
      findBestSkill: vi.fn(),
      semanticSearch: vi.fn(),
      buildMemoryContextBlock: vi.fn(),
      recordEpisode: vi.fn(),
    } as unknown as MemoryFacade;
    // Create a tool registry and populate it with memory tools
    toolRegistry = new ToolRegistry(eventBus);
    const memTools = createMemoryTools(memory);
    memTools.tools.forEach((tool) => {
      toolRegistry.register(tool, tool, memTools.executors[tool.name]);
    });
    // Also add a dummy tool to have something else
    const dummyTool: ToolDefinition = {
      name: 'dummy',
      description: 'dummy tool',
      inputSchema: { type: 'object', properties: {}, required: [] },
    };
    toolRegistry.register(dummyTool, dummyTool, async () => ({ success: true, output: null, durationMs: 0 }));

    runtime = new AgentRuntime(eventBus, modelRouter, toolRegistry, {
      agentId: 'coder',
      tools: [], // tools are already registered in the registry
      systemPrompt: 'test',
      memory, // pass the memory
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('provides memory via options.memory', () => {
    expect(runtime.memory).toBe(memory);
  });

  it('provides recall_skill and semantic_search tools in the toolRegistry when memory tools are registered', () => {
    const toolNames = runtime.toolRegistry.list().map((t) => t.name);
    expect(toolNames).toContain('recall_skill');
    expect(toolNames).toContain('semantic_search');
    // Also check that we have the dummy tool
    expect(toolNames).toContain('dummy');
  });

  it('does not have memory when not provided', () => {
    const runtimeNoMem = new AgentRuntime(eventBus, modelRouter, toolRegistry, {
      agentId: 'coder',
      tools: [],
      systemPrompt: 'test',
      memory: undefined, // explicitly undefined
    });
    expect(runtimeNoMem.memory).toBeNull();
  });

  it('does not have recall_skill and semantic_search tools if memory tools are not registered', () => {
    const toolRegistryNoMem = new ToolRegistry(eventBus);
    // Only add dummy tool
    const dummyTool: ToolDefinition = {
      name: 'dummy',
      description: 'dummy tool',
      inputSchema: { type: 'object', properties: {}, required: [] },
    };
    toolRegistryNoMem.register(dummyTool, dummyTool, async () => ({ success: true, output: null, durationMs: 0 }));

    const runtimeNoMemTools = new AgentRuntime(eventBus, modelRouter, toolRegistryNoMem, {
      agentId: 'coder',
      tools: [],
      systemPrompt: 'test',
      memory, // memory is provided but tools are not registered
    });

    const toolNames = runtimeNoMemTools.toolRegistry.list().map((t) => t.name);
    expect(toolNames).not.toContain('recall_skill');
    expect(toolNames).not.toContain('semantic_search');
    expect(toolNames).toContain('dummy');
  });
});