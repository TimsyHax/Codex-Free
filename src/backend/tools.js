import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  computeStructuredDiff,
  parseCodexPatch,
  applyCodexFileOperation
} from "../shared/patchParser.js";

const execAsync = promisify(exec);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".codex-free",
  ".next",
  "dist",
  "build",
  "coverage"
]);

export function resolveSafePath(workspaceRoot, targetPath = ".") {
  const root = path.resolve(workspaceRoot);
  if (!targetPath || targetPath === "." || targetPath === "~") {
    return root;
  }
  const cleaned = targetPath.replace(/^~\//, "");
  const resolved = path.resolve(root, cleaned);
  // Keep within workspace root for safety unless explicitly reading
  if (!resolved.startsWith(root)) {
    return root;
  }
  return resolved;
}

export function relativeToWorkspace(workspaceRoot, absPath) {
  const rel = path.relative(path.resolve(workspaceRoot), absPath);
  return rel === "" ? "." : rel;
}

export function listWorkspaceFiles(workspaceRoot, subDir = ".", maxDepth = 3) {
  const startDir = resolveSafePath(workspaceRoot, subDir);
  const results = [];

  function walk(currentDir, depth) {
    if (depth > maxDepth || results.length > 300) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relativeToWorkspace(workspaceRoot, fullPath);
      if (entry.isDirectory()) {
        results.push({ path: relPath, type: "dir", name: entry.name });
        walk(fullPath, depth + 1);
      } else {
        let size = 0;
        try {
          size = fs.statSync(fullPath).size;
        } catch {}
        results.push({ path: relPath, type: "file", name: entry.name, size });
      }
    }
  }

  walk(startDir, 1);
  return results;
}

export function readWorkspaceFile(workspaceRoot, filePath, offset = 1, limit = 250) {
  const absPath = resolveSafePath(workspaceRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return {
      ok: false,
      error: `File not found: ${filePath}`
    };
  }
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    const children = fs.readdirSync(absPath);
    return {
      ok: true,
      filePath: relativeToWorkspace(workspaceRoot, absPath),
      isDirectory: true,
      content: children.join("\n"),
      totalLines: children.length
    };
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const allLines = raw.replace(/\r\n/g, "\n").split("\n");
  const startIdx = Math.max(0, (Number(offset) || 1) - 1);
  const maxLines = Math.min(1000, Number(limit) || 250);
  const sliced = allLines.slice(startIdx, startIdx + maxLines);
  const numbered = sliced
    .map((line, i) => `${String(startIdx + i + 1).padStart(4, " ")} | ${line}`)
    .join("\n");

  return {
    ok: true,
    filePath: relativeToWorkspace(workspaceRoot, absPath),
    rawContent: raw,
    content: numbered,
    totalLines: allLines.length,
    shownLines: sliced.length
  };
}

export function writeWorkspaceFile(workspaceRoot, filePath, content) {
  const absPath = resolveSafePath(workspaceRoot, filePath);
  const relPath = relativeToWorkspace(workspaceRoot, absPath);
  if (relPath === ".git" || relPath.startsWith(".git/")) {
    return { ok: false, error: "Refusing to modify .git directory directly." };
  }

  const existed = fs.existsSync(absPath);
  const oldContent = existed ? fs.readFileSync(absPath, "utf8") : null;
  const newContent = String(content ?? "");

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, newContent, "utf8");

  const diff = computeStructuredDiff(
    relPath,
    oldContent,
    newContent,
    existed ? "update" : "add"
  );

  return {
    ok: true,
    filePath: relPath,
    action: existed ? "update" : "add",
    diff,
    diffs: [diff]
  };
}

export function editWorkspaceFile(workspaceRoot, filePath, oldText, newText) {
  const absPath = resolveSafePath(workspaceRoot, filePath);
  const relPath = relativeToWorkspace(workspaceRoot, absPath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, error: `File not found: ${relPath}` };
  }

  const oldContent = fs.readFileSync(absPath, "utf8");
  let updatedContent = oldContent;

  if (oldText && oldContent.includes(oldText)) {
    updatedContent = oldContent.replace(oldText, newText ?? "");
  } else if (oldText) {
    // Try normalized line-ending match
    const normOld = oldContent.replace(/\r\n/g, "\n");
    const normFind = String(oldText).replace(/\r\n/g, "\n");
    if (normOld.includes(normFind)) {
      updatedContent = normOld.replace(normFind, String(newText ?? ""));
    } else {
      return {
        ok: false,
        error: `Could not locate target snippet in ${relPath}`
      };
    }
  } else {
    updatedContent = String(newText ?? "");
  }

  fs.writeFileSync(absPath, updatedContent, "utf8");
  const diff = computeStructuredDiff(relPath, oldContent, updatedContent, "update");

  return {
    ok: true,
    filePath: relPath,
    action: "update",
    diff,
    diffs: [diff]
  };
}

export function applyWorkspacePatch(workspaceRoot, patchText) {
  const ops = parseCodexPatch(patchText);
  if (ops.length === 0) {
    return {
      ok: false,
      error: "No valid file operations found in patch. Expected *** Add File / *** Update File."
    };
  }

  const diffs = [];
  for (const op of ops) {
    const absPath = resolveSafePath(workspaceRoot, op.filePath);
    const relPath = relativeToWorkspace(workspaceRoot, absPath);
    if (relPath === ".git" || relPath.startsWith(".git/")) {
      continue;
    }
    const existed = fs.existsSync(absPath);
    const oldContent = existed ? fs.readFileSync(absPath, "utf8") : null;

    if (op.action === "delete") {
      if (existed) {
        fs.unlinkSync(absPath);
        diffs.push(computeStructuredDiff(relPath, oldContent, null, "delete"));
      }
    } else if (op.action === "add") {
      const newContent = applyCodexFileOperation(op, "");
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, newContent, "utf8");
      diffs.push(
        computeStructuredDiff(relPath, oldContent, newContent, existed ? "update" : "add")
      );
    } else {
      const newContent = applyCodexFileOperation(op, oldContent || "");
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, newContent, "utf8");
      diffs.push(
        computeStructuredDiff(relPath, oldContent, newContent, existed ? "update" : "add")
      );
    }
  }

  return {
    ok: true,
    diffs
  };
}

export function searchWorkspaceFiles(workspaceRoot, query = "") {
  const files = listWorkspaceFiles(workspaceRoot, ".", 4).filter((f) => f.type === "file");
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return {
      ok: true,
      matches: files.slice(0, 30).map((f) => ({
        filePath: f.path,
        line: 1,
        snippet: `(file, ${f.size} bytes)`
      }))
    };
  }

  const matches = [];
  for (const file of files) {
    if (matches.length >= 40) break;
    if (file.path.toLowerCase().includes(q)) {
      matches.push({
        filePath: file.path,
        line: 1,
        snippet: `[filename match] ${file.path}`
      });
    }
    if (file.size > 250000) continue;
    try {
      const content = fs.readFileSync(resolveSafePath(workspaceRoot, file.path), "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({
            filePath: file.path,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 140)
          });
          if (matches.length >= 40) break;
        }
      }
    } catch {}
  }

  return {
    ok: true,
    query,
    matches
  };
}

export async function runWorkspaceShell(workspaceRoot, command, timeoutMs = 15000) {
  const cmdStr = String(command || "").trim();
  if (!cmdStr) {
    return {
      ok: false,
      command: "",
      stdout: "",
      stderr: "Empty command",
      exitCode: 1,
      durationMs: 0
    };
  }

  // Guard against destructive workspace deletion
  const forbiddenPatterns = [
    /rm\s+-rf\s+\/($|\s)/i,
    /rm\s+-rf\s+\.git($|\s|\/)/i,
    /mkfs/i,
    /: \(\) \{ : \| : & \} ; :/
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(cmdStr)) {
      return {
        ok: false,
        command: cmdStr,
        stdout: "",
        stderr: "Blocked by Codex sandbox safety policy: destructive system/git command.",
        exitCode: 126,
        durationMs: 0
      };
    }
  }

  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmdStr, {
      cwd: workspaceRoot,
      timeout: Math.min(30000, Math.max(1000, timeoutMs)),
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", CI: "true" }
    });
    const durationMs = Date.now() - start;
    return {
      ok: true,
      command: cmdStr,
      stdout: stdout || "",
      stderr: stderr || "",
      exitCode: 0,
      durationMs
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      ok: false,
      command: cmdStr,
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "Command failed",
      exitCode: typeof err.code === "number" ? err.code : 1,
      durationMs
    };
  }
}

export async function getWorkspaceGitDiff(workspaceRoot) {
  const statusRes = await runWorkspaceShell(workspaceRoot, "git status --short");
  const diffRes = await runWorkspaceShell(workspaceRoot, "git diff HEAD");

  // Also include untracked file previews just like OpenAI Codex `/diff`
  const untrackedLines = (statusRes.stdout || "")
    .split("\n")
    .filter((l) => l.startsWith("?? "))
    .map((l) => l.slice(3).trim());

  const untrackedDiffs = [];
  for (const uFile of untrackedLines.slice(0, 10)) {
    try {
      const abs = resolveSafePath(workspaceRoot, uFile);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size < 64000) {
        const content = fs.readFileSync(abs, "utf8");
        const lines = content.split("\n").slice(0, 30);
        untrackedDiffs.push(
          `diff --git a/${uFile} b/${uFile}\nnew file mode 100644\n--- /dev/null\n+++ b/${uFile}\n@@ -0,0 +1,${lines.length} @@\n` +
            lines.map((l) => `+${l}`).join("\n")
        );
      }
    } catch {}
  }

  const combinedDiff = [diffRes.stdout.trim(), ...untrackedDiffs]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    status: statusRes.stdout.trim(),
    diff: combinedDiff || "(working tree clean — no uncommitted changes)"
  };
}

export function generateAgentsMdContent(workspaceRoot) {
  let pkg = { name: path.basename(workspaceRoot), scripts: {} };
  try {
    const pkgPath = path.join(workspaceRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    }
  } catch {}

  const scriptsList = Object.entries(pkg.scripts || {})
    .map(([k, v]) => `- \`npm run ${k}\`: \`${v}\``)
    .join("\n");

  return `# AGENTS.md — ${pkg.name || "Workspace"}

This file provides repository-specific guidance for **OpenAI Codex (Codex-Free)** when operating in this workspace.

## Project Overview
- **Name**: \`${pkg.name || "Codex-Free"}\`
- **Description**: ${pkg.description || "1:1 OpenAI Codex CLI & Web Terminal Agent — 100% Free, Zero API Keys"}
- **Runtime**: Node.js ES Modules (\`"type": "module"\`)

## Common Commands
${scriptsList || "- `npm start`: Start the Codex-Free server & web terminal\n- `npm run cli`: Launch the interactive terminal CLI\n- `npm test`: Run automated test suite"}

## Architecture & Conventions
1. **Shared Core (\`src/shared/\`)**:
   - \`constants.js\`: Model catalog (\`gpt-5.1-codex\`, \`codex-mini-latest\`, \`o4-mini\`, \`qwen-2.5-coder-32b\`, \`deepseek-r1\`), permission profiles (\`suggest\`, \`auto-edit\`, \`full-auto\`, \`yolo\`), and themes.
   - \`slashCommands.js\`: 1:1 OpenAI Codex slash command registry (\`/model\`, \`/permissions\`, \`/status\`, \`/diff\`, \`/review\`, \`/init\`, \`/compact\`, \`/free\`, etc.).
   - \`patchParser.js\`: OpenAI Codex \`*** Begin Patch\` parser and line-numbered unified diff builder.
2. **Workspace Execution Backend (\`src/backend/\`)**:
   - \`tools.js\`: Real filesystem & shell execution (\`read_file\`, \`write_file\`, \`edit_file\`, \`apply_patch\`, \`search_files\`, \`shell\`, \`git_diff\`).
   - \`llmRouter.js\` & \`localAgent.js\`: Zero-key Free Cloud LLM router with automatic fallback to the built-in Local Autonomous Coding Engine.
3. **Interactive CLI & Web TUI (\`bin/codex.js\`, \`src/cli/tui.js\`, \`src/public/\`)**:
   - Preserves OpenAI Codex TUI formatting (\`• Edited\`, \`• Ran\`, \`› Ask Codex to do anything\`, approval modals).

## Safety & Verification
- Always run \`npm test\` after modifying core logic or patch parsers.
- Never delete \`.git\` or modify files outside the workspace root.
`;
}
