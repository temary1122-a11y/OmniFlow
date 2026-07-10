import * as vscode from 'vscode';
import * as path from 'path';
import type { SymbolLocation, SymbolResolveResult } from '../../shared/types';

export class SymbolResolver {
  constructor(private workspaceRoot: string) {}

  async resolveSymbol(file: string, symbolName: string): Promise<SymbolResolveResult> {
    try {
      const uri = this.resolveWorkspaceUri(file);
      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[] | vscode.SymbolInformation[]
      >('vscode.executeDocumentSymbolProvider', uri);

      if (!symbols || symbols.length === 0) {
        return { found: false, symbolName, reason: 'No symbols found in file' };
      }

      const docSymbol = this.findExactDocumentSymbol(symbols as vscode.DocumentSymbol[], symbolName);
      if (docSymbol) {
        return {
          found: true,
          symbolName,
          location: {
            uri: uri.fsPath,
            range: this.toRange(docSymbol.range),
            kind: vscode.SymbolKind[docSymbol.kind] ?? undefined,
          },
        };
      }

      const symInfo = this.findExactSymbolInformation(symbols as vscode.SymbolInformation[], symbolName);
      if (symInfo) {
        return {
          found: true,
          symbolName,
          location: {
            uri: symInfo.location.uri.fsPath,
            range: this.toRange(symInfo.location.range),
            containerName: symInfo.containerName,
            kind: symInfo.kind ? vscode.SymbolKind[symInfo.kind] ?? undefined : undefined,
          },
        };
      }

      return { found: false, symbolName, reason: `Symbol "${symbolName}" not found in ${file}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { found: false, symbolName, reason: `LSP query failed: ${message}` };
    }
  }

  private resolveWorkspaceUri(file: string): vscode.Uri {
    if (file.includes(':')) {
      return vscode.Uri.file(file);
    }
    if (file.startsWith('/') || file.startsWith('\\')) {
      return vscode.Uri.file(file);
    }
    return vscode.Uri.file(path.join(this.workspaceRoot, file));
  }

  private findExactDocumentSymbol(symbols: vscode.DocumentSymbol[], name: string): vscode.DocumentSymbol | undefined {
    for (const s of symbols) {
      if (s.name === name) return s;
      const child = this.findExactDocumentSymbol(s.children, name);
      if (child) return child;
    }
    return undefined;
  }

  private findExactSymbolInformation(symbols: vscode.SymbolInformation[], name: string): vscode.SymbolInformation | undefined {
    return symbols.find(s => s.name === name);
  }

  private toRange(range: vscode.Range): SymbolLocation['range'] {
    return {
      startLine: range.start.line,
      startColumn: range.start.character,
      endLine: range.end.line,
      endColumn: range.end.character,
    };
  }
}