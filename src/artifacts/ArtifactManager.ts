import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import type { FileArtifact } from '../../shared/types';

export interface ArtifactMeta {
  filePath: string;
  contentHash: string;
  timestamp: number;
  tags: string[];
  type: string;
  preview: string; // first N chars of content
}

export interface ArtifactManagerConfig {
  /** Write .meta.json sidecar files alongside artifacts. Default: true */
  sidecarEnabled: boolean;
  /** Length of preview excerpt stored in metadata. Default: 120 */
  previewLength: number;
  /** Sync symbol names into semantic memory after save. Default: false */
  enableSemanticSync: boolean;
}

export interface ArtifactSearchOptions {
  type?: string;
  tag?: string;
  limit?: number;
}

export class ArtifactManager {
  private index: Map<string, ArtifactMeta> = new Map();
  private cfg: ArtifactManagerConfig;

  constructor(
    private workspaceRoot: string,
    config?: Partial<ArtifactManagerConfig>
  ) {
    this.cfg = {
      sidecarEnabled: true,
      previewLength: 120,
      enableSemanticSync: false,
      ...config,
    };
    this._loadSidecars();
  }

  // ─── Core write (legacy compat) ───────────────────────────────────────────

  writeArtifact(artifact: FileArtifact): void {
    const full = path.join(this.workspaceRoot, artifact.filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, artifact.content, 'utf-8');
    // Index silently (tags/type unknown here — use storeArtifact for full metadata)
    this._indexEntry(artifact.filePath, artifact.content, [], 'unknown');
  }

  // ─── Enhanced write with metadata ─────────────────────────────────────────

  /**
   * Write artifact to disk and record its metadata for search.
   */
  storeArtifact(
    artifact: FileArtifact,
    opts: { tags?: string[]; type?: string } = {}
  ): ArtifactMeta {
    const full = path.join(this.workspaceRoot, artifact.filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, artifact.content, 'utf-8');
    const meta = this._indexEntry(
      artifact.filePath,
      artifact.content,
      opts.tags ?? [],
      opts.type ?? this._inferType(artifact.filePath)
    );
    return meta;
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  /**
   * Search indexed artifacts by file path, tags, type, or preview snippet.
   * Returns an empty array when nothing matches (never null).
   */
  searchArtifacts(query: string, opts: ArtifactSearchOptions = {}): ArtifactMeta[] {
    const queryLower = (query ?? '').toLowerCase();
    const limit = opts.limit ?? 10;

    const scored: Array<{ meta: ArtifactMeta; score: number }> = [];

    for (const meta of this.index.values()) {
      if (opts.type && meta.type !== opts.type) continue;
      if (opts.tag && !meta.tags.includes(opts.tag)) continue;

      let score = 0;
      const haystack = [meta.filePath, ...meta.tags, meta.type, meta.preview]
        .join(' ')
        .toLowerCase();

      const words = queryLower.split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (haystack.includes(w)) score++;
      }

      if (score > 0 || queryLower === '') scored.push({ meta, score });
    }

    scored.sort((a, b) => b.score - a.score || b.meta.timestamp - a.meta.timestamp);
    return scored.slice(0, limit).map((s) => s.meta);
  }

  /**
   * Read artifact content from disk (returns null on error).
   */
  getArtifact(filePath: string): string | null {
    try {
      const full = path.join(this.workspaceRoot, filePath);
      return fs.readFileSync(full, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Get metadata entry for a specific path.
   */
  getMeta(filePath: string): ArtifactMeta | undefined {
    return this.index.get(filePath);
  }

  // ─── VS Code helpers ──────────────────────────────────────────────────────

  async openInEditor(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(path.join(this.workspaceRoot, filePath));
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  listGenerated(): string[] {
    const genDir = path.join(this.workspaceRoot, 'generated');
    if (!fs.existsSync(genDir)) return [];
    const files: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
        else files.push(`generated/${rel}`);
      }
    };
    walk(genDir, '');
    return files;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private _indexEntry(
    filePath: string,
    content: string,
    tags: string[],
    type: string
  ): ArtifactMeta {
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const preview = content.slice(0, this.cfg.previewLength).replace(/\s+/g, ' ');
    const meta: ArtifactMeta = {
      filePath,
      contentHash,
      timestamp: Date.now(),
      tags,
      type,
      preview,
    };
    this.index.set(filePath, meta);
    if (this.cfg.sidecarEnabled) {
      this._writeSidecar(filePath, meta);
    }
    return meta;
  }

  private _writeSidecar(filePath: string, meta: ArtifactMeta): void {
    try {
      const sidecarPath = path.join(this.workspaceRoot, filePath + '.meta.json');
      fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
      fs.writeFileSync(sidecarPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Non-fatal: sidecar write failure does not break core functionality
    }
  }

  private _loadSidecars(): void {
    try {
      const genDir = path.join(this.workspaceRoot, 'generated');
      if (!fs.existsSync(genDir)) return;
      this._walkForSidecars(genDir);
    } catch {
      // On first run: no sidecars yet
    }
  }

  private _walkForSidecars(dir: string): void {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this._walkForSidecars(full);
        } else if (entry.name.endsWith('.meta.json')) {
          try {
            const raw = fs.readFileSync(full, 'utf-8');
            const meta: ArtifactMeta = JSON.parse(raw);
            if (meta.filePath) {
              this.index.set(meta.filePath, meta);
            }
          } catch {
            // Skip corrupt sidecar
          }
        }
      }
    } catch {
      // Directory may not be readable
    }
  }

  private _inferType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const typeMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      json: 'json',
      md: 'markdown',
      py: 'python',
      yaml: 'yaml',
      yml: 'yaml',
      sh: 'shell',
      html: 'html',
      css: 'css',
    };
    return typeMap[ext] ?? ext ?? 'unknown';
  }

  /** Clear in-memory index (does not delete sidecar files). */
  clearIndex(): void {
    this.index.clear();
  }
}
