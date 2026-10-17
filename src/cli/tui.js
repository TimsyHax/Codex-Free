import readline from "node:readline";
import path from "node:path";
import fs from "node:fs";
import {
  CODEX_VERSION,
  MODELS_CATALOG,
  PERMISSION_PROFILES,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_PERMISSION_MODE
} from "../shared/constants.js";
import { SLASH_COMMANDS } from "../shared/slashCommands.js";
import { formatPatchSummaryPlain } from "../shared/patchParser.js";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  editWorkspaceFile,
  applyWorkspacePatch,
  searchWorkspaceFiles,
  runWorkspaceShell,
  getWorkspaceGitDiff,
  generateAgentsMdContent
} from "../backend/tools.js";
import { generateAgentTurnPlan } from "../backend/llmRouter.js";

// ANSI styling helpers
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[38;2;137;180;250m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[97m"
};

export function renderCliSessionHeader({
  workspaceRoot,
  model,
  reasoningEffort,
  permissionMode
}) {
  const home = process.env.HOME || "/home/user";
  const displayDir = workspaceRoot.startsWith(home)
    ? "~" + workspaceRoot.slice(home.length)
    : workspaceRoot;
  const perm =
    PERMISSION_PROFILES.find((p) => p.id === permissionMode) ||
    PERMISSION_PROFILES[1];

  const lines = [
    `${c.blue}>_${c.reset} ${c.bold}OpenAI Codex${c.reset} ${c.dim}(v${CODEX_VERSION} · $0.00 FREE UNLIMITED)${c.reset}`,
    ``,
    `${c.dim}model:${c.reset}       ${model} (${reasoningEffort}) ${c.dim}· /model to change${c.reset}`,
    `${c.dim}directory:${c.reset}   ${displayDir}`,
    `${c.dim}permissions:${c.reset} ${
      perm.yolo ? `${c.magenta}${c.bold}YOLO mode${c.reset}` : perm.shortLabel
    } ${c.dim}· /permissions to change${c.reset}`
  ];

  const width = 74;
  const top = `${c.dim}╭${"─".repeat(width)}╮${c.reset}`;
  const bottom = `${c.dim}╰${"─".repeat(width)}╯${c.reset}`;
  const boxed = lines.map((l) => {
    const plainLen = l.replace(/\x1b\[[0-9;]*m/g, "").length;
    const pad = " ".repeat(Math.max(0, width - 2 - plainLen));
    return `${c.dim}│${c.reset} ${l}${pad} ${c.dim}│${c.reset}`;
  });

  return [top, ...boxed, bottom].join("\n");
}

export function renderCliStatusCard({
  workspaceRoot,
  model,
  reasoningEffort,
  permissionMode,
  tokensUsed = 420
}) {
  const home = process.env.HOME || "/home/user";
  const displayDir = workspaceRoot.startsWith(home)
    ? "~" + workspaceRoot.slice(home.length)
    : workspaceRoot;
  const perm =
    PERMISSION_PROFILES.find((p) => p.id === permissionMode) ||
    PERMISSION_PROFILES[1];
  const hasAgents = fs.existsSync(path.join(workspaceRoot, "AGENTS.md"));

  return [
    ``,
    `  ${c.blue}>_${c.reset} ${c.bold}OpenAI Codex${c.reset} ${c.dim}(v${CODEX_VERSION})${c.reset}`,
    ``,
    `  ${c.dim}Everything is unlocked & 100% free — zero API keys or subscriptions${c.reset}`,
    ``,
    `  Model:           ${model} (reasoning ${reasoningEffort}, summaries auto)`,
    `  Directory:       ${displayDir}`,
    `  Permissions:     ${perm.yolo ? `${c.magenta}${c.bold}YOLO mode${c.reset}` : perm.shortLabel}`,
    `  Agents.md:       ${hasAgents ? "AGENTS.md (loaded)" : "<none>"}`,
    `  Account:         free@codex.local ${c.green}(Pro 200 Unlocked · $0.00 FREE)${c.reset}`,
    ``,
    `  Context window:  99% left (${(tokensUsed / 1000).toFixed(1)}K used / 272K)`,
    `  5h limit:        ${c.green}[████████████████████] 100% left${c.reset} (UNLIMITED · FREE)`,
    `  Weekly limit:    ${c.green}[████████████████████] 100% left${c.reset} (UNLIMITED · FREE)`,
    `  Credits:         ${c.green}∞ Unlimited ($0.00 / Free Forever)${c.reset}`,
    ``
  ].join("\n");
}

export async function runSinglePromptCli({
  workspaceRoot,
  prompt,
  model = DEFAULT_MODEL,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  permissionMode = "full-auto"
}) {
  const plan = await generateAgentTurnPlan({
    workspaceRoot,
    prompt,
    model,
    reasoningEffort
  });

  if (plan.reasoning) {
    console.log(`${c.dim}• Thinking: ${plan.reasoning}${c.reset}`);
  }

  const results = [];
  for (const act of plan.actions || []) {
    const res = await executeCliAction(workspaceRoot, act);
    results.push(res);
  }

  const reply =
    typeof plan.finalResponse === "function"
      ? plan.finalResponse({ toolResults: results })
      : String(plan.finalResponse || "Done.");

  console.log(`\n${reply}\n`);
  return { ok: true, results, reply };
}

async function executeCliAction(workspaceRoot, act) {
  if (act.type === "write_file") {
    const w = writeWorkspaceFile(workspaceRoot, act.filePath, act.content);
    console.log(`${c.green}${formatPatchSummaryPlain(w.diffs)}${c.reset}`);
    return w;
  }
  if (act.type === "edit_file") {
    const e = editWorkspaceFile(workspaceRoot, act.filePath, act.oldText, act.newText);
    console.log(`${c.green}${formatPatchSummaryPlain(e.diffs)}${c.reset}`);
    return e;
  }
  if (act.type === "apply_patch") {
    const p = applyWorkspacePatch(workspaceRoot, act.patch);
    console.log(`${c.green}${formatPatchSummaryPlain(p.diffs)}${c.reset}`);
    return p;
  }
  if (act.type === "shell") {
    console.log(`${c.blue}• Running${c.reset} ${c.bold}${act.command}${c.reset}`);
    const s = await runWorkspaceShell(workspaceRoot, act.command);
    const statusLabel = s.exitCode === 0 ? `${c.green}• Ran${c.reset}` : `${c.red}• Exited (${s.exitCode})${c.reset}`;
    console.log(`${statusLabel} ${act.command} ${c.dim}(${s.durationMs}ms)${c.reset}`);
    const out = (s.stdout || s.stderr || "").trim();
    if (out) {
      out
        .split("\n")
        .slice(0, 12)
        .forEach((line, idx) => {
          console.log(`  ${idx === 0 ? "└" : " "} ${line}`);
        });
    }
    return s;
  }
  if (act.type === "read_file") {
    const r = readWorkspaceFile(workspaceRoot, act.filePath, 1, 200);
    console.log(`${c.dim}• Read ${act.filePath} (${r.totalLines || 0} lines)${c.reset}`);
    return r;
  }
  if (act.type === "search_files") {
    const s = searchWorkspaceFiles(workspaceRoot, act.query);
    console.log(
      `${c.dim}• Searched workspace for "${act.query}" (${(s.matches || []).length} matches)${c.reset}`
    );
    return s;
  }
  if (act.type === "list_dir") {
    const list = listWorkspaceFiles(workspaceRoot, act.dirPath || ".", 2);
    console.log(`${c.dim}• Listed ${act.dirPath || "."} (${list.length} items)${c.reset}`);
    return { ok: true, files: list };
  }
  return { ok: true };
}

export async function startInteractiveTui({
  workspaceRoot = process.cwd(),
  model = DEFAULT_MODEL,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  permissionMode = DEFAULT_PERMISSION_MODE,
  initialPrompt = null
}) {
  let currentModel = model;
  let currentEffort = reasoningEffort;
  let currentPerm = permissionMode;
  let tokensUsed = 420;

  console.log(
    renderCliSessionHeader({
      workspaceRoot,
      model: currentModel,
      reasoningEffort: currentEffort,
      permissionMode: currentPerm
    })
  );
  console.log(
    `\n  ${c.dim}To get started, describe a task or try one of these commands:${c.reset}\n` +
      `  /init - create an AGENTS.md file with instructions for Codex\n` +
      `  /status - show current session configuration\n` +
      `  /permissions - choose what Codex is allowed to do\n` +
      `  /model - choose what model and reasoning effort to use\n` +
      `  /diff - show git diff (including untracked files)\n` +
      `  /quit - exit Codex\n`
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.blue}›${c.reset} `
  });

  const askQuestion = (q) => new Promise((resolve) => rl.question(q, resolve));

  async function processInput(line) {
    const input = line.trim();
    if (!input) return;

    if (input === "/quit" || input === "/exit") {
      rl.close();
      process.exit(0);
    }

    if (input === "/status" || input === "/usage") {
      console.log(
        renderCliStatusCard({
          workspaceRoot,
          model: currentModel,
          reasoningEffort: currentEffort,
          permissionMode: currentPerm,
          tokensUsed
        })
      );
      return;
    }

    if (input === "/init") {
      const content = generateAgentsMdContent(workspaceRoot);
      const w = writeWorkspaceFile(workspaceRoot, "AGENTS.md", content);
      console.log(`${c.green}${formatPatchSummaryPlain(w.diffs)}${c.reset}`);
      return;
    }

    if (input === "/diff") {
      const d = await getWorkspaceGitDiff(workspaceRoot);
      console.log(`\n${d.diff}\n`);
      return;
    }

    if (input.startsWith("/model")) {
      const arg = input.replace("/model", "").trim();
      if (arg) {
        currentModel = arg;
        console.log(`${c.green}• Model set to ${currentModel} ($0.00 Free)${c.reset}`);
      } else {
        console.log(`\n  Available Free Models:`);
        MODELS_CATALOG.forEach((m, idx) => {
          console.log(
            `  ${idx + 1}. ${c.bold}${m.id}${c.reset} — ${m.description}`
          );
        });
        const pick = await askQuestion(`  Select model number or name (enter to keep ${currentModel}): `);
        const num = Number(pick.trim());
        if (num >= 1 && num <= MODELS_CATALOG.length) {
          currentModel = MODELS_CATALOG[num - 1].id;
        } else if (pick.trim()) {
          currentModel = pick.trim();
        }
        console.log(`${c.green}• Active model: ${currentModel}${c.reset}\n`);
      }
      return;
    }

    if (input.startsWith("/permissions") || input.startsWith("/mode")) {
      console.log(`\n  Permission Profiles:`);
      PERMISSION_PROFILES.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ${c.bold}${p.id}${c.reset} — ${p.label}`);
      });
      const pick = await askQuestion(`  Select permission (1-${PERMISSION_PROFILES.length}): `);
      const num = Number(pick.trim());
      if (num >= 1 && num <= PERMISSION_PROFILES.length) {
        currentPerm = PERMISSION_PROFILES[num - 1].id;
      }
      console.log(`${c.green}• Active permission mode: ${currentPerm}${c.reset}\n`);
      return;
    }

    if (input === "/help" || input === "/?") {
      SLASH_COMMANDS.forEach((s) => {
        console.log(`  ${c.blue}${s.cmd.padEnd(14)}${c.reset} ${s.description}`);
      });
      return;
    }

    // Run Agent Turn
    const plan = await generateAgentTurnPlan({
      workspaceRoot,
      prompt: input,
      model: currentModel,
      reasoningEffort: currentEffort
    });

    if (plan.reasoning) {
      console.log(`${c.dim}• Thinking: ${plan.reasoning}${c.reset}`);
    }

    const permObj =
      PERMISSION_PROFILES.find((p) => p.id === currentPerm) ||
      PERMISSION_PROFILES[1];

    const results = [];
    for (const act of plan.actions || []) {
      const needsConfirm =
        !permObj.yolo &&
        ((act.type === "shell" && !permObj.autoApproveShell) ||
          ((act.type === "write_file" || act.type === "edit_file" || act.type === "apply_patch") &&
            !permObj.autoApprovePatches));

      if (needsConfirm) {
        console.log(`\n  Would you like to run the following command?`);
        console.log(`  ${c.dim}Reason: ${act.reason || "Requested by Codex"}${c.reset}`);
        console.log(`  ${c.cyan}$ ${act.command || act.filePath}${c.reset}\n`);
        const ans = await askQuestion(`  [y] Yes, proceed  [n] No, cancel: `);
        if (ans.trim().toLowerCase().startsWith("n")) {
          console.log(`  ${c.yellow}• Canceled action.${c.reset}`);
          continue;
        }
      }

      const r = await executeCliAction(workspaceRoot, act);
      results.push(r);
    }

    const reply =
      typeof plan.finalResponse === "function"
        ? plan.finalResponse({ toolResults: results })
        : String(plan.finalResponse || "Done.");

    tokensUsed += Math.max(120, input.length + reply.length);
    console.log(`\n${reply}\n`);
  }

  if (initialPrompt) {
    await processInput(initialPrompt);
  }

  rl.prompt();
  rl.on("line", async (line) => {
    await processInput(line);
    rl.prompt();
  });
}
