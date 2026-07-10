import { spawn } from 'child_process';
import * as os from 'os';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string;
}

export interface ShellOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

/** Cross-platform command execution — no hardcoded PowerShell */
export class CrossPlatformShell {
  static getDefaultShell(): { shell: string; flag: string } {
    if (process.platform === 'win32') {
      // PowerShell with UTF-8 is more reliable than cmd.exe on modern Windows systems
      // This fixes cp866 encoding issues and provides better command handling
      return { shell: 'powershell.exe', flag: '-Command' };
    }
    const sh = process.env.SHELL || '/bin/sh';
    return { shell: sh, flag: '-c' };
  }

  static async exec(command: string, options: ShellOptions = {}): Promise<ShellResult> {
    const { shell, flag } = this.getDefaultShell();
    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout ?? 120_000;

    return new Promise((resolve, reject) => {
      const child = spawn(shell, [flag, command], {
        cwd,
        env: { ...process.env, ...options.env },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
      }, timeout);

      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: killed ? null : code,
          command,
        });
      });
    });
  }

  static summarizeOutput(result: ShellResult, maxLines = 8): string {
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const lines = combined.split('\n').filter((l) => l.trim());
    if (lines.length <= maxLines) {
      return lines.join('\n') || '(no output)';
    }
    return [...lines.slice(0, maxLines), `… (${lines.length - maxLines} more lines)`].join('\n');
  }

  static platformInfo(): string {
    return `${os.platform()} ${os.release()} (${os.arch()})`;
  }

  /**
   * One-line description of the host environment and how to invoke shell
   * commands, for injection into agent prompts so models stop emitting
   * OS-invalid commands (e.g. `ls`/`pwd` on Windows).
   */
  static shellInfo(): string {
    const { shell, flag } = this.getDefaultShell();
    const invoked = shell === 'cmd.exe' ? `cmd.exe /c "<command>"` : `${shell} -c "<command>"`;
    return `${this.platformInfo()} | shell: ${shell} (invoke as: ${invoked})`;
  }
}
