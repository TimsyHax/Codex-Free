#!/usr/bin/env node
/**
 * Zero-Dependency Standalone Server for Codex-Free Windows .exe distribution.
 * Uses ONLY Node.js built-in modules (node:http, node:fs, node:path) so the
 * unzipped release works out-of-the-box without requiring `npm install`.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODEX_VERSION,
  MODELS_CATALOG,
  PERMISSION_PROFILES,
  FREE_PROVIDERS,
  THEMES,
  TERMINAL_PETS
} from "../shared/constants.js";
import { SLASH_COMMANDS } from "../shared/slashCommands.js";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  editWorkspaceFile,
  applyWorkspacePatch,
  searchWorkspaceFiles,
  runWorkspaceShell,
  getWorkspaceGitDiff,
  generateAgentsMdContent,
  resolveSafePath
} from "./tools.js";
import { SessionStore } from "./sessionStore.js";
import { generateAgentTurnPlan } from "./llmRouter.js";
import {
  generateRobloxModelSpec,
  generateRobloxAnimationSpec,
  generateRobloxCompanionPluginLua
} from "../shared/robloxStudio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let workspaceRoot = process.cwd();
const sessionStore = new SessionStore(workspaceRoot);
let activeSession = sessionStore.getSession();
const pendingApprovals = new Map();
const robloxSyncQueue = [];

const publicDir = path.join(__dirname, "../public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".zip": "application/zip"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function buildWorkspaceState() {
  const files = listWorkspaceFiles(workspaceRoot, ".", 3);
  const hasAgentsMd = fs.existsSync(path.join(workspaceRoot, "AGENTS.md"));
  return {
    version: CODEX_VERSION,
    workspaceRoot,
    displayDirectory: workspaceRoot,
    gitBranch: "main",
    gitStatusShort: "",
    hasAgentsMd,
    agentsMdLabel: hasAgentsMd ? "AGENTS.md (loaded)" : "<none>",
    activeSession,
    sessions: sessionStore.listSessions(),
    catalog: {
      models: MODELS_CATALOG,
      permissions: PERMISSION_PROFILES,
      providers: FREE_PROVIDERS,
      themes: THEMES,
      pets: TERMINAL_PETS,
      slashCommands: SLASH_COMMANDS
    },
    files,
    backgroundTerminals: []
  };
}

async function executeSingleAction(action) {
  if (action.type === "read_file") {
    const r = readWorkspaceFile(workspaceRoot, action.filePath, 1, 200);
    return { kind: "read", filePath: action.filePath, ok: r.ok, totalLines: r.totalLines || 0, content: r.content || "" };
  }
  if (action.type === "list_dir") {
    const list = listWorkspaceFiles(workspaceRoot, action.dirPath || ".", 2);
    return { kind: "list", dirPath: action.dirPath || ".", ok: true, count: list.length, files: list.slice(0, 30) };
  }
  if (action.type === "search_files") {
    const s = searchWorkspaceFiles(workspaceRoot, action.query);
    return { kind: "search", query: action.query, ok: true, matches: s.matches || [] };
  }
  if (action.type === "write_file") {
    const w = writeWorkspaceFile(workspaceRoot, action.filePath, action.content);
    return { kind: "patch", ok: w.ok, filePath: w.filePath, action: w.action, diff: w.diff, diffs: w.diffs || [], error: w.error };
  }
  if (action.type === "edit_file") {
    const e = editWorkspaceFile(workspaceRoot, action.filePath, action.oldText, action.newText);
    return { kind: "patch", ok: e.ok, filePath: e.filePath, action: "update", diff: e.diff, diffs: e.diffs || [], error: e.error };
  }
  if (action.type === "apply_patch") {
    const p = applyWorkspacePatch(workspaceRoot, action.patch);
    return { kind: "patch", ok: p.ok, diffs: p.diffs || [], error: p.error };
  }
  if (action.type === "shell") {
    const s = await runWorkspaceShell(workspaceRoot, action.command);
    return { kind: "exec", ok: s.ok, command: s.command, stdout: s.stdout, stderr: s.stderr, exitCode: s.exitCode, durationMs: s.durationMs };
  }
  return { kind: "unknown", ok: false };
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost:3000"}`);
  const pathname = urlObj.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    return res.end();
  }

  if (pathname === "/api/state" && req.method === "GET") {
    const state = await buildWorkspaceState();
    return sendJson(res, 200, { ok: true, ...state });
  }

  if (pathname === "/api/file" && req.method === "GET") {
    const target = urlObj.searchParams.get("path") || "README.md";
    return sendJson(res, 200, readWorkspaceFile(workspaceRoot, target, 1, 500));
  }

  if (pathname === "/api/diff" && req.method === "GET") {
    return sendJson(res, 200, await getWorkspaceGitDiff(workspaceRoot));
  }

  if (pathname === "/api/roblox/poll" && req.method === "GET") {
    const items = robloxSyncQueue.splice(0, robloxSyncQueue.length);
    return sendJson(res, 200, { ok: true, items });
  }

  if (pathname === "/api/roblox/plugin" && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      pluginCode: generateRobloxCompanionPluginLua(`http://${req.headers.host || "localhost:3000"}`)
    });
  }

  if (pathname === "/api/roblox/generate" && req.method === "POST") {
    const body = await readJsonBody(req);
    const asset =
      body.kind === "animation"
        ? generateRobloxAnimationSpec(body.prompt || "", body.attachments || [])
        : generateRobloxModelSpec(body.prompt || "", body.attachments || []);
    writeWorkspaceFile(workspaceRoot, `roblox/exports/${asset.name}.luau`, asset.luauScript);
    writeWorkspaceFile(workspaceRoot, `roblox/exports/${asset.name}.rbxmx`, asset.rbxmx);
    robloxSyncQueue.push({
      id: `rbx_${Date.now()}`,
      name: asset.name,
      type: asset.type,
      luauScript: asset.luauScript
    });
    const state = await buildWorkspaceState();
    return sendJson(res, 200, { ok: true, asset, state });
  }

  if (pathname === "/api/session" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (body.action === "new" || body.action === "clear") {
      activeSession = sessionStore.createSession();
    } else if (body.action === "resume" && body.sessionId) {
      activeSession = sessionStore.getSession(body.sessionId);
    } else if (body.action === "fork") {
      activeSession = sessionStore.forkSession(activeSession.id);
    } else {
      activeSession = sessionStore.updateSession(activeSession.id, body);
    }
    const state = await buildWorkspaceState();
    return sendJson(res, 200, { ok: true, ...state });
  }

  if (pathname === "/api/slash" && req.method === "POST") {
    const { command, args = "" } = await readJsonBody(req);
    const cmd = String(command || "").toLowerCase();
    if (cmd === "/init") {
      const content = generateAgentsMdContent(workspaceRoot);
      const writeRes = writeWorkspaceFile(workspaceRoot, "AGENTS.md", content);
      const state = await buildWorkspaceState();
      return sendJson(res, 200, {
        ok: true,
        patchCell: { diffs: writeRes.diffs },
        message: "Created `AGENTS.md`.",
        state
      });
    }
    if (cmd === "/diff") {
      const diffInfo = await getWorkspaceGitDiff(workspaceRoot);
      return sendJson(res, 200, { ok: true, ...diffInfo });
    }
    const state = await buildWorkspaceState();
    return sendJson(res, 200, { ok: true, lines: [`Executed ${cmd} ${args}`], state });
  }

  if (pathname === "/api/agent/turn" && req.method === "POST") {
    const { prompt, providerConfig = {}, browserDraft = null, attachments = [] } =
      await readJsonBody(req);
    const userPrompt = String(prompt || "").trim() || "Analyze attached media for Roblox Studio";
    const plan = await generateAgentTurnPlan({
      workspaceRoot,
      prompt: userPrompt,
      model: activeSession.model,
      reasoningEffort: activeSession.reasoningEffort,
      planMode: activeSession.planMode,
      providerConfig,
      browserDraft,
      attachments
    });

    const cells = [];
    const executedResults = [];
    if (plan.reasoning) {
      cells.push({
        type: "reasoning",
        model: activeSession.model,
        effort: activeSession.reasoningEffort,
        text: plan.reasoning
      });
    }

    for (const act of plan.actions || []) {
      const result = await executeSingleAction(act);
      executedResults.push(result);
      if (result.kind === "exec") {
        cells.push({ type: "exec", ...result });
      } else if (result.kind === "patch") {
        cells.push({ type: "patch", diffs: result.diffs || [], error: result.error });
      }
    }

    if (plan.robloxAsset) {
      robloxSyncQueue.push({
        id: `rbx_${Date.now()}`,
        name: plan.robloxAsset.name,
        type: plan.robloxAsset.type,
        luauScript: plan.robloxAsset.luauScript
      });
      cells.push({ type: "roblox", asset: plan.robloxAsset });
    }

    const reply =
      typeof plan.finalResponse === "function"
        ? plan.finalResponse({ toolResults: executedResults })
        : String(plan.finalResponse || "Done.");
    cells.push({ type: "assistant", text: reply, model: activeSession.model });

    const state = await buildWorkspaceState();
    return sendJson(res, 200, { ok: true, cells, state });
  }

  // Static files
  const safeRel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(publicDir, safeRel);
  if (filePath.startsWith(publicDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404);
  res.end("Not Found");
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "127.0.0.1", () => {
  console.log(`>_ OpenAI Codex (v${CODEX_VERSION}) Standalone Server running at http://127.0.0.1:${port}`);
});
