# AGENTS.md — codex-free

This file provides repository-specific guidance for **OpenAI Codex (Codex-Free)** when operating in this workspace.

## Project Overview
- **Name**: `codex-free`
- **Description**: 1:1 OpenAI Codex CLI & Web Terminal Agent — 100% Free, Zero API Keys Required
- **Runtime**: Node.js ES Modules (`"type": "module"`)

## Common Commands
- `npm start`: Start the Codex-Free server & 1:1 Web Terminal UI (`0.0.0.0:3000`)
- `npm run cli`: Launch the interactive terminal CLI (`bin/codex.js`)
- `npm test`: Run automated test suite (`node --test tests/codex.test.js`)

## Architecture & Conventions
1. **Shared Core (`src/shared/`)**:
   - `constants.js`: Model catalog (`gpt-5.1-codex`, `codex-mini-latest`, `o4-mini`, `qwen-2.5-coder-32b`, `deepseek-r1`), permission profiles (`suggest`, `auto-edit`, `full-auto`, `yolo`), and themes.
   - `slashCommands.js`: 1:1 OpenAI Codex slash command registry (`/model`, `/permissions`, `/status`, `/diff`, `/review`, `/init`, `/compact`, `/free`, etc.).
   - `patchParser.js`: OpenAI Codex `*** Begin Patch` parser and line-numbered unified diff builder.
2. **Workspace Execution Backend (`src/backend/`)**:
   - `tools.js`: Real filesystem & shell execution (`read_file`, `write_file`, `edit_file`, `apply_patch`, `search_files`, `shell`, `git_diff`).
   - `llmRouter.js` & `localAgent.js`: Zero-key Free Cloud LLM router with automatic fallback to the built-in Local Autonomous Coding Engine.
3. **Interactive CLI & Web TUI (`bin/codex.js`, `src/cli/tui.js`, `src/public/`)**:
   - Preserves OpenAI Codex TUI formatting (`• Edited`, `• Ran`, `› Ask Codex to do anything`, approval modals).

## Safety & Verification
- Always run `npm test` after modifying core logic or patch parsers.
- Never delete `.git` or modify files outside the workspace root.
