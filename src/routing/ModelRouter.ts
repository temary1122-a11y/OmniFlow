import type { Phase, Complexity, AgentRole } from '../../shared/types';
import { LLMClient, type LLMResponse } from './LLMClient';
import { FreeModelCapabilityRegistry, type ModelCapabilityRegistry } from './ModelCapabilityRegistry';
import { RequestClassifier } from './RequestClassifier';
import { ModelSelector } from './ModelSelector';
import type { RouterHealthMonitor } from '../core/RouterHealthMonitor';
import { hasProviderKey } from './providerUtils';

export type Provider = 'kilo-gateway' | 'openrouter' | 'codik' | 'ollama' | 'fallback';

export interface ModelSelection {
  provider: Provider;
  modelId: string;
  costTier: 'free' | 'cheap' | 'mid' | 'premium';
  maxTokens: number;
}

export interface RoutingRequest {
  phase: Phase;
  agentRole: AgentRole;
  complexity: Complexity;
  budget?: 'free' | 'low' | 'normal' | 'high';
}

const OPENROUTER_MODELS: Partial<Record<AgentRole, string>> = {};
const KILO_MODELS: Partial<Record<AgentRole, string>> = {};
const CODIK_MODELS: Partial<Record<AgentRole, string>> = {};
const OLLAMA_MODELS: Partial<Record<AgentRole, string>> = {};

const PROVIDER_MODELS: Record<Provider, Partial<Record<AgentRole, string>>> = {
  openrouter: OPENROUTER_MODELS,
  'kilo-gateway': KILO_MODELS,
  codik: CODIK_MODELS,
  ollama: OLLAMA_MODELS,
  fallback: {},
};

export class ModelRouter {
  private budget: 'free' | 'low' | 'normal' | 'high' = 'free';
  private preferredProvider: Provider = 'openrouter';
  private client = new LLMClient();
  private apiKeys: Record<string, string> = {};
  private capabilityRegistry: ModelCapabilityRegistry;
  private requestClassifier: RequestClassifier;
  private modelSelector: ModelSelector;
  private enableSmartRouting: boolean = true;
  private totalCost: number = 0;
  private totalSavings: number = 0;
  private customOrchestratorModel: string = '';
  /** Per-role model overrides from user config; checked before the registry. */
  private roleModels: Partial<Record<AgentRole, string>> = {};
  /** When true (e.g. credits exhausted), force free-tier models only across all providers. */
  private freeOnly: boolean = false;
  private healthMonitor?: RouterHealthMonitor;
  
  // Rate limiting
  private callTimestamps: Map<Provider, number[]> = new Map();
  private rateLimitWindowMs = 60000; // 1 minute window
  private maxCallsPerWindow = 30; // 30 calls per minute per provider

  constructor(budget?: 'free' | 'low' | 'normal' | 'high', workspaceRoot?: string, healthMonitor?: RouterHealthMonitor) {
    if (budget) this.budget = budget;

    this.healthMonitor = healthMonitor;

    // Initialize smart routing components
    this.capabilityRegistry = new FreeModelCapabilityRegistry(workspaceRoot);
    this.requestClassifier = new RequestClassifier();
    this.modelSelector = new ModelSelector(this.capabilityRegistry, {
      budget: this.budget,
      preferredProvider: this.preferredProvider,
      enableFallback: true,
      maxFallbackDepth: 3,
    });
  }

  getResolvedProvider(apiKeys?: Record<string, string>): Provider {
    return this.resolveProvider(apiKeys ?? this.apiKeys);
  }

  setHealthMonitor(hm: RouterHealthMonitor): void {
    this.healthMonitor = hm;
  }

  route(
    request: RoutingRequest,
    apiKeys?: Record<string, string>,
    prompt?: string,
    forceProvider?: string,
    forcedSelection?: ModelSelection
  ): ModelSelection {
    if (forcedSelection) return forcedSelection;

    const keys = apiKeys ?? this.apiKeys;

    // If forceProvider is provided, use it directly (from ResilientModelRouter)
    // This takes priority over smart routing
    if (forceProvider) {
      console.log('[ModelRouter] Using forced provider:', forceProvider);
      const modelId = this.getModelForRole(request.agentRole, forceProvider as any, request.budget ?? this.budget);
      if (!modelId) {
        throw new Error(`No model available for role ${request.agentRole} on provider ${forceProvider}. Please configure models in settings.`);
      }
      const maxTokens = request.agentRole === 'coder' ? 4000 : 3500;
      return { provider: forceProvider as any, modelId, costTier: this.budget === 'free' ? 'free' : 'cheap', maxTokens };
    }

    // Use smart routing if enabled and prompt is provided
    if (this.enableSmartRouting && prompt) {
      try {
        const classification = this.requestClassifier.classify(prompt);
        const selection = this.modelSelector.select(
          classification,
          request.agentRole,
          this.getAvailableProviders()
        );

        // Track cost and savings
        this.totalCost += selection.estimatedCost;
        this.totalSavings += selection.estimatedSavings;

        return {
          provider: selection.provider,
          modelId: selection.modelId,
          costTier: selection.costTier,
          maxTokens: selection.maxTokens,
        };
      } catch (error) {
        console.warn('Smart routing failed, falling back to legacy routing:', error);
      }
    }

    // Legacy routing fallback
    const provider = this.resolveProvider(keys);
    const modelId = this.getModelForRole(request.agentRole, provider, request.budget ?? this.budget);
    if (!modelId) {
      throw new Error(`No model available for role ${request.agentRole} on provider ${provider}. Please configure models in settings.`);
    }
    const maxTokens = request.agentRole === 'coder' ? 4000 : 3500;

    return { provider, modelId, costTier: this.budget === 'free' ? 'free' : 'cheap', maxTokens };
  }

  private getModelForRole(
    role: AgentRole,
    provider: Provider,
    budget: 'free' | 'low' | 'normal' | 'high'
  ): string | undefined {
    // Effective budget: freeOnly (credits exhausted) overrides everything.
    const effectiveBudget: 'free' | 'low' | 'normal' | 'high' =
      this.freeOnly ? 'free' : budget;

    // Use custom orchestrator model if set and role is orchestrator
    if (role === 'orchestrator' && this.customOrchestratorModel) {
      console.log(`ModelRouter: Using custom orchestrator model: ${this.customOrchestratorModel}`);
      return this.customOrchestratorModel;
    }

    // Per-role override wins before registry lookup
    const roleOverride = this.roleModels[role];
    if (roleOverride) {
      console.log(`ModelRouter: Using role override for ${role}: ${roleOverride}`);
      return roleOverride;
    }

    // Kilo Gateway: drive selection from the indexed free-models registry instead of a
    // hardcoded single model. Returns undefined if no model is available.
    if (provider === 'kilo-gateway') {
      if (effectiveBudget === 'high') return 'gpt-4o';
      if (effectiveBudget === 'normal' || effectiveBudget === 'low') return 'gpt-4o-mini';
      const indexed = this.selectFreeModelForProvider('kilo-gateway', role);
      return indexed;
    }

    // Prefer a registry-indexed free model for this role+provider (populated by
    // ModelIndexer.syncModels / free-models-index.md). This is what actually wires
    // the model-index module into routing instead of the hardcoded table below.
    const indexed = this.selectFreeModelForProvider(provider, role);
    if (indexed) return indexed;

    const table = PROVIDER_MODELS[provider] ?? {};
    const roleModel = table[role];
    if (roleModel) return roleModel;

    return undefined; // No model available - caller should handle this
  }

  /**
   * Resolve the REAL context window (in tokens) of the model that would be selected
   * for the given role, using the indexed capability registry. This lets callers
   * (e.g. AgentRuntime) size their context budget per-model instead of using a single
   * conservative constant. Returns 0 when the model is unknown so callers can fall back.
   */
  getContextWindowForRole(role: AgentRole): number {
    try {
      const provider = this.resolveProvider(this.apiKeys);
      const modelId = this.getModelForRole(role, provider, this.budget);
      if (!modelId) return 0;
      const cap = this.capabilityRegistry.getModel(modelId);
      if (cap && cap.contextWindow > 0) return cap.contextWindow;
    } catch {
      // fall through
    }
    return 0;
  }

  /**
   * Return an ordered, deduped, health-aware list of candidate ModelSelection values
   * across providers for the given role. Dead models and permanently-unhealthy models
   * are excluded. Always ensures kilo-gateway stepfun and ollama llama3.2 are present
   * as safe fallbacks.
   */
  getCandidateChain(role: AgentRole): ModelSelection[] {
    const seen = new Set<string>();
    const candidates: ModelSelection[] = [];

    const add = (provider: Provider, modelId: string) => {
      const key = `${provider}:${modelId}`;
      if (seen.has(key)) return;
      if (this.healthMonitor && !this.healthMonitor.canAttempt(provider, modelId)) return;
      seen.add(key);
      candidates.push({
        provider,
        modelId,
        costTier: this.budget === 'free' ? 'free' : 'cheap',
        maxTokens: role === 'coder' ? 4000 : 3500,
      });
    };

    const registryOrder: Provider[] = [
      'openrouter',
      'kilo-gateway',
      'codik',
      'ollama',
      'fallback',
    ];

    // 1. Preferred provider hardcoded table FIRST, to honor the user's preferredProvider.
    if (this.preferredProvider !== 'fallback') {
      const pm = PROVIDER_MODELS[this.preferredProvider]?.[role];
      if (pm) add(this.preferredProvider, pm);
    }

    // 2. Capability registry indexed models
    for (const provider of registryOrder) {
      try {
        const indexed = this.selectFreeModelForProvider(provider, role);
        if (indexed) add(provider, indexed);
      } catch {
        // skip
      }
    }

    // 3. Other providers' hardcoded tables
    for (const provider of registryOrder) {
      if (provider === this.preferredProvider) continue;
      const model = PROVIDER_MODELS[provider]?.[role];
      if (model) add(provider, model);
    }

    // 4. Safe ultimate fallbacks (only ollama since it's local)
    add('ollama', 'llama3.2');

    return candidates;
  }

  /**
   * Pick a free model for a role from the indexed capability registry for ANY provider.
   * Returns undefined if the registry has no free model for that provider/role.
   */
  private selectFreeModelForProvider(provider: Provider, role: AgentRole): string | undefined {
    try {
      const candidates = this.capabilityRegistry
        .getModelsByProvider(provider)
        .filter((m) => m.price === 'Free' || m.price === 'free');
      if (candidates.length === 0) return undefined;
      const forRole = candidates.find((m) =>
        m.roleSuitability.some((r) => r.toLowerCase() === role.toLowerCase() || r.toLowerCase() === 'all')
      );
      return (forRole ?? candidates[0]).modelId;
    } catch {
      return undefined;
    }
  }

  private resolveProvider(apiKeys: Record<string, string>): Provider {
    const preferred =
      this.preferredProvider === 'fallback' ? 'openrouter' : this.preferredProvider;

    // First try preferred provider if it has a key
    if (hasProviderKey(preferred, apiKeys)) return preferred;

    // Keyed providers are the ones that genuinely require a credential. ollama
    // is keyless, so it should NOT hijack routing when no real key is present —
    // the documented behavior is to fall back to the preferred provider (which then
    // yields a clean offline fallback response) rather than silently targeting a
    // local model the user never asked for.
    const keyedProviders: Provider[] = ['kilo-gateway', 'openrouter', 'codik'];
    const anyKeyed = keyedProviders.some((p) => hasProviderKey(p, apiKeys));
    if (!anyKeyed) {
      console.warn(`ModelRouter: No provider has API key, falling back to ${preferred}`);
      return preferred;
    }

    // A keyed provider exists — switch to it (ollama stays available as a
    // last-resort when explicitly reachable).
    for (const p of [...keyedProviders, 'ollama'] as Provider[]) {
      if (hasProviderKey(p, apiKeys)) {
        console.log(`ModelRouter: Switching from preferred ${preferred} to ${p} (has API key)`);
        return p;
      }
    }

    // Fallback to preferred even without key (will trigger fallback response)
    console.warn(`ModelRouter: No provider has API key, falling back to ${preferred}`);
    return preferred;
  }

  setPreferredProvider(p: Provider): void {
    this.preferredProvider = p;
  }

  setBudget(b: 'free' | 'low' | 'normal' | 'high'): void {
    this.budget = b;
  }

  /** Merge externally-fetched models (e.g. from ModelIndexer) into the capability registry. */
  syncModels(models: import('./ModelCapabilityRegistry').ModelCapability[]): void {
    this.capabilityRegistry.addModels(models);
  }

  setCustomOrchestratorModel(model: string): void {
    this.customOrchestratorModel = model;
  }

  setApiKeys(keys: Record<string, string>): void {
    this.apiKeys = keys;
  }

  setSmartRouting(enabled: boolean): void {
    this.enableSmartRouting = enabled;
  }

  getAvailableProviders(): Provider[] {
    return ['openrouter', 'kilo-gateway', 'codik', 'ollama', 'fallback'];
  }

  async call(
    request: RoutingRequest,
    prompt: string,
    systemPrompt: string,
    apiKeys: Record<string, string>,
    forceProvider?: string,
    tools?: any[],
    forcedSelection?: ModelSelection
  ): Promise<LLMResponse> {
    const keys = Object.keys(apiKeys).length ? apiKeys : this.apiKeys;
    console.log('[ModelRouter] call', request.agentRole, request.phase, 'tools=' + Boolean(tools && tools.length));
    const selection = this.route(request, keys, prompt, forceProvider, forcedSelection);
    console.log('[ModelRouter] routed', selection.provider, selection.modelId);
    
    // Rate limiting check
    await this.waitForRateLimit(selection.provider);
    
    return this.client.complete(
      selection,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      keys,
      { agentRole: request.agentRole, phase: request.phase },
      tools
    );
  }

  /**
   * Called when a provider reports exhausted credits (HTTP 402 / "paid model" / "credits required").
   * Forces free-tier-only routing so the orchestrator keeps working on $0 budgets instead of
   * falling back to offline stubs.
   */
  markCreditsExhausted(): void {
    this.freeOnly = true;
    if (this.budget !== 'free') this.budget = 'free';
    this.modelSelector.updateConfig({ budget: 'free' });
    console.warn('[ModelRouter] Credits exhausted — switching to FREE-ONLY routing.');
  }

  isFreeOnly(): boolean {
    return this.freeOnly;
  }

  private async waitForRateLimit(provider: Provider): Promise<void> {
    const now = Date.now();
    const timestamps = this.callTimestamps.get(provider) || [];
    
    // Filter timestamps within the rate limit window
    const recentTimestamps = timestamps.filter(t => now - t < this.rateLimitWindowMs);
    
    // Update the map with filtered timestamps
    this.callTimestamps.set(provider, recentTimestamps);
    
    // If we've hit the rate limit, wait
    if (recentTimestamps.length >= this.maxCallsPerWindow) {
      const oldestTimestamp = recentTimestamps[0];
      const waitTime = this.rateLimitWindowMs - (now - oldestTimestamp);
      
      if (waitTime > 0) {
        console.log(`[ModelRouter] Rate limit reached for ${provider}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // After waiting, filter again and remove the oldest
        const newTimestamps = recentTimestamps.filter(t => Date.now() - t < this.rateLimitWindowMs);
        this.callTimestamps.set(provider, newTimestamps);
      }
    }
    
    // Record this call
    const currentTimestamps = this.callTimestamps.get(provider) || [];
    currentTimestamps.push(Date.now());
    this.callTimestamps.set(provider, currentTimestamps);
  }
}
