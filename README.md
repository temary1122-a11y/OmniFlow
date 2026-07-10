# Omni — AI Agent Orchestrator

VS Code extension that orchestrates a multi-agent pipeline to deliver MVP projects from plain-language goals.

## Quick Start (F5)

**Important:** open the correct folder so the debug configuration appears.

| What you open | Debug config visible? |
|---------------|----------------------|
| `Омни` (repo root) | **Launch Omni Extension** in `.vscode/launch.json` |
| `omniflow-extension` subfolder only | **Launch Omni Extension** in `omniflow-extension/.vscode/launch.json` |
| `omni.code-workspace` (recommended) | **Launch Omni Extension** (uses Omni Extension folder) |

### Steps

1. Open **`c:\Users\Admin\Desktop\Омни`** (root) **or** `omni.code-workspace`
2. Run `npm install` inside `omniflow-extension/`
3. Run and Debug (Ctrl+Shift+D) → select **Launch Omni Extension** → press **F5**
4. A new **Extension Development Host** window opens
5. In that window: Command Palette → **Omni: Open Cockpit**
6. Set API keys (recommended), enter a goal, click **Launch Orchestration**

### What you should see after F5

- A second VS Code window titled `[Extension Development Host]`
- Output panel **Omni LLM** logs each router call (`[API]` or `[FALLBACK]`)
- Cockpit badge shows provider (`openrouter (free)`) or `offline fallback (no API key)`
- Chat shows `LLM live API: researcher → openrouter/...` when keys work

## API Keys (optional but recommended)

Without API keys, Omni uses an **offline fallback** LLM (rule-based generation).

| Provider | Setting | Env var |
|----------|---------|---------|
| OpenRouter (free models) | `omni.openrouterApiKey` | `OPENROUTER_API_KEY` |
| Kilo Gateway | `omni.kiloGatewayApiKey` | `KILO_API_KEY` |
| Codik | `omni.codikApiKey` | `CODIK_API_KEY` |

Configure via **Omni: Configure API Keys** or VS Code Settings → Omni.

## Agent Pipeline

```
Orchestrator → Clarifier → Researcher → Planner → Coder(s) → Auditor → Security → Verifier → Deliver
```

## Cross-platform

Shell commands use Node `child_process` with platform detection (cmd/bash/sh) — no hardcoded PowerShell.

## Output

Generated artifacts land in `generated/` and metadata in `.omniflow/`.
