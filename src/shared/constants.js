export const CODEX_VERSION = "0.1.0-free";

export const DEFAULT_MODEL = "gpt-5.1-codex";
export const DEFAULT_REASONING_EFFORT = "high";
export const DEFAULT_PERMISSION_MODE = "auto-edit";

export const MODELS_CATALOG = [
  {
    id: "gpt-5.1-codex",
    label: "gpt-5.1-codex",
    provider: "free-cloud",
    pollinationsModel: "openai-large",
    description: "Default flagship OpenAI Codex agentic software engineering model — $0.00 Free Unlimited",
    contextWindow: 272000,
    supportsReasoning: true,
    defaultEffort: "high",
    efforts: ["low", "medium", "high", "xhigh"],
    badge: "FREE · DEFAULT"
  },
  {
    id: "codex-mini-latest",
    label: "codex-mini-latest",
    provider: "free-cloud",
    pollinationsModel: "openai",
    description: "Ultra-fast low-latency agentic model tuned for Codex CLI workflows — $0.00 Free",
    contextWindow: 200000,
    supportsReasoning: true,
    defaultEffort: "medium",
    efforts: ["low", "medium", "high"],
    badge: "FREE · FAST"
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    provider: "free-cloud",
    pollinationsModel: "openai-reasoning",
    description: "Deep reasoning model for complex debugging, algorithms, and architecture — $0.00 Free",
    contextWindow: 200000,
    supportsReasoning: true,
    defaultEffort: "high",
    efforts: ["low", "medium", "high", "xhigh"],
    badge: "FREE · REASONING"
  },
  {
    id: "gpt-4.1",
    label: "gpt-4.1",
    provider: "free-cloud",
    pollinationsModel: "openai-large",
    description: "High-precision 1M-context coding & instruction following model — $0.00 Free",
    contextWindow: 1000000,
    supportsReasoning: false,
    defaultEffort: "medium",
    efforts: ["medium"],
    badge: "FREE · 1M CTX"
  },
  {
    id: "qwen-2.5-coder-32b",
    label: "qwen-2.5-coder-32b",
    provider: "free-cloud",
    pollinationsModel: "qwen-coder",
    description: "Open-weights SOTA coding specialist via Zero-Key Free Cloud — $0.00 Free",
    contextWindow: 128000,
    supportsReasoning: true,
    defaultEffort: "high",
    efforts: ["low", "medium", "high"],
    badge: "ZERO-KEY OSS"
  },
  {
    id: "deepseek-r1",
    label: "deepseek-r1",
    provider: "free-cloud",
    pollinationsModel: "deepseek-reasoning",
    description: "Open-weights frontier reasoning model with full chain-of-thought — $0.00 Free",
    contextWindow: 128000,
    supportsReasoning: true,
    defaultEffort: "xhigh",
    efforts: ["medium", "high", "xhigh"],
    badge: "ZERO-KEY R1"
  },
  {
    id: "llama-3.3-70b",
    label: "llama-3.3-70b-instruct",
    provider: "free-cloud",
    pollinationsModel: "llama",
    description: "Meta Llama 3.3 70B Instruct — fast general coding & shell automation — $0.00 Free",
    contextWindow: 128000,
    supportsReasoning: false,
    defaultEffort: "medium",
    efforts: ["medium"],
    badge: "ZERO-KEY OSS"
  },
  {
    id: "local-autonomous",
    label: "codex-local-engine (Offline Zero-Key)",
    provider: "local-engine",
    pollinationsModel: "openai",
    description: "Built-in deterministic + heuristic local coding agent — works 100% offline with zero network",
    contextWindow: 512000,
    supportsReasoning: true,
    defaultEffort: "high",
    efforts: ["low", "medium", "high"],
    badge: "OFFLINE · 0ms"
  },
  {
    id: "ollama-local",
    label: "ollama/qwen2.5-coder (Local Ollama)",
    provider: "ollama",
    pollinationsModel: "qwen-coder",
    description: "Connects to local Ollama instance at http://localhost:11434 (falls back to Free Cloud/Local)",
    contextWindow: 128000,
    supportsReasoning: true,
    defaultEffort: "medium",
    efforts: ["low", "medium", "high"],
    badge: "LOCAL GPU"
  }
];

export const PERMISSION_PROFILES = [
  {
    id: "suggest",
    label: "Suggest (Read-Only + Ask for Edits & Commands)",
    shortLabel: "Suggest (Ask for approval)",
    statusSummary: "Read-only workspace, ask for approval on file edits and shell commands",
    autoApprovePatches: false,
    autoApproveShell: false,
    yolo: false
  },
  {
    id: "auto-edit",
    label: "Auto Edit (Workspace Write + Ask for Shell Commands)",
    shortLabel: "Auto Edit (workspace write, ask for shell)",
    statusSummary: "Workspace write enabled, ask for approval before running shell commands",
    autoApprovePatches: true,
    autoApproveShell: false,
    yolo: false
  },
  {
    id: "full-auto",
    label: "Full Auto (Workspace Write + Auto-Run Workspace Commands)",
    shortLabel: "Full Auto (workspace write + command execution)",
    statusSummary: "Workspace write + automatic command execution inside workspace sandbox",
    autoApprovePatches: true,
    autoApproveShell: true,
    yolo: false
  },
  {
    id: "yolo",
    label: "YOLO Mode (--dangerously-bypass-approvals-and-sandbox)",
    shortLabel: "YOLO mode",
    statusSummary: "Unrestricted full access — zero approval prompts",
    autoApprovePatches: true,
    autoApproveShell: true,
    yolo: true
  }
];

export const FREE_PROVIDERS = [
  {
    id: "auto-free",
    name: "Zero-Key Free Multi-Router (Pollinations + Local Engine)",
    endpoint: "https://text.pollinations.ai/openai/chat/completions",
    requiresKey: false,
    cost: "$0.00 / token",
    description: "Automatically routes to zero-key cloud inference from your browser or server, with instant fallback to the built-in local coding agent."
  },
  {
    id: "local-engine",
    name: "Built-in Local Autonomous Agent Engine",
    endpoint: "local://codex-free-engine",
    requiresKey: false,
    cost: "$0.00 / token (100% Offline)",
    description: "Executes real file searches, patches, code generation, and shell commands locally without external API calls."
  },
  {
    id: "ollama",
    name: "Local Ollama / LM Studio Server",
    endpoint: "http://localhost:11434/v1/chat/completions",
    requiresKey: false,
    cost: "$0.00 / token (Local Hardware)",
    description: "Connects to any OpenAI-compatible local server (Ollama on :11434 or LM Studio on :1234)."
  },
  {
    id: "openrouter-free",
    name: "OpenRouter Free Models (:free tier)",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    requiresKey: true,
    cost: "$0.00 / token (Free API Key)",
    description: "Optional: Use any free-tier OpenRouter API key with models ending in :free."
  },
  {
    id: "groq-free",
    name: "Groq Cloud Free Tier",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    requiresKey: true,
    cost: "$0.00 / token (Free API Key)",
    description: "Optional: Ultra-fast LPU inference using a free Groq developer key."
  }
];

export const THEMES = [
  {
    id: "codex-dark",
    name: "Codex Official Dark",
    accent: "#10a37f",
    bg: "#0d1117",
    panel: "#161b22"
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha (TUI Default)",
    accent: "#89b4fa",
    bg: "#11111b",
    panel: "#181825"
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night Storm",
    accent: "#7aa2f7",
    bg: "#1a1b26",
    panel: "#16161e"
  },
  {
    id: "matrix-free",
    name: "Matrix Zero-Cost Green",
    accent: "#00ff9c",
    bg: "#050a08",
    panel: "#0a1410"
  }
];

export const TERMINAL_PETS = [
  {
    id: "none",
    name: "Hidden (No terminal pet)",
    ascii: ""
  },
  {
    id: "codex-cat",
    name: "Byte the Codex Cat",
    ascii: " /\\_/\\  [Byte · $0.00]\n( o.o ) < nya~ free tokens!\n > ^ <"
  },
  {
    id: "robo-crab",
    name: "Ferris the Rust Crab (codex-rs)",
    ascii: "    _~^~^~_\n\\) /  o o  \\ (/  [codex-rs · FREE]\n  '_   -   _'\n  / '-----' \\"
  },
  {
    id: "rubber-duck",
    name: "Quackers the Debugger Duck",
    ascii: "   __\n <(o )___  [0 bugs · $0.00]\n  ( ._> /\n   `---'"
  }
];
