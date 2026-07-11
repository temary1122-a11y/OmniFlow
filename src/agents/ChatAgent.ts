import { ModelRouter } from '../routing/ModelRouter';
import { AgentRuntime } from '../core/AgentRuntime';
import {
  ToolRegistry,
  createDefaultTools,
  createCodeSearchTools,
  createMemoryTools,
  createHelpTools,
  createConsultTools,
  type ToolDefinition,
} from '../core/ToolRegistry';
import { SandboxTool } from '../shell/SandboxTool';
import { SemanticEditor } from '../shell/SemanticEditor';
import { BuiltInCodeIndex } from '../core/BuiltInCodeIndex';
import { EventBus } from '../core/EventBus';
import type { ConsultFn } from '../core/AgentConsultant';
import type { MemoryFacade } from '../memory/MemoryFacade';
import type { ArtifactManifest } from '../../shared/types';
import * as crypto from 'crypto';

/**
 * Chat agent — the "answer directly" path.
 *
 * It reuses the SAME model-driven ReAct loop as the coder (AgentRuntime), with
 * the FULL tool set (read + write + bash + semantic code search + memory), so a
 * simple question can be answered directly while still letting the model inspect
 * or even create files when the user explicitly asks. There is no separate
 * read-only "basic mode": a casual question just answers, but the model may call
 * any tool. This mirrors Claude Code / Codex, where the harness lets the model
 * decide per turn which tools (if any) to use. No hardcoded sequence, no coder,
 * no build/verify loop.
 */
export class ChatAgent {
  agentId = 'chat';
  private consultFn?: ConsultFn;
  private memory?: MemoryFacade;

  constructor(
    private router: ModelRouter,
    private apiKeys: Record<string, string>,
    private eventBus: EventBus,
    memory?: MemoryFacade
  ) {
    this.memory = memory;
  }

  setConsultFn(fn: ConsultFn): void {
    this.consultFn = fn;
  }

  /** Detect the language of a user message so we can reply in the same language. */
  private detectLanguage(text: string): string {
    if (/[а-яА-ЯёЁ]/.test(text)) return 'Russian';
    if (/[\u4e00-\u9fff]/.test(text)) return 'Chinese';
    if (/[\u0600-\u06FF]/.test(text)) return 'Arabic';
    return 'English';
  }

  async answer(goal: string, workspaceRoot: string): Promise<string> {
    const toolRegistry = new ToolRegistry(this.eventBus);
    const defs: ToolDefinition[] = [];
    const register = (name: string, def: ToolDefinition, exec: any) => {
      toolRegistry.register(name, def, exec);
      defs.push(def);
    };

    // Full tool set (NOT read-only): the model decides per turn whether to read,
    // search, run a command, or write. For a casual question it will usually
    // just answer; for "write me a quick script" it can use the write tools.
    if (workspaceRoot) {
      const sandbox = new SandboxTool({ workspaceRoot, eventBus: this.eventBus });
      const semantic = new SemanticEditor(workspaceRoot);
      const { tools, executors } = createDefaultTools(sandbox, semantic, workspaceRoot);
      for (const t of tools) register(t.name, t, executors[t.name]);

      try {
        const codeIndex = new BuiltInCodeIndex({ workspaceRoot, maxTokens: 12000 });
        const codeTools = createCodeSearchTools(codeIndex as any, workspaceRoot);
        for (const t of codeTools.tools) register(t.name, t, codeTools.executors[t.name]);
      } catch {
        // Code index unavailable — chat can still answer without it.
      }
    }

    if (this.memory) {
      const memTools = createMemoryTools(this.memory);
      for (const t of memTools.tools) register(t.name, t, (memTools.executors as any)[t.name]);
    }

    const helpTools = createHelpTools(toolRegistry);
    for (const t of helpTools.tools) register(t.name, t, (helpTools.executors as any)[t.name]);

    if (this.consultFn) {
      const ct = createConsultTools(this.consultFn);
      for (const t of ct.tools) register(t.name, t, ct.executors[t.name]);
    }

    // Reply in the user's own language (mirrors ClarifierAgent.detectLanguage).
    // Without this the model defaults to English regardless of the user's language.
    const language = this.detectLanguage(goal);
    const systemPrompt = `You are Omni, a helpful AI assistant integrated into the user's editor.
You answer questions, explain concepts, reason about code, and hold a conversation.
CRITICAL: Always respond in the SAME language the user wrote in (detected: ${language}).
If the user's message is in Russian, answer in Russian. If in English, answer in English.
You have the FULL tool set available (read_file, bash, write_file, replace_symbol,
semantic code search, memory). For a general/simple question, just answer directly —
call a tool only when it genuinely helps. If the user explicitly asks you to create or
change a file, you MAY use the write tools to do so. Be concise, accurate, and friendly.
If you used a tool, briefly say what you found or changed.`;

    const runtime = new AgentRuntime(this.eventBus!, this.router, toolRegistry, {
      agentId: 'chat',
      tools: defs,
      maxIterations: 10,
      systemPrompt,
      workspaceRoot,
      // Chat is a free-form conversation: disable TaskCompass drift enforcement so
      // the model isn't forced to "stay on a goal" for a casual question.
      enableTaskCompass: false,
      apiKeys: this.apiKeys,
      memory: this.memory,
    } as any);

    const taskId = `chat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const manifest: ArtifactManifest = await runtime.run(goal, {
      taskId,
      goal,
      workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
    } as any);

    const answer = (manifest.selfVerification || '').trim();
    if (!answer) {
      return (
        "I'm Omni — your in-editor AI assistant. I can answer questions, explain code, and help you build things. " +
        "(My language model didn't return a response — check your API key / provider status in Omni settings.)"
      );
    }
    return answer;
  }
}
