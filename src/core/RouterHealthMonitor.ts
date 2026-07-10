import { EventBus } from './EventBus';
import type { Provider } from '../routing/ModelRouter';

export interface HealthStatus {
  provider: Provider;
  modelId: string;
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
  rateLimitUntil?: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export class RouterHealthMonitor {
  private eventBus: EventBus;
  private config: CircuitBreakerConfig;
  private statuses: Map<string, HealthStatus> = new Map();
  private halfOpenCalls: Map<string, number> = new Map();

  constructor(eventBus: EventBus, config?: Partial<CircuitBreakerConfig>) {
    this.eventBus = eventBus;
    this.config = {
      failureThreshold: config?.failureThreshold ?? 3,
      resetTimeoutMs: config?.resetTimeoutMs ?? 60000,
      halfOpenMaxCalls: config?.halfOpenMaxCalls ?? 1,
    };
  }

  getKey(provider: Provider, modelId: string): string {
    return `${provider}:${modelId}`;
  }

  getStatus(provider: Provider, modelId: string): HealthStatus {
    const key = this.getKey(provider, modelId);
    if (!this.statuses.has(key)) {
      this.statuses.set(key, {
        provider,
        modelId,
        healthy: true,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        avgLatencyMs: 0,
        successRate: 1,
      });
    }
    return this.statuses.get(key)!;
  }

  getAllStatuses(): HealthStatus[] {
    return Array.from(this.statuses.values());
  }

  getHealthyProviders(): Provider[] {
    const healthyProviders = new Set<Provider>();
    for (const status of this.statuses.values()) {
      if (status.healthy && !this.isRateLimited(status)) {
        healthyProviders.add(status.provider);
      }
    }
    return Array.from(healthyProviders);
  }

  recordSuccess(provider: Provider, modelId: string, latencyMs: number): void {
    const status = this.getStatus(provider, modelId);
    status.consecutiveFailures = 0;
    status.healthy = true;
    status.lastCheck = Date.now();
    status.avgLatencyMs = (status.avgLatencyMs + latencyMs) / 2;
    status.successRate = Math.min(1, status.successRate + 0.1);
    this.halfOpenCalls.set(this.getKey(provider, modelId), 0);
  }

  recordFailure(provider: Provider, modelId: string, error: string): void {
    const status = this.getStatus(provider, modelId);
    status.consecutiveFailures++;
    status.lastCheck = Date.now();
    status.lastError = error;
    status.successRate = Math.max(0, status.successRate - 0.2);

    if (status.consecutiveFailures >= this.config.failureThreshold) {
      status.healthy = false;
      this.eventBus.emit({
        type: 'ERROR_OCCURRED',
        payload: {
          error: `Circuit breaker opened for ${provider}/${modelId}: ${error}`,
          phase: 'build',
          recoverable: true,
        },
      });
    }
  }

  /** Mark a provider/model permanently unhealthy for the rest of the run (e.g. HTTP 404 / "unavailable for free"). */
  markPermanentlyUnhealthy(provider: Provider, modelId: string, error: string): void {
    const status = this.getStatus(provider, modelId);
    status.consecutiveFailures = this.config.failureThreshold;
    status.healthy = false;
    status.lastError = error;
    status.rateLimitUntil = Date.now() + 24 * 60 * 60 * 1000; // effectively permanent for this run
    this.eventBus.emit({
      type: 'ERROR_OCCURRED',
      payload: {
        error: `Model ${provider}/${modelId} permanently disabled (${error})`,
        phase: 'build',
        recoverable: true,
      },
    });
  }

  recordRateLimit(provider: Provider, modelId: string, retryAfterMs: number): void {
    const status = this.getStatus(provider, modelId);
    status.rateLimitUntil = Date.now() + retryAfterMs;
    this.eventBus.emit({
      type: 'ERROR_OCCURRED',
      payload: {
        error: `Rate limited on ${provider}/${modelId}, retry after ${retryAfterMs}ms`,
        phase: 'build',
        recoverable: true,
      },
    });
  }

  isRateLimited(status: HealthStatus): boolean {
    return !!status.rateLimitUntil && Date.now() < status.rateLimitUntil;
  }

  canAttempt(provider: Provider, modelId: string): boolean {
    const status = this.getStatus(provider, modelId);
    const key = this.getKey(provider, modelId);

    if (this.isRateLimited(status)) {
      return false;
    }

    if (status.healthy) {
      return true;
    }

    // Half-open state: allow limited calls to test recovery
    const halfOpenCount = this.halfOpenCalls.get(key) || 0;
    if (halfOpenCount < this.config.halfOpenMaxCalls) {
      this.halfOpenCalls.set(key, halfOpenCount + 1);
      return true;
    }

    return false;
  }

  async checkHealth(provider: Provider, modelId: string): Promise<boolean> {
    const status = this.getStatus(provider, modelId);
    status.lastCheck = Date.now();

    // Simple health check: if we haven't recorded any failures, assume healthy
    if (status.consecutiveFailures === 0) {
      status.healthy = true;
      return true;
    }

    // Check if enough time has passed to reset circuit breaker
    if (!status.healthy && status.lastError) {
      const timeSinceFailure = Date.now() - status.lastCheck;
      if (timeSinceFailure > this.config.resetTimeoutMs) {
        status.consecutiveFailures = 0;
        status.healthy = true;
        status.lastError = undefined;
        this.halfOpenCalls.set(this.getKey(provider, modelId), 0);
        return true;
      }
    }

    return status.healthy;
  }

  reset(provider?: Provider, modelId?: string): void {
    if (provider && modelId) {
      const key = this.getKey(provider, modelId);
      this.statuses.delete(key);
      this.halfOpenCalls.delete(key);
    } else {
      this.statuses.clear();
      this.halfOpenCalls.clear();
    }
  }
}
