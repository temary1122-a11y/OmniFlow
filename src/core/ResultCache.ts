import * as crypto from 'crypto';

export interface CachedResult {
  key: string;
  result: any;
  timestamp: number;
  ttl: number;
  hitCount: number;
  toolName: string;
  argsHash: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  evictions: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number; // milliseconds
  enableFileInvalidation: boolean;
  enableStats: boolean;
}

export class ResultCache {
  private cache: Map<string, CachedResult>;
  private config: CacheConfig;
  private stats: CacheStats;
  private watchedFiles: Set<string>;
  private fileWatcher: any; // Will be initialized if file watching is enabled

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enableFileInvalidation: false,
      enableStats: true,
      ...config,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      evictions: 0,
    };
    this.watchedFiles = new Set();
  }

  private generateKey(toolName: string, args: any): string {
    const argsString = JSON.stringify(args);
    const hash = crypto.createHash('sha256').update(argsString).digest('hex');
    return `${toolName}:${hash}`;
  }

  private generateArgsHash(args: any): string {
    const argsString = JSON.stringify(args);
    return crypto.createHash('sha256').update(argsString).digest('hex');
  }

  get(toolName: string, args: any): any | null {
    const key = this.generateKey(toolName, args);
    const cached = this.cache.get(key);

    if (!cached) {
      if (this.config.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      if (this.config.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
        this.stats.totalEntries = this.cache.size;
      }
      return null;
    }

    // Cache hit
    if (this.config.enableStats) {
      this.stats.hits++;
      cached.hitCount++;
      this.updateHitRate();
    }

    return cached.result;
  }

  set(toolName: string, args: any, result: any, ttl?: number): void {
    const key = this.generateKey(toolName, args);
    const argsHash = this.generateArgsHash(args);

    const cached: CachedResult = {
      key,
      result,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL,
      hitCount: 0,
      toolName,
      argsHash,
    };

    // Evict if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, cached);

    if (this.config.enableStats) {
      this.stats.totalEntries = this.cache.size;
    }

    // Track files for invalidation
    if (this.config.enableFileInvalidation) {
      this.trackFilesInArgs(args);
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.hitCount === 0 && cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.config.enableStats) {
        this.stats.evictions++;
        this.stats.totalEntries = this.cache.size;
      }
    }
  }

  invalidate(toolName?: string, args?: any): void {
    if (toolName && args) {
      const key = this.generateKey(toolName, args);
      this.cache.delete(key);
    } else if (toolName) {
      // Invalidate all entries for this tool
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${toolName}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all
      this.cache.clear();
    }

    if (this.config.enableStats) {
      this.stats.totalEntries = this.cache.size;
    }
  }

  invalidateByFile(filePath: string): void {
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const [key, cached] of this.cache.entries()) {
      const argsString = JSON.stringify(cached.result);
      if (argsString.includes(normalizedPath) || argsString.includes(filePath)) {
        this.cache.delete(key);
      }
    }

    if (this.config.enableStats) {
      this.stats.totalEntries = this.cache.size;
    }
  }

  private trackFilesInArgs(args: any): void {
    const argsString = JSON.stringify(args);
    const filePattern = /(["'])([^"']+\.(ts|js|json|md|txt|py|yaml|yml|sh))\1/g;
    let match;

    while ((match = filePattern.exec(argsString)) !== null) {
      const filePath = match[2];
      this.watchedFiles.add(filePath);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: this.cache.size,
      evictions: 0,
    };
  }

  clear(): void {
    this.cache.clear();
    this.watchedFiles.clear();
    if (this.config.enableStats) {
      this.stats.totalEntries = 0;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  getSize(): number {
    return this.cache.size;
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getEntries(): CachedResult[] {
    return Array.from(this.cache.values());
  }

  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
        pruned++;
      }
    }

    if (this.config.enableStats) {
      this.stats.totalEntries = this.cache.size;
    }

    return pruned;
  }
}
