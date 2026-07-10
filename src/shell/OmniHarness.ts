// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docker = require('dockerode');
const { exec } = require('child_process');
type Container = any;
type ContainerCreateOptions = any;

import * as vscode from 'vscode';

import * as path from 'path';
import * as os from 'os';
import { EventBus } from '../core/EventBus';
import {
  SandboxCommandOptions,
  SandboxCommandResult,
  SandboxEvent,
  SandboxConfig,
  DEFAULT_SANDBOX_CONFIG,
} from '../../shared/types/sandbox';

export class OmniHarness {
  private docker: any;

  private container: Container | null = null;
  private containerId: string | null = null;
  private workspaceRoot: string;
  private config: SandboxConfig;
  private eventBus: EventBus;
  private isContainerReady = false;

  constructor(
    workspaceRoot: string,
    eventBus: EventBus,
    config: Partial<SandboxConfig> = {}
  ) {
    this.workspaceRoot = workspaceRoot;
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.eventBus = eventBus;
  }

  /**
   * Initialize the sandbox container
   */
  async initialize(): Promise<void> {
    try {
      this.emitEvent('container_status', { status: 'starting' });

      const { client, label } = await this.resolveDockerConnection();
      this.docker = client;
      await this.docker.ping();
      this.emitEvent('container_status', { status: 'running', endpoint: label });

      await this.ensureImage();
      await this.createContainer();

      this.isContainerReady = true;
      this.emitEvent('container_status', {
        status: 'running',
        containerId: this.containerId ?? undefined
      });

      vscode.window.showInformationMessage(`OmniHarness: Sandbox container started (${this.config.image})`);
    } catch (error) {
      const attempted = this.getTriedEndpoints?.() ?? 'unknown';
      this.emitEvent('container_status', {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to initialize sandbox: attempted [${attempted}]: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a command in the sandbox
   */
  async executeCommand(options: SandboxCommandOptions): Promise<SandboxCommandResult> {
    if (!this.isContainerReady || !this.container) {
      throw new Error('Sandbox container is not ready. Call initialize() first.');
    }

    const startTime = Date.now();
    const { command, timeout = 30000, cwd = this.config.workspaceMountPath, env = {} } = options;

    this.emitEvent('command_start', { command });

    try {
      // Prepare environment variables
      const envVars = Object.entries(env).map(([key, value]) => `${key}=${value}`);
      
      // Prepare the full command with cd to cwd
      const fullCommand = `cd ${cwd} && ${command}`;
      
      // Execute command in container
      const exec = await this.container.exec({
        Cmd: ['sh', '-c', fullCommand],
        Env: envVars,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: cwd,
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      let stdout = '';
      let stderr = '';
      
      // Collect output with timeout
      const outputPromise = new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Command timeout after ${timeout}ms`));
        }, timeout);

        this.docker.modem.demuxStream(stream, {
          write: (chunk: Buffer) => {
            const output = chunk.toString();
            stdout += output;
            this.emitEvent('command_output', { output, isStdErr: false });
          },
        }, {
          write: (chunk: Buffer) => {
            const output = chunk.toString();
            stderr += output;
            this.emitEvent('command_output', { output, isStdErr: true });
          },
        });

        stream.on('end', async () => {
          clearTimeout(timer);
          const inspect = await exec.inspect();
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: inspect.ExitCode || 0,
          });
        });

        stream.on('error', (err: unknown) => {

          clearTimeout(timer);
          reject(err);
        });
      });

      const { stdout: finalStdout, stderr: finalStderr, exitCode } = await outputPromise;
      const executionTime = Date.now() - startTime;

      const result: SandboxCommandResult = {
        stdout: finalStdout,
        stderr: finalStderr,
        exitCode,
        command,
        executionTime,
      };

      this.emitEvent('command_complete', {
        command,
        exitCode,
        executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.emitEvent('command_error', {
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      });
      
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.container) {
      try {
        await this.container.stop();
        await this.container.remove();
        this.emitEvent('container_status', { status: 'stopped' });
        vscode.window.showInformationMessage('OmniHarness: Sandbox container stopped');
      } catch (error) {
        console.warn('Failed to clean up container:', error);
      }
      this.container = null;
      this.containerId = null;
      this.isContainerReady = false;
    }
  }

  /**
   * Get a summary of the last N lines for LLM context
   */
  static summarizeForLLM(result: SandboxCommandResult, maxLines = 50): string {
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const lines = combined.split('\n').filter((l) => l.trim());
    
    if (lines.length <= maxLines) {
      return lines.join('\n') || '(no output)';
    }
    
    const truncatedResult = { ...result, truncated: true };
    return [
      `Command: ${result.command}`,
      `Exit code: ${result.exitCode}`,
      `Execution time: ${result.executionTime}ms`,
      `Output (last ${maxLines} of ${lines.length} lines):`,
      ...lines.slice(-maxLines),
      `\n[Output truncated, showing last ${maxLines} of ${lines.length} lines]`,
    ].join('\n');
  }

  private async ensureImage(): Promise<void> {
    try {
      await this.docker.getImage(this.config.image).inspect();
    } catch (error) {
      vscode.window.showInformationMessage(`OmniHarness: Pulling image ${this.config.image}...`);
      
      return new Promise((resolve, reject) => {
        this.docker.pull(this.config.image, (err: unknown, stream: unknown) => {

          if (err) return reject(err);
          
          this.docker.modem.followProgress(stream as any, (err: unknown) => {

            if (err) reject(err);
            else resolve();
          });
        });
      });
    }
  }

  private async createContainer(): Promise<void> {
    const containerOptions: ContainerCreateOptions = {
      Image: this.config.image,
      HostConfig: {
        Binds: [`${this.workspaceRoot}:${this.config.workspaceMountPath}:rw`],
        Memory: this.config.memoryLimit ? parseInt(this.config.memoryLimit) * 1024 * 1024 : undefined,
        NanoCpus: this.config.cpuLimit ? this.config.cpuLimit * 1e9 : undefined,
        NetworkMode: this.config.networkDisabled ? 'none' : 'bridge',
        ReadonlyRootfs: this.config.readOnlyRootfs,
        AutoRemove: true,
      },
      WorkingDir: this.config.workspaceMountPath,
      Cmd: ['tail', '-f', '/dev/null'], // Keep container running
      Tty: false,
      OpenStdin: false,
    };

    const container = await this.docker.createContainer(containerOptions);
    await container.start();
    
    this.container = container;
    this.containerId = container.id;
  }

  private async resolveDockerConnection(): Promise<{ client: any; label: string }> {
    const tried: string[] = [];

    if (process.env.DOCKER_HOST) {
      tried.push('DOCKER_HOST');
      const result = this.tryDockerHost(process.env.DOCKER_HOST);
      if (result && (await this.pingWithTimeout(result.client).catch(() => false))) {
        return { client: result.client, label: result.label };
      }
    }

    tried.push('docker context');
    const contextResult = await this.tryDockerContext();
    if (contextResult) return contextResult;

    const defaults: { factory: () => any; label: string }[] = [
      { factory: () => new Docker(), label: '//./pipe/docker_engine' },
      { factory: () => new Docker({ host: '127.0.0.1', port: 2375 }), label: 'tcp://127.0.0.1:2375' },
      { factory: () => new Docker({ host: 'localhost', port: 2375 }), label: 'tcp://localhost:2375' },
    ];

    for (const entry of defaults) {
      tried.push(entry.label);
      const client = entry.factory();
      if (await this.pingWithTimeout(client).catch(() => false)) {
        return { client, label: entry.label };
      }
    }

    throw new Error(`No reachable Docker daemon. Tried: ${tried.join(', ')}`);
  }

  private getTriedEndpoints(): string {
    return 'unknown — set DOCKER_HOST, start Docker Desktop, or expose tcp://localhost:2375';
  }

  private pingWithTimeout(client: any): Promise<boolean> {
    return Promise.race([
      Promise.resolve(client.ping()).then(() => true).catch(() => false),
      new Promise<boolean>(r => setTimeout(() => r(false), 2500)),
    ]);
  }

  private tryDockerHost(host: string): { client: any; label: string } | null {
    let label: string;
    let client: any;

    if (/^npipe:\/\//i.test(host) || /^(\\\\|\/\/)/.test(host)) {
      label = 'DOCKER_HOST (named pipe)';
      client = new Docker();
    } else if (/^tcp:\/\//i.test(host)) {
      const m = host.match(/^tcp:\/\/([^:/]+)(?::(\d+))?/i)!;
      const h = m[1] || '127.0.0.1';
      const p = m[2] ? parseInt(m[2], 10) : 2375;
      label = `DOCKER_HOST tcp (${h}:${p})`;
      client = new Docker({ host: h, port: p });
    } else if (/^unix:\/\//i.test(host)) {
      if (os.platform() === 'win32') {
        return null;
      }
      const socketPath = host.replace(/^unix:\/\//, '');
      label = `DOCKER_HOST unix (${socketPath})`;
      client = new Docker({ socketPath });
    } else {
      const [h, p] = host.split(':');
      label = `DOCKER_HOST ${h}:${p}`;
      client = new Docker({ host: h, port: parseInt(p, 10) });
    }

    return { client, label };
  }

  private async tryDockerContext(): Promise<{ client: any; label: string } | null> {
    return new Promise((resolve) => {
      exec('docker context inspect -f "{{.Endpoints.docker.Host}}"', { timeout: 2500 }, (err: NodeJS.ErrnoException | null, stdout: string) => {
        if (err || !stdout) return resolve(null);
        const host = stdout.trim();
        if (!host) return resolve(null);
        if (/^unix:\/\//i.test(host) && os.platform() === 'win32') return resolve(null);
        if (/^ssh:\/\//i.test(host)) return resolve(null);
        try {
          const result = this.tryDockerHost(host);
          if (!result) return resolve(null);
          this.pingWithTimeout(result.client)
            .then(ok => ok ? resolve({ client: result.client, label: result.label }) : resolve(null))
            .catch(() => resolve(null));
        } catch {
          return resolve(null);
        }
      });
    });
  }

  private emitEvent(type: SandboxEvent['type'], data: SandboxEvent['data']): void {
    const event: SandboxEvent = {
      type,
      data,
      timestamp: Date.now(),
    };
    
    // Send to EventBus for UI visualization
    this.eventBus.emit({
      type: 'SANDBOX_EVENT',
      payload: event,
    } as any);
  }
}
