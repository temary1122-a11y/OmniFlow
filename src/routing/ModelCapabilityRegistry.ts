import * as fs from 'fs';
import * as path from 'path';

export interface ModelCapability {
  modelId: string;
  provider: string;
  price: string;
  contextWindow: number;
  benchmarks: {
    mmlu: number;
    gsm8k: number;
    humanEval: number;
    mtBench: number;
  };
  roleSuitability: string[];
}

export interface ModelCapabilityRegistry {
  getModels(): ModelCapability[];
  getModel(modelId: string): ModelCapability | undefined;
  getModelsByProvider(provider: string): ModelCapability[];
  getModelsByRole(role: string): ModelCapability[];
  getBestModelForRole(role: string): ModelCapability | undefined;
  getBestModelForComplexity(complexity: 'simple' | 'medium' | 'complex'): ModelCapability | undefined;
  addModels(models: ModelCapability[]): void;
}

export class FreeModelCapabilityRegistry implements ModelCapabilityRegistry {
  private models: ModelCapability[] = [];
  private indexFilePath: string = '';

  constructor(workspaceRoot?: string) {
    // Try to find free-models-index.md in plans directory
    const possiblePaths = [
      path.join(process.cwd(), 'plans', 'free-models-index.md'),
      workspaceRoot ? path.join(workspaceRoot, 'plans', 'free-models-index.md') : '',
      // Bundled index lives at repo root plans/ (ModelCapabilityRegistry compiles to
      // dist/src/routing/, so ../../ is dist/ and ../../../ is the repo root).
      path.join(__dirname, '..', '..', 'plans', 'free-models-index.md'),
      path.join(__dirname, '..', '..', '..', 'plans', 'free-models-index.md'),
    ].filter(Boolean);

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        this.indexFilePath = filePath;
        this.load();
        break;
      }
    }

    if (!this.indexFilePath) {
      console.warn('FreeModelCapabilityRegistry: free-models-index.md not found, using empty registry');
      this.indexFilePath = possiblePaths[0] || '';
    }
  }

  private load(): void {
    try {
      const content = fs.readFileSync(this.indexFilePath, 'utf-8');
      this.models = this.parseMarkdown(content);
      console.log(`FreeModelCapabilityRegistry: loaded ${this.models.length} models from ${this.indexFilePath}`);
    } catch (error) {
      console.error(`FreeModelCapabilityRegistry: failed to load ${this.indexFilePath}:`, error);
      this.models = [];
    }
  }

  private parseMarkdown(content: string): ModelCapability[] {
    const models: ModelCapability[] = [];
    const lines = content.split('\n');
    
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect table header
      if (line.startsWith('|') && line.includes('Model')) {
        inTable = true;
        continue;
      }
      
      // Skip separator line
      if (inTable && line.startsWith('|') && line.includes('---')) {
        continue;
      }
      
      // Parse table row
      if (inTable && line.startsWith('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 6) {
          const model: ModelCapability = {
            modelId: parts[0],
            provider: parts[1],
            price: parts[2],
            contextWindow: this.parseContextWindow(parts[3]),
            benchmarks: this.parseBenchmarks(parts[4]),
            roleSuitability: this.parseRoleSuitability(parts[5]),
          };
          models.push(model);
        }
      }
      
      // End of table
      if (inTable && !line.startsWith('|') && line) {
        inTable = false;
      }
    }
    
    return models;
  }

  private parseContextWindow(str: string): number {
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 8192;
  }

  private parseBenchmarks(str: string): { mmlu: number; gsm8k: number; humanEval: number; mtBench: number } {
    const benchmarks = { mmlu: 0, gsm8k: 0, humanEval: 0, mtBench: 0 };
    
    const mmluMatch = str.match(/MMLU:\s*([\d.]+)/);
    if (mmluMatch) benchmarks.mmlu = parseFloat(mmluMatch[1]);
    
    const gsm8kMatch = str.match(/GSM-8K:\s*([\d.]+)/);
    if (gsm8kMatch) benchmarks.gsm8k = parseFloat(gsm8kMatch[1]);
    
    const humanEvalMatch = str.match(/HumanEval:\s*([\d.]+)/);
    if (humanEvalMatch) benchmarks.humanEval = parseFloat(humanEvalMatch[1]);
    
    const mtBenchMatch = str.match(/MT-Bench:\s*([\d.]+)/);
    if (mtBenchMatch) benchmarks.mtBench = parseFloat(mtBenchMatch[1]);
    
    return benchmarks;
  }

  private parseRoleSuitability(str: string): string[] {
    return str.split(',').map((r) => {
      const t = r.trim().toLowerCase();
      if (t === 'all roles' || t === 'all') return 'all';
      return r.trim();
    }).filter(Boolean);
  }

  getModels(): ModelCapability[] {
    return [...this.models];
  }

  getFreeModelsGroupedByProvider(): Record<string, ModelCapability[]> {
    const freeModels = this.models.filter((m) => m.price.toLowerCase() === 'free');
    return freeModels.reduce<Record<string, ModelCapability[]>>((acc, m) => {
      const key = m.provider.toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});
  }

  addModels(models: ModelCapability[]): void {
    for (const m of models) {
      const idx = this.models.findIndex((x) => x.modelId === m.modelId);
      if (idx >= 0) this.models[idx] = m; else this.models.push(m);
    }
  }

  getModel(modelId: string): ModelCapability | undefined {
    return this.models.find(m => m.modelId === modelId);
  }

  getModelsByProvider(provider: string): ModelCapability[] {
    return this.models.filter(m => m.provider.toLowerCase() === provider.toLowerCase());
  }

  getModelsByRole(role: string): ModelCapability[] {
    const roleLower = role.toLowerCase();
    return this.models.filter(m =>
      m.roleSuitability.some((r) => {
        const rl = r.toLowerCase();
        return rl === roleLower || rl === 'all';
      })
    );
  }

  getBestModelForRole(role: string): ModelCapability | undefined {
    const roleModels = this.getModelsByRole(role);
    if (roleModels.length === 0) return undefined;
    
    // Sort by MT-Bench score (overall quality)
    return roleModels.sort((a, b) => b.benchmarks.mtBench - a.benchmarks.mtBench)[0];
  }

  getBestModelForComplexity(complexity: 'simple' | 'medium' | 'complex'): ModelCapability | undefined {
    // For simple tasks: prefer faster models (lower context window, decent benchmarks)
    // For medium tasks: balanced approach
    // For complex tasks: highest benchmarks
    
    const sortedModels = [...this.models].sort((a, b) => {
      const aScore = this.calculateComplexityScore(a, complexity);
      const bScore = this.calculateComplexityScore(b, complexity);
      return bScore - aScore;
    });
    
    return sortedModels[0];
  }

  private calculateComplexityScore(model: ModelCapability, complexity: string): number {
    const baseScore = (model.benchmarks.mmlu + model.benchmarks.gsm8k + model.benchmarks.humanEval + model.benchmarks.mtBench) / 4;
    
    if (complexity === 'simple') {
      // Prefer smaller context windows (faster) for simple tasks
      return baseScore * 0.5 + (10000 / model.contextWindow) * 0.5;
    } else if (complexity === 'medium') {
      // Balanced approach
      return baseScore * 0.7 + (10000 / model.contextWindow) * 0.3;
    } else {
      // For complex tasks, prioritize quality
      return baseScore;
    }
  }

  reload(): void {
    this.load();
  }
}
