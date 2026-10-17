# `>_` OpenAI Codex (`v0.1.0-free`) — 1:1 Free Edition

A **1:1 recreation of the OpenAI Codex CLI (`@openai/codex` / `codex-rs/tui`)** and interactive Web Terminal Workspace where **everything is 100% free** — zero API keys, zero $200/month Pro paywalls, and zero rate limits.

---

## ✨ What's Included (1:1 with OpenAI Codex CLI)

- **Authentic TUI Session Box & Transcript Cells**:
  - `>_ OpenAI Codex (v0.1.0-free)` session header with active model, reasoning effort, directory, and permission mode.
  - **Patch Cells (`• Edited` / `• Added`)**: Line-numbered unified diffs (`+` green additions, `-` red removals) matching `codex-rs/tui/src/history_cell/patches.rs`.
  - **Exec Cells (`• Running` / `• Ran` / `• Exited`)**: Syntax-highlighted shell commands with execution duration and tree-structured stdout/stderr previews.
  - **Approval Modal (`Would you like to run the following command?`)**:
    1. `Yes, proceed (y)`
    2. `Yes, and don't ask again for commands that start with ... (p)`
    3. `No, and tell Codex what to do differently (esc / n)`
- **Complete Official Slash Commands**:
  - `/model` — Switch between `gpt-5.1-codex`, `codex-mini-latest`, `o4-mini`, `gpt-4.1`, `qwen-2.5-coder-32b`, `deepseek-r1`, `llama-3.3-70b`, `local-autonomous`, and `ollama-local`, plus reasoning levels (`low`, `medium`, `high`, `xhigh`).
  - `/permissions` — Switch between `Suggest`, `Auto Edit`, `Full Auto`, and `YOLO mode`.
  - `/status` & `/usage` — View session card with **100% Unlimited (`[████████████████████]`)** 5h/weekly limits and `$0.00` free credits.
  - `/init` — Generate or update `AGENTS.md` tailored to the repository.
  - `/diff` — Show live `git diff` including untracked files.
  - `/review` — Run an automated code review on working tree changes.
  - `/plan` — Toggle Plan Mode.
  - `/new`, `/resume`, `/fork`, `/rename`, `/compact`, `/recap`, `/clear`, `/copy`, `/export`, `/pwd`, `/cd`, `/theme`, `/pets`, `/vim`, `/free`.
- **Zero-Key Free AI + Real Workspace Execution**:
  - **Tier 1 (Zero-Key Free Cloud Inference)**: Connects directly to zero-key OpenAI-compatible endpoints (`text.pollinations.ai`) with optional support for OpenRouter `:free`, Groq Free, or Local Ollama (`http://localhost:11434`).
  - **Tier 2 (Built-in Local Autonomous Coding Engine)**: Works 100% offline/sandboxed with 0ms latency — reads files, writes code, applies `*** Begin Patch` diffs, searches the repo, and executes real shell commands.

---

## 🚀 Quickstart

### 1. Web Terminal + Workspace Inspector (Live Preview)
```bash
npm install
npm start
# Opens on http://0.0.0.0:3000
```

### 2. Terminal CLI (`codex` / `codex-free`)
```bash
# Interactive TUI in your terminal
npm run cli

# Check status card
./bin/codex.js status

# Non-interactive task execution (`codex exec`)
./bin/codex.js exec "Create examples/hello.js and run it"

# Show git diff (including untracked files)
./bin/codex.js diff
```

### 3. Run Automated Tests
```bash
npm test
```
