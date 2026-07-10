/**
 * Episodic Memory Layer (Phase 2.3)
 *
 * Stores specific events (episodes) with simple in-memory vector embeddings
 * and time-based decay. Designed to be swappable for a real vector DB later.
 */

import { cosineSimilarity } from './vectorUtils';

export interface Episode {
  id: string;
  timestamp: number;
  type: EpisodeType;
  data: Record<string, unknown>;
  importance: number; // 0.0 - 1.0
  embedding?: number[];
}

export type EpisodeType =
  | 'intake'
  | 'research'
  | 'planning'
  | 'build'
  | 'audit'
  | 'security'
  | 'verify'
  | 'deliver'
  | 'agent_status'
  | 'error'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'phase_transition'
  | 'artifact_created'
  | 'verification'
  | 'custom';

export interface EpisodeQuery {
  query: string;
  limit?: number;
  minImportance?: number;
  types?: EpisodeType[];
}

export interface SearchResult {
  episode: Episode;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function decayScore(baseImportance: number, ageMs: number, halfLifeMs: number): number {
  return baseImportance * Math.exp((-ageMs * Math.LN2) / halfLifeMs);
}

/**
 * Simple in-memory embedding model based on term frequency vectors.
 * Swap with an external embedding model or vector DB in Phase 3.
 */
class InMemoryEmbeddingModel {
  private vocabulary: Map<string, number> = new Map();
  private nextId = 0;

  private ensureTokens(tokens: string[]): number[] {
    const indices = tokens.map((t) => {
      let id = this.vocabulary.get(t);
      if (id === undefined) {
        id = this.nextId++;
        this.vocabulary.set(t, id);
      }
      return id;
    });
    const vec = new Array(this.nextId).fill(0);
    for (const idx of indices) {
      vec[idx] += 1;
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= Math.sqrt(norm);
    }
    return vec;
  }

  embed(text: string): number[] {
    return this.ensureTokens(tokenize(text));
  }

  ensureConsistent(text: string, existingDim: number): number[] {
    const raw = tokenize(text);
    const indices = raw.map((t) => {
      let id = this.vocabulary.get(t);
      if (id === undefined) {
        id = this.nextId++;
        this.vocabulary.set(t, id);
      }
      return id;
    });
    const vec = new Array(existingDim).fill(0);
    for (const idx of indices) {
      if (idx < vec.length) vec[idx] += 1;
    }
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= Math.sqrt(norm);
    }
    return vec;
  }

  getDimension(): number {
    return this.nextId;
  }
}

export class EpisodicMemory {
  private episodes: Map<string, Episode> = new Map();
  private embeddingModel: InMemoryEmbeddingModel;
  private halfLifeMs: number;

  constructor(options?: { halfLifeMs?: number }) {
    this.embeddingModel = new InMemoryEmbeddingModel();
    this.halfLifeMs = options?.halfLifeMs ?? 24 * 60 * 60 * 1000; // 24h default
  }

  add(episode: Omit<Episode, 'id' | 'timestamp' | 'embedding'>): Episode {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = Date.now();
    const text = JSON.stringify(episode.data);
    const embedding = this.embeddingModel.embed(text);
    const full: Episode = { ...episode, id, timestamp, embedding };
    this.episodes.set(id, full);
    return full;
  }

  get(id: string): Episode | undefined {
    return this.episodes.get(id);
  }

  remove(id: string): boolean {
    return this.episodes.delete(id);
  }

  getAll(): Episode[] {
    return Array.from(this.episodes.values());
  }

  getByType(type: EpisodeType): Episode[] {
    return this.getAll().filter((e) => e.type === type);
  }

  search(query: string, limit = 10, minImportance = 0): SearchResult[] {
    const qVec = this.embeddingModel.embed(query);
    const now = Date.now();
    const results: SearchResult[] = [];

    for (const episode of this.episodes.values()) {
      if (episode.importance < minImportance) continue;
      let score = 0;
      if (episode.embedding && episode.embedding.length === qVec.length) {
        score = cosineSimilarity(qVec, episode.embedding);
      } else if (episode.embedding) {
        const aligned = this.embeddingModel.ensureConsistent(
          JSON.stringify(episode.data),
          qVec.length
        );
        score = cosineSimilarity(qVec, aligned);
      }
      score *= decayScore(episode.importance, now - episode.timestamp, this.halfLifeMs);
      if (score > 0) {
        results.push({ episode, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  applyDecay(): void {
    const now = Date.now();
    for (const episode of this.episodes.values()) {
      episode.importance = decayScore(episode.importance, now - episode.timestamp, this.halfLifeMs);
    }
  }

  clear(): void {
    this.episodes.clear();
    this.embeddingModel = new InMemoryEmbeddingModel();
  }

  size(): number {
    return this.episodes.size;
  }
}
