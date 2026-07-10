// Minimal `vscode` shim for running source modules under vitest (outside the extension host).
// Only the members exercised by the test import graph are required; harmless no-op objects
// are provided for the rest so module loading never throws. DO NOT use this in production.

export const Uri = {
  file: (p: string) => ({ fsPath: p, path: p, scheme: 'file', toString: () => p }),
  parse: (p: string) => ({ fsPath: p, path: p, scheme: 'file', toString: () => p }),
};

export class WorkspaceEdit {
  replace(): void { /* no-op under test */ }
  insert(): void { /* no-op under test */ }
  delete(): void { /* no-op under test */ }
}

export class Range {
  constructor(
    public startLine: number,
    public startColumn: number,
    public endLine: number,
    public endColumn: number
  ) {}
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export const window = {
  createOutputChannel: () => ({ appendLine() {}, append() {}, show() {}, dispose() {} }),
  showInformationMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  showInputBox: () => Promise.resolve(undefined),
  showQuickPick: () => Promise.resolve(undefined),
  createWebviewPanel: () => ({}),
  registerWebviewViewProvider: () => ({ dispose() {} }),
  registerWebviewPanelSerializer: () => ({ dispose() {} }),
  withProgress: (_opts: unknown, task: (...a: unknown[]) => unknown) => Promise.resolve(task({}, {})),
};

export const workspace = {
  getConfiguration: () => ({
    get: () => undefined,
    update: () => Promise.resolve(undefined),
    has: () => false,
    inspect: () => undefined,
  }),
  workspaceFolders: undefined as unknown,
  openTextDocument: () => Promise.resolve({}),
  applyEdit: () => Promise.resolve(true),
  fs: { writeFile: () => Promise.resolve(undefined), readFile: () => Promise.resolve(undefined) },
};

export const env = {
  openExternal: () => Promise.resolve(true),
  clipboard: { writeText: () => Promise.resolve(undefined) },
  language: 'en',
  machineId: 'test',
  sessionId: 'test',
};

export const commands = {
  registerCommand: () => ({ dispose() {} }),
  executeCommand: () => Promise.resolve(undefined),
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export const ProgressLocation = { Notification: 15, Window: 10, SourceControl: 1 };
export const SymbolKind = {} as Record<string, number>;
export const ViewColumn = { One: 1 } as Record<string, number>;
export type OutputChannel = { appendLine(s: string): void; append(s: string): void; show(): void; dispose(): void };
export type Disposable = { dispose(): void };
export type Webview = unknown;
export type WebviewPanel = unknown;
export type WebviewView = unknown;
export type ExtensionContext = unknown;
export type CancellationToken = unknown;
export type WebviewViewResolveContext = unknown;
export type WebviewViewProvider = unknown;
export type DocumentSymbol = unknown;
export type SymbolInformation = unknown;
