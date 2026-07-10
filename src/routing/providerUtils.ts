import type { Provider } from './ModelRouter';

/** Canonical chat-completion endpoints (single source of truth). */
export const PROVIDER_CHAT_ENDPOINTS: Record<Exclude<Provider, 'fallback'>, string> = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  'kilo-gateway': 'https://api.kilo.ai/api/gateway/chat/completions',
  codik: 'https://api.codik.ai/v1/chat/completions',
  ollama: 'http://localhost:11434/v1/chat/completions',
};

/** Canonical model-list endpoints for ModelIndexer. */
export const PROVIDER_MODEL_LIST_ENDPOINTS: Record<'openrouter' | 'kilo-gateway' | 'codik', string> = {
  openrouter: 'https://openrouter.ai/api/v1/models',
  'kilo-gateway': 'https://api.kilo.ai/api/gateway/models',
  codik: 'https://api.codik.ai/v1/models',
};

export const PROVIDER_API_KEY_ENV: Record<'openrouter' | 'kilo-gateway' | 'codik', string> = {
  openrouter: 'OPENROUTER_API_KEY',
  'kilo-gateway': 'KILO_API_KEY',
  codik: 'CODIK_API_KEY',
};

export function getChatEndpoint(provider: string): string {
  return PROVIDER_CHAT_ENDPOINTS[provider as keyof typeof PROVIDER_CHAT_ENDPOINTS]
    ?? PROVIDER_CHAT_ENDPOINTS.openrouter;
}

export function hasProviderKey(provider: Provider, apiKeys: Record<string, string>): boolean {
  if (provider === 'ollama') return true;
  if (provider === 'fallback') return false;
  return Boolean(apiKeys[provider]?.trim());
}
