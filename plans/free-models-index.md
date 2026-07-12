# Free Tier LLM Index

## Models

| Model | Provider | Price | Context Window | Benchmark Scores (MMLU, GSM-8K, HumanEval, MT-Bench) | Role Suitability |
|-------|----------|-------|----------------|------------------------------------------------------|------------------|
| google/gemma-3-4b-it:free | openrouter | Free | 8192 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| meta-llama/llama-3.2-3b-instruct:free | openrouter | Free | 131072 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| tencent/hy3:free | kilo-gateway | Free | 262144 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| stepfun/step-3.7-flash:free | kilo-gateway | Free | 262144 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| nvidia/nemotron-3-ultra-550b-a55b:free | kilo-gateway | Free | 1000000 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | Orchestrator, Complex |
| nvidia/nemotron-3-super-120b-a12b:free | kilo-gateway | Free | 1000000 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | kilo-gateway | Free | 256000 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| poolside/laguna-m.1:free | kilo-gateway | Free | 262144 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | Coder, Complex |
| poolside/laguna-xs-2.1:free | kilo-gateway | Free | 262144 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | Coder |
| cohere/north-mini-code:free | kilo-gateway | Free | 256000 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | Coder |
| nvidia/nemotron-3.5-content-safety:free | kilo-gateway | Free | 128000 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | Guardrail |
| kilo-auto/free | kilo-gateway | Free | 256000 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| codik-free | codik | Free | 131072 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |
| llama3.2 | ollama | Free | 32768 tokens | MMLU: —, GSM-8K: —, HumanEval: —, MT-Bench: — | All roles |

## Notes
- Prices are indicated as "Free" for free tier usage.
- **All model IDs in this table are verified against `https://api.kilo.ai/api/gateway/models` (the kilo-gateway model-list endpoint) as of 2026-07-11.** Earlier versions listed IDs that do not exist on the gateway (e.g. `nousresearch/hermes-3-405b-instruct:free`, `nvidia/nemotron-3-ultra:free`, `kilo/code:free`, `google/gemma-4-*`, `openai/gpt-oss-20b:free`) — those returned HTTP 400 `not a valid model ID`.
- Benchmark columns are intentionally left as `—` (parsed to 0) because the previous numeric values were fabricated/approximate and not tied to the real models. Re-populate only with verified public benchmark numbers.
- Context window sizes are taken from the gateway's `context_length` field (e.g. Step 3.7 Flash & Hy3 = 256K/262K, Nemotron 3 Super/Ultra = 1M, Nemotron 3.5 Content Safety = 128K).
- `kilo-auto/free` is a router that rotates among available free models; it is listed for fallback use.
- Local `ollama` models (e.g. llama3.2) are listed conservatively (32K) because Ollama's default `num_ctx` is typically far below the model's architectural limit; raise it only if you configure a larger `num_ctx`.
- Role suitability is based on model descriptions from the gateway.
