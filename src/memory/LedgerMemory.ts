import type { LedgerEntry } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

export class LedgerMemory {
  private entries: LedgerEntry[] = [];
  private ledgerFilePath: string;

  constructor(workspaceRoot: string) {
    this.ledgerFilePath = path.join(workspaceRoot, '.omniflow', 'ledger.jsonl');
    const dir = path.dirname(this.ledgerFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.load();
  }

  append(entry: Omit<LedgerEntry, 'timestamp'>): void {
    const full: LedgerEntry = { ...entry, timestamp: Date.now() };
    this.entries.push(full);
    fs.appendFileSync(this.ledgerFilePath, JSON.stringify(full) + '\n', 'utf-8');
  }

  getEntries(): LedgerEntry[] {
    return [...this.entries];
  }

  getLedgerPath(): string {
    return this.ledgerFilePath;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.ledgerFilePath)) return;
      const lines = fs.readFileSync(this.ledgerFilePath, 'utf-8').split('\n').filter(Boolean);
      this.entries = lines.map((l) => JSON.parse(l));
    } catch {
      this.entries = [];
    }
  }
}
