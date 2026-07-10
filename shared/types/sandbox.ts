// OmniFlow Execution Harness Types
export interface SandboxCommandOptions {
  command: string;
  timeout?: number; // milliseconds
  cwd?: string;
  env?: Record<string, string>;
}

export interface SandboxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string;
  executionTime: number;
  truncated?: boolean;
}

export interface SandboxEvent {
  type: 'command_start' | 'command_output' | 'command_complete' | 'command_error' | 'container_status';
  data: {
    command?: string;
    output?: string;
    isStdErr?: boolean;
    exitCode?: number | null;
    executionTime?: number;
    containerId?: string;
    endpoint?: string;
    status?: 'starting' | 'running' | 'stopped' | 'error';
    error?: string;
  };
  timestamp: number;
}

export interface SandboxConfig {
  image: string;
  workspaceMountPath: string;
  memoryLimit?: string;
  cpuLimit?: number;
  networkDisabled?: boolean;
  readOnlyRootfs?: boolean;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  image: 'node:20-alpine',
  workspaceMountPath: '/workspace',
  memoryLimit: '512m',
  cpuLimit: 1,
  networkDisabled: true,
  readOnlyRootfs: true,
};
