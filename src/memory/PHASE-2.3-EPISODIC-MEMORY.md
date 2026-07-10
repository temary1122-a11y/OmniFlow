# Phase 2.3: Hierarchical Memory - Episodic Layer

## Overview

Phase 2.3 adds an **episodic memory layer** to Omni Harness. Episodic memory stores specific events (episodes) associated with timestamps, types, and importance scores. It includes simple in-memory vector embeddings for semantic retrieval and time-based decay for relevance adjustment.

## Files

- `src/memory/EpisodicMemory.ts` — episode storage with embedding and decay
- `src/memory/HierarchicalMemory.ts` — coordinator across memory layers
- `src/memory/WorkingMemory.ts` — extended to integrate with hierarchical memory
- `tests/memory/EpisodicMemory.test.ts` — unit tests

## Design Decisions

- **In-memory embeddings** using a simple bag-of-words / TF-L2 model. No external ML dependencies are required, and the model can be swapped for a real embedding server or vector DB later.
- **Time-based decay** uses exponential decay with a configurable half-life (default: 24 hours).
- **Backward compatibility** — existing `WorkingMemory` API remains unchanged; new methods are additive.

## Usage

### EpisodicMemory

```ts
import { EpisodicMemory, EpisodeType } from './memory/EpisodicMemory';

const episodic = new EpisodicMemory({ halfLifeMs: 12 * 60 * 60 * 1000 });

// Record an event
const episode = episodic.add({
  type: 'tool_result',
  data: { toolName: 'probe_search', success: true, output: '...' },
  importance: 0.7,
});

// Retrieve by id
const fetched = episodic.get(episode.id);

// Semantic search
const results = episodic.search('probe search results', 5);
for (const r of results) {
  console.log(r.score, r.episode.type, r.episode.data);
}

// Apply decay (recomputes relevance for old episodes)
episodic.applyDecay();
```

### HierarchicalMemory

```ts
import { HierarchicalMemory } from './memory/HierarchicalMemory';

const hm = new HierarchicalMemory({ retrievalLimit: 10 });

// Record into episodic layer
hm.recordEpisode('build', { action: 'created Button.tsx' }, 0.8);

// Selective retrieval
const results = hm.selectiveRetrieve('Button component');

// Access working memory as before
hm.workingMemory.setGoalPacket(goalPacket);

// Diagnostics
console.log(hm.getDiagnostics());
```

### WorkingMemory Extension

```ts
import { WorkingMemory } from './memory/WorkingMemory';
import { EpisodicMemory } from './memory/EpisodicMemory';

const wm = new WorkingMemory();
const episodic = new EpisodicMemory();
wm.setHierarchicalEpisodicMemory(episodic);

// Existing API unchanged
wm.setGoalPacket(goalPacket);
const goal = wm.getGoalPacket();

// New episodic methods
wm.recordEpisode('intake', { goal: goalPacket.goal }, 0.9);
const episodes = wm.searchEpisodes('goal', 5);
```

## Testing

```sh
npx tsx tests/memory/EpisodicMemory.test.ts
```

## Integration Points

Potential integration points with existing code:

- **AgentRuntime / agents** — call `workingMemory.recordEpisode(...)` at phase transitions and after tool results to build an event log.
- **EventBus / LedgerMemory** — episodes can mirror ledger events with richer retrieval semantics.
- **ContextGovernor (Phase 2.2)** — can use `selectiveRetrieve` to pull relevant historical episodes into the context window.

## Constraints

- `ModelRouter`, `TaskCompass`, `ResultCache`, `CodeIndex`, `ProbeWrapper` are untouched.
- `AgentRuntime`, `OmniOrchestrator` are not modified yet (integration can be done in subsequent phases).
