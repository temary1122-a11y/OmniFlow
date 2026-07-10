[
  {
    "modelId": "meta-llama/llama-3.1-8b-instruct:free",
    "provider": "openrouter",
    "price": "free",
    "contextWindow": 8192,
    "benchmarks": {
      "mmlu": 60.0,
      "gsm8k": 75.0,
      "humanEval": 35.0,
      "mtBench": 6.5
    },
    "roleSuitability": ["orchestrator", "auditor", "security", "verifier"]
  },
  {
    "modelId": "meta-llama/llama-3.2-3b-instruct:free",
    "provider": "openrouter",
    "price": "free",
    "contextWindow": 8192,
    "benchmarks": {
      "mmlu": 55.0,
      "gsm8k": 68.0,
      "humanEval": 30.0,
      "mtBench": 5.8
    },
    "roleSuitability": ["clarifier", "researcher", "planner"]
  },
  {
    "modelId": "google/gemini-2.0-flash-001:free",
    "provider": "openrouter",
    "price": "free",
    "contextWindow": 1048576,
    "benchmarks": {
      "mmlu": 75.0,
      "gsm8k": 85.0,
      "humanEval": 65.0,
      "mtBench": 8.0
    },
    "roleSuitability": ["researcher"]
  },
  {
    "modelId": "qwen/qwen-2.5-coder-32b-instruct:free",
    "provider": "openrouter",
    "price": "free",
    "contextWindow": 32768,
    "benchmarks": {
      "mmlu": 65.0,
      "gsm8k": 80.0,
      "humanEval": 55.0,
      "mtBench": 7.5
    },
    "roleSuitability": ["coder"]
  },
  {
    "modelId": "stepfun/step-3.7-flash:free",
    "provider": "kilo-gateway",
    "price": "free",
    "contextWindow": 8192,
    "benchmarks": {
      "mmlu": 62.0,
      "gsm8k": 72.0,
      "humanEval": 40.0,
      "mtBench": 6.8
    },
    "roleSuitability": ["all"]
  },
  {
    "modelId": "codik-free",
    "provider": "codik",
    "price": "free",
    "contextWindow": 8192,
    "benchmarks": {
      "mmlu": 58.0,
      "gsm8k": 70.0,
      "humanEval": 35.0,
      "mtBench": 6.0
    },
    "roleSuitability": ["all"]
  },
  {
    "modelId": "llama3.2",
    "provider": "ollama",
    "price": "free",
    "contextWindow": 8192,
    "benchmarks": {
      "mmlu": 58.0,
      "gsm8k": 70.0,
      "humanEval": 35.0,
      "mtBench": 6.0
    },
    "roleSuitability": ["all"]
  }
]