#!/usr/bin/env node
import {
  CODEX_VERSION,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_PERMISSION_MODE
} from "../src/shared/constants.js";
import {
  startInteractiveTui,
  runSinglePromptCli,
  renderCliStatusCard
} from "../src/cli/tui.js";
import { getWorkspaceGitDiff } from "../src/backend/tools.js";

function printHelp() {
  console.log(`OpenAI Codex CLI (v${CODEX_VERSION}) — 100% Free Unlimited Edition

Usage:
  codex [OPTIONS] [PROMPT]
  codex exec [OPTIONS] <PROMPT>

Subcommands:
  exec <PROMPT>    Run Codex non-interactively on a task and exit
  status           Display current session configuration and unlimited free plan status
  diff             Show git diff (including untracked files)

Options:
  -m, --model <MODEL>              Model to use (default: ${DEFAULT_MODEL})
  -e, --effort <LEVEL>             Reasoning effort: low, medium, high, xhigh (default: ${DEFAULT_REASONING_EFFORT})
  -a, --ask-for-approval <MODE>    Approval policy: suggest, auto-edit, full-auto, yolo
      --full-auto                  Run in Full Auto mode (workspace write + command execution)
      --yolo                       Bypass all approvals (--dangerously-bypass-approvals-and-sandbox)
  -C, --cd <DIR>                   Working directory
  -V, --version                    Print version info and exit
  -h, --help                       Print help information
`);
}

async function main() {
  const argv = process.argv.slice(2);
  let model = DEFAULT_MODEL;
  let reasoningEffort = DEFAULT_REASONING_EFFORT;
  let permissionMode = DEFAULT_PERMISSION_MODE;
  let workspaceRoot = process.cwd();
  let subcommand = null;
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "-V" || arg === "--version") {
      console.log(`codex-cli ${CODEX_VERSION} (100% Free Unlimited)`);
      process.exit(0);
    }
    if (arg === "-m" || arg === "--model") {
      model = argv[++i] || model;
      continue;
    }
    if (arg === "-e" || arg === "--effort") {
      reasoningEffort = argv[++i] || reasoningEffort;
      continue;
    }
    if (arg === "-a" || arg === "--ask-for-approval") {
      permissionMode = argv[++i] || permissionMode;
      continue;
    }
    if (arg === "--full-auto") {
      permissionMode = "full-auto";
      continue;
    }
    if (arg === "--yolo" || arg === "--dangerously-bypass-approvals-and-sandbox") {
      permissionMode = "yolo";
      continue;
    }
    if (arg === "-C" || arg === "--cd") {
      workspaceRoot = argv[++i] || workspaceRoot;
      continue;
    }
    if (!subcommand && (arg === "exec" || arg === "status" || arg === "diff")) {
      subcommand = arg;
      continue;
    }
    positional.push(arg);
  }

  if (subcommand === "status") {
    console.log(
      renderCliStatusCard({
        workspaceRoot,
        model,
        reasoningEffort,
        permissionMode
      })
    );
    process.exit(0);
  }

  if (subcommand === "diff") {
    const d = await getWorkspaceGitDiff(workspaceRoot);
    console.log(d.diff);
    process.exit(0);
  }

  if (subcommand === "exec") {
    const prompt = positional.join(" ").trim();
    if (!prompt) {
      console.error("Error: `codex exec` requires a prompt.");
      process.exit(1);
    }
    await runSinglePromptCli({
      workspaceRoot,
      prompt,
      model,
      reasoningEffort,
      permissionMode: "full-auto"
    });
    process.exit(0);
  }

  const initialPrompt = positional.length > 0 ? positional.join(" ") : null;
  await startInteractiveTui({
    workspaceRoot,
    model,
    reasoningEffort,
    permissionMode,
    initialPrompt
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
