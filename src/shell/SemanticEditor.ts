import * as vscode from 'vscode';
import type { SemanticEditInput, SemanticEditResult, SymbolResolveResult } from '../../shared/types';
import { SymbolResolver } from '../vscode/SymbolResolver';

export class SemanticEditor {
  constructor(private workspaceRoot: string) {}

  async apply(input: SemanticEditInput): Promise<SemanticEditResult> {
    try {
      const resolver = new SymbolResolver(this.workspaceRoot);
      const resolved = await resolver.resolveSymbol(input.file, input.symbolName);

      if (!resolved.found || !resolved.location) {
        return {
          success: false,
          file: input.file,
          symbolName: input.symbolName,
          error: resolved.reason ?? 'Unknown resolution failure',
          symbolFound: false,
        };
      }

      const uri = vscode.Uri.file(resolved.location.uri);
      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(
        new vscode.Position(resolved.location.range.startLine, resolved.location.range.startColumn),
        new vscode.Position(resolved.location.range.endLine, resolved.location.range.endColumn)
      );

      edit.replace(uri, range, input.newCode);

      const success = await vscode.workspace.applyEdit(edit);
      return {
        success,
        file: input.file,
        symbolName: input.symbolName,
        oldRange: resolved.location.range,
        error: success ? undefined : 'WorkspaceEdit.applyEdit returned false',
        symbolFound: true,
        symbolLocation: resolved.location,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        file: input.file,
        symbolName: input.symbolName,
        error: message,
      };
    }
  }
}