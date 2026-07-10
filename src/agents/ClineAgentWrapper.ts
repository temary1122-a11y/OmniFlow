import { EventBus } from '../core/EventBus';
import { SandboxTool } from '../shell/SandboxTool';
import { SemanticEditor } from '../shell/SemanticEditor';
import { isWithinBoundary } from '../core/ToolRegistry';
import { ClineHarnessCompatibilityChecker } from '../core/ClineHarnessCompatibilityChecker';
import type { HandoffContract, ArtifactManifest } from '../../shared/types';


export interface ClineAgentWrapperOptions {
  router: any;
  apiKeys: Record<string, string>;
  eventBus: EventBus;
  workspaceRoot: string;
}

export interface ClineSdkModule {
  Agent: new (config: Record<string, unknown>) => unknown;
  createTool: (definition: Record<string, unknown>) => Record<string, unknown>;
}

export type ClineAgent = {
  subscribe: (listener: (event: ClineEvent) => void) => () => void;
  restore: (messages: unknown[]) => Promise<void>;
  run: (prompt: string) => Promise<ClineRunResult>;
  abort?: (reason?: string) => void;
};

export type ClineEvent =
  | { type: 'assistant-text-delta'; text: string }
  | { type: 'assistant-reasoning-delta'; text: string }
  | { type: 'tool-started'; toolCall: { toolName: string; input: unknown } }
  | { type: 'tool-finished'; message: { content: { type: string; output?: unknown }[] }; toolCall: { toolName: string } }
  | { type: 'status-notice'; message: string }
  | { type: 'run-finished' }
  | { type: 'run-failed'; error: unknown };

export type ClineRunResult = {
  outputText?: string;
  [key: string]: unknown;
};

export class ClineConfigurationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ClineConfigurationError';
  }
}

/**
 * Bridge between Cline's agent runtime and Omni's EventBus/UI.
 *
 * Reuses Omni's existing SandboxTool for command execution,
 * and translates Cline runtime events into Omni IPC events.
 *
 * Note: Cline SDK is loaded lazily via dynamic import() to avoid
 * ESM/CJS activation crashes when the package is unavailable.
 */
export class ClineAgentWrapper {
  private static readonly MAX_CLINE_ITERATIONS = 20;
  private static readonly CLINE_TIMEOUT_MS = 5 * 60 * 1000;

  private agent: unknown;
  private createTool: ((definition: Record<string, unknown>) => Record<string, unknown>) | null = null;
  private AgentCtor: (new (config: Record<string, unknown>) => ClineAgent) | null = null;
  private eventBus: EventBus;
  private sandbox: SandboxTool;
  private workspaceRoot: string;
  private unsubscribe: (() => void) | null = null;
  private latestAccumulatedText = '';
  private latestAccumulatedReasoning = '';
  private loaded = false;
  private loadFailed = false;
  private currentBoundary?: string[];
  private toolCallCount = 0;
  private writtenArtifacts: Array<{ filePath: string; content: string }> = [];

  constructor(private options: ClineAgentWrapperOptions) {
    this.eventBus = options.eventBus;
    this.workspaceRoot = options.workspaceRoot;
    this.sandbox = new SandboxTool({
      workspaceRoot: this.workspaceRoot,
      eventBus: this.eventBus,
    });
  }

  async execute(
    task: string,
    contract: HandoffContract
  ): Promise<ArtifactManifest> {
    await this.ensureLoaded();

    if (!this.AgentCtor || !this.createTool) {
      throw new ClineConfigurationError(
        'Cline SDK not available. Legacy backend will be used.'
      );
    }

    this.latestAccumulatedText = '';
    this.latestAccumulatedReasoning = '';
    this.currentBoundary = contract.boundary;
    this.toolCallCount = 0;
    this.writtenArtifacts = [];

    this.unsubscribe = (this.agent as any).subscribe((event: any) => this.onEvent(event));

    const systemPrompt = this.buildSystemPrompt(contract);
    const userPrompt = this.buildUserPrompt(contract, task);

    try {
      await (this.agent as any).restore([
        {
          role: 'system',
          content: [{ type: 'text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: userPrompt }],
        },
      ] as any);

      this.eventBus.emit({
        type: 'AGENT_COMMENTARY',
        payload: {
          agentId: 'coder',
          phase: 'build',
          message: 'Cline agent started: ' + task.slice(0, 120),
          timestamp: Date.now(),
        },
      });

      const result = await Promise.race([
        (this.agent as any).run(userPrompt),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Cline execution timed out after ${ClineAgentWrapper.CLINE_TIMEOUT_MS / 1000}s`)),
            ClineAgentWrapper.CLINE_TIMEOUT_MS
          )
        ),
      ]);

      if (this.toolCallCount >= ClineAgentWrapper.MAX_CLINE_ITERATIONS) {
        throw new ClineConfigurationError(
          `Cline execution exceeded the maximum iteration limit of ${ClineAgentWrapper.MAX_CLINE_ITERATIONS} tool calls`
        );
      }

      this.eventBus.emit({
        type: 'AGENT_COMMENTARY',
        payload: {
          agentId: 'coder',
          phase: 'build',
          message: 'Cline agent finished',
          timestamp: Date.now(),
        },
      });

      return this.toManifest(result, contract);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.eventBus.emit({
        type: 'ERROR_OCCURRED',
        payload: {
          error: `Cline execution failed: ${message}`,
          phase: 'build',
          recoverable: true,
        },
      });

      if (error instanceof ClineConfigurationError) {
        throw error;
      }

      throw new ClineConfigurationError(`Cline execution failed: ${message}`, error);
    } finally {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    }
  }

  abort(): void {
    try {
      (this.agent as any).abort('User requested stop');
    } catch {
      // ignore abort errors
    }
  }

  isLoaded(): boolean {
    return this.loaded && !this.loadFailed;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    // Check Node.js compatibility before attempting to load Cline SDK
    const compatibility = ClineHarnessCompatibilityChecker.check();
    if (!compatibility.isCompatible) {
      this.eventBus.emit({
        type: 'ERROR_OCCURRED',
        payload: {
          error: `Cline SDK requires Node.js >= ${compatibility.requiredVersion}, current: ${compatibility.nodeVersion}. Using legacy backend.`,
          phase: 'build',
          recoverable: true,
        },
      });
      this.AgentCtor = null;
      this.createTool = null;
      this.loadFailed = true;
      return;
    }

    if (!this.AgentCtor || !this.createTool) {
      const mod = (await this.loadSdkModule()) as ClineSdkModule | null;

      if (!mod) {
        this.AgentCtor = null;
        this.createTool = null;
        this.loadFailed = true;
        return;
      }

      const Agent = mod.Agent;
      const createTool = mod.createTool;

      if (!Agent || !createTool) {
        throw new ClineConfigurationError('@cline/sdk loaded, but Agent/createTool exports are missing');
      }

      this.AgentCtor = Agent as new (config: Record<string, unknown>) => ClineAgent;
      this.createTool = createTool.bind(mod) as (definition: Record<string, unknown>) => Record<string, unknown>;
    }

    const providerId = this.mapProvider(this.options.router);
    const modelId = this.mapModel(this.options.router);
    const apiKey = this.resolveApiKey(this.options.router, this.options.apiKeys);

    if (!apiKey) {
      this.AgentCtor = null;
      this.createTool = null;
      this.loadFailed = true;
      throw new ClineConfigurationError(
        `Cline backend selected, but no API key is available for provider "${providerId}". ` +
          `Check Omni settings or switch executionBackend to "legacy".`
      );
    }

    const config: Record<string, unknown> = {
      providerId,
      modelId,
      apiKey,
      tools: [
        this.createBashTool(),
        this.createWriteFileTool(),
        this.createReadFileTool(),
        this.createReplaceSymbolTool(),
      ],
    };

    this.agent = new (this.AgentCtor as any)(config);
    this.loaded = true;
  }

  private async loadSdkModule(): Promise<unknown | null> {
    try {
      return await import('@cline/sdk');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.eventBus.emit({
        type: 'ERROR_OCCURRED',
        payload: {
          error: `Cline SDK failed to load: ${message}. Legacy backend will be used.`,
          phase: 'build',
          recoverable: true,
        },
      });
      return null;
    }
  }

  private buildSystemPrompt(contract: HandoffContract): string {
    const criteria = (contract.successCriteria ?? []).join('; ');
    const description = contract.description ?? '';
    const goal = contract.contextPacket.goal ?? '';

    return [
      'You are an autonomous engineering agent inside a VS Code workspace.',
      'Use bash for shell commands, replace_symbol for editing existing symbols, write_file/read_file for source code changes.',
      'Prefer minimal, focused changes. Return only the work result.',
      '',
      description ? `Task: ${description}` : null,
      goal ? `Goal: ${goal}` : null,
      criteria ? `Success criteria: ${criteria}` : null,
      'Rules:',
      '- Inspect existing files before changing them.',
      '- Write code to the requested artifact paths when possible.',
      '- If a command fails, analyze the error and retry with a corrected command.',
      '- Do not run destructive commands without clear need.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildUserPrompt(contract: HandoffContract, task: string): string {
    const targets = (contract.artifactTargets ?? [])
      .map((t) => `- ${t.filePath}`)
      .join('\n');

    return [
      `Subtask: ${contract.subtaskId}`,
      contract.description ? `Description: ${contract.description}` : null,
      'Artifact targets:',
      targets || '(none specified)',
      '',
      'Deliver the requested work and, when possible, populate the artifact files above.',
      task ? `Additional guidance: ${task}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private onEvent(event: any) {
    switch (event.type) {
      case 'assistant-text-delta': {
        this.latestAccumulatedText += event.text;
        this.eventBus.emit({
          type: 'AGENT_COMMENTARY',
          payload: {
            agentId: 'coder',
            phase: 'build',
            message: event.text,
            timestamp: Date.now(),
          },
        });
        break;
      }
      case 'assistant-reasoning-delta': {
        this.latestAccumulatedReasoning += event.text;
        this.eventBus.emit({
          type: 'REASONING_TRACE',
          payload: {
            agentId: 'coder',
            phase: 'build',
            thought: event.text,
            timestamp: Date.now(),
          },
        });
        break;
      }
      case 'tool-started': {
        this.toolCallCount++;
        this.eventBus.emit({
          type: 'TOOL_CALL',
          payload: {
            agentId: 'coder',
            toolName: event.toolCall.toolName,
            args: event.toolCall.input as Record<string, unknown> | undefined,
            timestamp: Date.now(),
          },
        });
        break;
      }
      case 'tool-finished': {
        const toolResult = this.extractToolResult(event.message);
        const output = this.formatToolResult(toolResult);
        const isError = this.isToolError(toolResult);

        this.captureWrittenArtifact(event, toolResult);

        this.eventBus.emit({
          type: 'TOOL_RESULT',
          payload: {
            agentId: 'coder',
            toolName: event.toolCall.toolName,
            success: !isError,
            output: output.slice(0, 4000),
            error: isError ? output : undefined,
            timestamp: Date.now(),
          },
        });
        break;
      }
      case 'status-notice': {
        this.eventBus.emit({
          type: 'AGENT_COMMENTARY',
          payload: {
            agentId: 'coder',
            phase: 'build',
            message: event.message,
            timestamp: Date.now(),
          },
        });
        break;
      }
      case 'run-finished': {
        this.eventBus.emit({
          type: 'AGENT_COMMENTARY',
          payload: {
            agentId: 'coder',
            phase: 'build',
            message: 'Cline run finished',
            timestamp: Date.now(),
          },
        });
        break;
      }
      case 'run-failed': {
        this.eventBus.emit({
          type: 'ERROR_OCCURRED',
          payload: {
            error: event.error instanceof Error ? event.error.message : String(event.error),
            phase: 'build',
            recoverable: true,
          },
        });
        break;
      }
      default:
        break;
    }
  }

  private isToolError(result: unknown): boolean {
    if (result == null) return false;
    if (result instanceof Error) return true;
    if (typeof result === 'string') {
      const lower = result.toLowerCase();
      return lower.includes('error') || lower.includes('failed') || lower.includes('exitcode');
    }
    return false;
  }

  private extractToolResult(message: any): unknown {
    const resultPart = message.content.find(
      (part: any): boolean => part.type === 'tool-result'
    );
    return resultPart?.output ?? message.content;
  }

  private formatToolResult(result: unknown): string {
    if (typeof result === 'string') return result;
    if (result == null) return '';
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }

  private captureWrittenArtifact(event: any, toolResult: unknown): void {
    try {
      const toolName: string | undefined = event.toolCall?.toolName;

      if (toolName === 'write_file') {
        const result = toolResult as { path?: unknown } | undefined;
        const path = typeof result?.path === 'string' ? result.path : undefined;
        if (path) {
          const fullPath = this.resolveWorkspacePath(path);
          const fs = require('fs');
          const content = fs.readFileSync(fullPath, 'utf8');
          this.writtenArtifacts.push({ filePath: path, content });
        }
      } else if (toolName === 'replace_symbol') {
        const result = toolResult as { success?: unknown; file?: unknown } | undefined;
        const success = result?.success === true || result?.success === 'true';
        const file = typeof result?.file === 'string' ? result.file : undefined;
        if (success && file) {
          const fullPath = this.resolveWorkspacePath(file);
          const fs = require('fs');
          const content = fs.readFileSync(fullPath, 'utf8');
          this.writtenArtifacts.push({ filePath: file, content });
        }
      }
    } catch {
      // ignore read failures; the artifact is simply not captured
    }
  }

  private mapProvider(router: any): string {
    const resolved = router.getResolvedProvider?.(this.options.apiKeys) ?? 'openrouter';
    const map: Record<string, string> = {
      openrouter: 'openrouter',
      'kilo-gateway': 'openrouter',
      codik: 'openrouter',
      ollama: 'ollama',
      fallback: 'openrouter',
    };
    return map[resolved] ?? 'openrouter';
  }

  private mapModel(router: any): string {
    const selected = router.route?.({ agentRole: 'coder', phase: 'build', complexity: 'medium' }, this.options.apiKeys);
    const modelId = selected?.modelId ?? 'stepfun/step-3.7-flash:free';
    return modelId;
  }

  private resolveApiKey(router: any, apiKeys: Record<string, string>): string | undefined {
    const provider = router.getResolvedProvider?.(apiKeys) ?? 'openrouter';
    const keyMap: Record<string, string | undefined> = {
      openrouter: apiKeys.openrouterApiKey ?? apiKeys['openrouter'],
      'kilo-gateway': apiKeys.kiloGatewayApiKey ?? apiKeys['kilo-gateway'],
      codik: apiKeys.codikApiKey ?? apiKeys['codik'],
      ollama: apiKeys.ollamaApiKey ?? apiKeys['ollama'],
    };
    return keyMap[provider] ?? Object.values(apiKeys).find(Boolean);
  }

  private createBashTool() {
    return this.createTool!({
      name: 'bash',
      description: 'Execute a shell command in the workspace sandbox. Returns stdout/stderr and exit code.',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
      execute: async (input: { command: string }) => {
        const command = String(input.command ?? '');
        this.eventBus.emit({
          type: 'TOOL_CALL',
          payload: {
            agentId: 'coder',
            toolName: 'bash',
            args: { command },
            timestamp: Date.now(),
          },
        });

        try {
          const result = await this.sandbox.executeInSandbox({
            command,
            cwd: this.workspaceRoot,
          });

          const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
          const success = result.exitCode === 0;

          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'bash',
              success,
              output: output.slice(0, 4000),
              error: success ? undefined : (result.stderr || result.stdout || `exitCode=${result.exitCode}`),
              timestamp: Date.now(),
            },
          });

          return {
            output,
            exitCode: result.exitCode,
            success,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'bash',
              success: false,
              error: message,
              timestamp: Date.now(),
            },
          });
          throw error;
        }
      },
    });
  }

  private createWriteFileTool() {
    return this.createTool!({
      name: 'write_file',
      description: 'Write text content to a file inside the workspace. Creates parent directories if needed.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute file path' },
          content: { type: 'string', description: 'Full file content to write' },
        },
        required: ['path', 'content'],
      },
      execute: async (input: { path: string; content: string }) => {
        const path = String(input.path ?? '');
        const content = String(input.content ?? '');

        this.eventBus.emit({
          type: 'TOOL_CALL',
          payload: {
            agentId: 'coder',
            toolName: 'write_file',
            args: { path, contentLength: content.length },
            timestamp: Date.now(),
          },
        });

        try {
          const fullPath = this.resolveWorkspacePath(path);
          if (!isWithinBoundary(this.workspaceRoot, this.currentBoundary, path)) {
            this.eventBus.emit({
              type: 'TOOL_RESULT',
              payload: {
                agentId: 'coder',
                toolName: 'write_file',
                success: false,
                error: `Write blocked by boundary: '${path}' is outside allowed [${this.currentBoundary?.join(', ') || ''}].`,
                timestamp: Date.now(),
              },
            });
            throw new Error(`Write blocked by boundary: '${path}'.`);
          }
          const { execSync } = require('child_process');
          const dir = fullPath.replace(/\\/g, '/').includes('/')
            ? fullPath.replace(/\\/g, '/').replace(/\/[^\/]*$/, '')
            : this.workspaceRoot;

          try {
            execSync(`mkdir -p "${dir}"`, { encoding: 'utf8' });
          } catch {
            // ignore mkdir errors on Windows
          }

          const fs = require('fs');
          fs.writeFileSync(fullPath, content, 'utf8');

          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'write_file',
              success: true,
              output: `Wrote ${content.length} bytes to ${path}`,
              timestamp: Date.now(),
            },
          });

          return { path, bytes: content.length };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'write_file',
              success: false,
              error: message,
              timestamp: Date.now(),
            },
          });
          throw error;
        }
      },
    });
  }

  private createReadFileTool() {
    return this.createTool!({
      name: 'read_file',
      description: 'Read a text file from the workspace. Returns up to 50k characters.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute file path' },
        },
        required: ['path'],
      },
      execute: async (input: { path: string }) => {
        const path = String(input.path ?? '');

        this.eventBus.emit({
          type: 'TOOL_CALL',
          payload: {
            agentId: 'coder',
            toolName: 'read_file',
            args: { path },
            timestamp: Date.now(),
          },
        });

        try {
          const fullPath = this.resolveWorkspacePath(path);
          const fs = require('fs');
          const content = fs.readFileSync(fullPath, 'utf8');
          const output = content.slice(0, 50000);

          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'read_file',
              success: true,
              output,
              timestamp: Date.now(),
            },
          });

          return { path, content: output, bytes: content.length };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'read_file',
              success: false,
              error: message,
              timestamp: Date.now(),
            },
          });
          throw error;
        }
      },
    });
  }

  private createReplaceSymbolTool() {
    return this.createTool!({
      name: 'replace_symbol',
      description: 'Replace a symbol in an existing file by name using VS Code LSP. Uses exact-name match; safer than write_file for editing existing code.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Workspace-relative file path' },
          symbolName: { type: 'string', description: 'Exact symbol name to replace (function/class/variable identifier)' },
          newCode: { type: 'string', description: 'Replacement source code for the symbol' },
        },
        required: ['file', 'symbolName', 'newCode'],
      },
      execute: async (input: { file: string; symbolName: string; newCode: string }) => {
        const file = String(input.file ?? '');
        const symbolName = String(input.symbolName ?? '');
        if (!isWithinBoundary(this.workspaceRoot, this.currentBoundary, file)) {
          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'replace_symbol',
              success: false,
              error: `Edit blocked by boundary: '${file}' is outside allowed [${this.currentBoundary?.join(', ') || ''}].`,
              timestamp: Date.now(),
            },
          });
          throw new Error(`Edit blocked by boundary: '${file}'.`);
        }
        const newCode = String(input.newCode ?? '');

        this.eventBus.emit({
          type: 'TOOL_CALL',
          payload: {
            agentId: 'coder',
            toolName: 'replace_symbol',
            args: { file, symbolName, newCodeLength: newCode.length },
            timestamp: Date.now(),
          },
        });

        try {
          const editor = new SemanticEditor(this.workspaceRoot);
          const result = await editor.apply({
            action: 'replace_symbol',
            file,
            symbolName,
            newCode,
          });

          // Always emit resolution event
          this.eventBus.emit({
            type: 'SYMBOL_RESOLVED',
            payload: {
              agentId: 'coder',
              found: result.symbolFound ?? !!(result.symbolLocation || result.error === ''),
              symbolName,
              location: result.symbolLocation,
              reason: result.symbolFound === false ? (result.error ?? 'Unknown resolution failure') : undefined,
              timestamp: Date.now(),
            },
          });

          this.eventBus.emit({
            type: 'SEMANTIC_EDIT_APPLIED',
            payload: {
              ...result,
              timestamp: Date.now(),
            },
          });

          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'replace_symbol',
              success: result.success,
              output: result.success
                ? `Replaced ${symbolName} in ${file}`
                : undefined,
              error: result.error,
              timestamp: Date.now(),
            },
          });

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.eventBus.emit({
            type: 'TOOL_RESULT',
            payload: {
              agentId: 'coder',
              toolName: 'replace_symbol',
              success: false,
              error: message,
              timestamp: Date.now(),
            },
          });
          throw error;
        }
      },
    });
  }

  private resolveWorkspacePath(path: string): string {
    if (path.includes(':')) {
      return path;
    }
    if (path.startsWith('/') || path.startsWith('\\')) {
      return path;
    }
    return require('path').join(this.workspaceRoot, path);
  }

  private toManifest(result: any, _contract: HandoffContract): ArtifactManifest {
    const outputText = result.outputText ?? this.latestAccumulatedText ?? '';
    const artifacts: { filePath: string; content: string; hash: string }[] = [];

    if (outputText) {
      artifacts.push({
        filePath: '.omniflow/build/output.txt',
        content: outputText,
        hash: this.sha256(outputText),
      });
    }

    if (this.latestAccumulatedReasoning) {
      artifacts.push({
        filePath: '.omniflow/build/reasoning.txt',
        content: this.latestAccumulatedReasoning,
        hash: this.sha256(this.latestAccumulatedReasoning),
      });
    }

    for (const written of this.writtenArtifacts) {
      artifacts.push({
        filePath: written.filePath,
        content: written.content,
        hash: this.sha256(written.content),
      });
    }

    return {
      artifacts,
      subtaskId: 'cline-build',
      completedAt: Date.now(),
      selfVerification: outputText.slice(0, 500),
    };
  }

  private sha256(value: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(value).digest('hex');
  }
}