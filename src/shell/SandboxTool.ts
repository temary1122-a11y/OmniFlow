import { OmniHarness } from './OmniHarness';
import { SandboxCommandOptions, SandboxCommandResult } from '../../shared/types/sandbox';
import { EventBus } from '../core/EventBus';

export interface SandboxToolOptions {
  workspaceRoot: string;
  eventBus: EventBus;
  image?: string;
}

export class SandboxTool {
  private harness: OmniHarness | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private useLocalFallback = false;
  private lastFallbackAt = 0;

  constructor(private options: SandboxToolOptions) {}

  /**
   * Initialize the sandbox (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.initializationPromise) {
      this.initializationPromise = this.initialize();
    }
    
    await this.initializationPromise;
  }

  async initialize(): Promise<void> {
    try {
      this.harness = new OmniHarness(
        this.options.workspaceRoot,
        this.options.eventBus,
        this.options.image ? { image: this.options.image } : {}
      );

      await this.harness.initialize();
      this.isInitialized = true;
    } catch (error) {
      this.harness = null;
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Execute a command in the sandbox. When Docker/the harness is unavailable
   * (e.g. Docker not installed or daemon not running), transparently falls back
   * to the local shell so bash-style tooling (ffmpeg, npm installs, TTS, etc.)
   * still works on the host machine.
   */
  async executeInSandbox(options: SandboxCommandOptions): Promise<SandboxCommandResult> {
    if (this.useLocalFallback && Date.now() - this.lastFallbackAt > 60000) {
      this.useLocalFallback = false;
      this.isInitialized = false;
      this.initializationPromise = null;
    }

    if (!this.useLocalFallback) {
      try {
        await this.ensureInitialized();
      } catch (error) {
        this.useLocalFallback = true;
        this.lastFallbackAt = Date.now();
        this.isInitialized = false;
        this.initializationPromise = null;
        console.warn(
          '[SandboxTool] Docker/harness unavailable, falling back to local shell: ' +
            (error instanceof Error ? error.message : String(error)) +
            ' — ensure Docker Desktop is running, or set DOCKER_HOST / enable "Expose daemon on tcp://localhost:2375" for WSL2 setups.'
        );
      }
    }

    if (this.useLocalFallback || !this.harness) {
      return this.executeLocal(options);
    }

    return await this.harness.executeCommand(options);
  }

  /**
   * Run a command directly on the host via the cross-platform shell. Used as a
   * fallback when Docker is not available. No container isolation — file writes
   * land in the real workspace (agent write-boundaries still apply at the tool layer).
   */
  private async executeLocal(options: SandboxCommandOptions): Promise<SandboxCommandResult> {
    const { CrossPlatformShell } = require('./CrossPlatformShell');
    const start = Date.now();
    const result = await CrossPlatformShell.exec(options.command, {
      cwd: options.cwd || this.options.workspaceRoot,
      timeout: options.timeout,
      env: options.env,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      command: result.command,
      executionTime: Date.now() - start,
    };
  }

  /**
   * Get a summary for LLM context
   */
  static summarizeForLLM(result: SandboxCommandResult, maxLines = 50): string {
    return OmniHarness.summarizeForLLM(result, maxLines);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.harness) {
      await this.harness.cleanup();
      this.harness = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Check if Docker is available on the system
   */
  static async isDockerAvailable(): Promise<boolean> {
    const { exec } = require('child_process');

    const pinger = () => new Promise<boolean>((resolve) => {
      exec('docker info', { timeout: 3000 }, (error: Error | null) => {
        resolve(!error);
      });
    });

    try {
      const ok = await pinger();
      if (ok) return true;
    } catch { /* fall through */ }

    try {
      const { exec: exec2 } = require('child_process');
      await new Promise<void>((resolve) => {
        exec2('docker --version', (error: Error | null) => {
          resolve();
        });
      });
    } catch { /* ignore */ }

    return false;
  }

  /**
   * Fallback to local shell if Docker is not available
   */
  static async executeWithFallback(
    options: SandboxCommandOptions,
    workspaceRoot: string
  ): Promise<SandboxCommandResult> {
    const isDockerAvailable = await this.isDockerAvailable();
    
    if (!isDockerAvailable) {
      // Fallback to local shell (with warning)
      const { CrossPlatformShell } = require('./CrossPlatformShell');
      console.warn('Docker not available, falling back to local shell execution');
      
      const result = await CrossPlatformShell.exec(options.command, {
        cwd: options.cwd || workspaceRoot,
        timeout: options.timeout,
        env: options.env,
      });

      return {
        ...result,
        executionTime: 0, // Not measured in fallback
      };
    }

    throw new Error('Sandbox tool not initialized');
  }
}
