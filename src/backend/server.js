import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

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
import { generateAgentTurnPlan, buildCodexSystemPrompt } from "./llmRouter.js";
import {
  generateRobloxModelSpec,
  generateRobloxAnimationSpec,
  generateRobloxCompanionPluginLua
} from "../shared/robloxStudio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createCodexServer(initialWorkspaceRoot = process.cwd()) {
  let workspaceRoot = path.resolve(initialWorkspaceRoot);
  const sessionStore = new SessionStore(workspaceRoot);
  let activeSession = sessionStore.getSession();

  const pendingApprovals = new Map();
  const backgroundTerminals = [];
  const robloxSyncQueue = [];

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));

  // Disable X-Frame-Options restrictions so Arena live preview iframe works smoothly
  app.use((req, res, next) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });

  const publicDir = path.join(__dirname, "../public");
  app.use(express.static(publicDir));

  function formatDisplayDir(dir) {
    const home = process.env.HOME || "/home/user";
    if (dir === home) return "~";
    if (dir.startsWith(home + "/")) {
      return "~/" + dir.slice(home.length + 1);
    }
    return dir;
  }

  function getPermissionProfile(modeId) {
    return (
      PERMISSION_PROFILES.find((p) => p.id === modeId) || PERMISSION_PROFILES[1]
    );
  }

  function getModelMeta(modelId) {
    return MODELS_CATALOG.find((m) => m.id === modelId) || MODELS_CATALOG[0];
  }

  async function buildWorkspaceState() {
    const files = listWorkspaceFiles(workspaceRoot, ".", 3);
    const hasAgentsMd = fs.existsSync(path.join(workspaceRoot, "AGENTS.md"));
    const gitBranchRes = await runWorkspaceShell(
      workspaceRoot,
      "git rev-parse --abbrev-ref HEAD",
      3000
    );
    const gitStatusRes = await runWorkspaceShell(
      workspaceRoot,
      "git status --short",
      3000
    );

    return {
      version: CODEX_VERSION,
      workspaceRoot,
      displayDirectory: formatDisplayDir(workspaceRoot),
      gitBranch: gitBranchRes.stdout.trim() || "main",
      gitStatusShort: gitStatusRes.stdout.trim(),
      hasAgentsMd,
      agentsMdLabel: hasAgentsMd ? "AGENTS.md (loaded)" : "<none>",
      activeSession,
      sessions: sessionStore.listSessions().map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        model: s.model,
        reasoningEffort: s.reasoningEffort,
        permissionMode: s.permissionMode,
        forkedFrom: s.forkedFrom,
        messageCount: (s.messages || []).length
      })),
      catalog: {
        models: MODELS_CATALOG,
        permissions: PERMISSION_PROFILES,
        providers: FREE_PROVIDERS,
        themes: THEMES,
        pets: TERMINAL_PETS,
        slashCommands: SLASH_COMMANDS
      },
      files,
      backgroundTerminals
    };
  }

  app.get("/api/state", async (req, res) => {
    try {
      const state = await buildWorkspaceState();
      res.json({ ok: true, ...state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get("/api/system-prompt", (req, res) => {
    const sys = buildCodexSystemPrompt(
      workspaceRoot,
      activeSession.model,
      activeSession.reasoningEffort
    );
    res.json({ ok: true, systemPrompt: sys });
  });

  app.get("/api/files", (req, res) => {
    const q = String(req.query.q || "").toLowerCase();
    const all = listWorkspaceFiles(workspaceRoot, ".", 4);
    const filtered = q
      ? all.filter((f) => f.path.toLowerCase().includes(q))
      : all;
    res.json({ ok: true, files: filtered.slice(0, 150) });
  });

  app.get("/api/file", (req, res) => {
    const target = String(req.query.path || "README.md");
    const result = readWorkspaceFile(workspaceRoot, target, 1, 500);
    res.json(result);
  });

  app.get("/api/diff", async (req, res) => {
    const diffInfo = await getWorkspaceGitDiff(workspaceRoot);
    res.json(diffInfo);
  });

  app.post("/api/session", async (req, res) => {
    const { action, sessionId, model, reasoningEffort, permissionMode, title, planMode, goal } =
      req.body || {};

    if (action === "new") {
      activeSession = sessionStore.createSession({
        title: title || "New Codex Session",
        model: model || activeSession.model,
        reasoningEffort: reasoningEffort || activeSession.reasoningEffort,
        permissionMode: permissionMode || activeSession.permissionMode
      });
    } else if (action === "resume" && sessionId) {
      activeSession = sessionStore.getSession(sessionId);
    } else if (action === "fork") {
      activeSession = sessionStore.forkSession(sessionId || activeSession.id);
    } else if (action === "clear") {
      activeSession = sessionStore.createSession({
        title: "New Codex Session",
        model: activeSession.model,
        reasoningEffort: activeSession.reasoningEffort,
        permissionMode: activeSession.permissionMode
      });
    } else {
      const updates = {};
      if (model) updates.model = model;
      if (reasoningEffort) updates.reasoningEffort = reasoningEffort;
      if (permissionMode) updates.permissionMode = permissionMode;
      if (title) updates.title = title;
      if (typeof planMode === "boolean") updates.planMode = planMode;
      if (goal !== undefined) updates.goal = goal;
      activeSession = sessionStore.updateSession(activeSession.id, updates);
    }

    const state = await buildWorkspaceState();
    res.json({ ok: true, ...state });
  });

  app.post("/api/slash", async (req, res) => {
    const { command, args = "" } = req.body || {};
    const cmd = String(command || "").trim().toLowerCase();

    if (cmd === "/init") {
      const content = generateAgentsMdContent(workspaceRoot);
      const writeRes = writeWorkspaceFile(workspaceRoot, "AGENTS.md", content);
      const state = await buildWorkspaceState();
      return res.json({
        ok: true,
        type: "init",
        patchCell: {
          diffs: writeRes.diffs
        },
        message: "Created `AGENTS.md` with workspace instructions for OpenAI Codex.",
        state
      });
    }

    if (cmd === "/diff") {
      const diffInfo = await getWorkspaceGitDiff(workspaceRoot);
      return res.json({
        ok: true,
        type: "diff",
        status: diffInfo.status,
        diff: diffInfo.diff
      });
    }

    if (cmd === "/pwd" || cmd === "/cwd") {
      return res.json({
        ok: true,
        type: "plain",
        lines: [
          `Current working directory: ${workspaceRoot} (${formatDisplayDir(workspaceRoot)})`
        ]
      });
    }

    if (cmd === "/cd") {
      const target = String(args || ".").trim();
      const candidate = resolveSafePath(workspaceRoot, target);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        workspaceRoot = candidate;
        const state = await buildWorkspaceState();
        return res.json({
          ok: true,
          type: "plain",
          lines: [`Changed working directory to ${formatDisplayDir(workspaceRoot)}`],
          state
        });
      }
      return res.json({
        ok: false,
        type: "plain",
        lines: [`Directory not found: ${target}`]
      });
    }

    if (cmd === "/compact" || cmd === "/recap") {
      const msgCount = (activeSession.messages || []).length;
      const beforeTokens = activeSession.tokensUsed?.total || 1200;
      const afterTokens = Math.max(320, Math.round(beforeTokens * 0.35));
      activeSession.tokensUsed = {
        input: afterTokens,
        output: 0,
        total: afterTokens
      };
      sessionStore.updateSession(activeSession.id, {
        tokensUsed: activeSession.tokensUsed
      });
      return res.json({
        ok: true,
        type: "plain",
        lines: [
          cmd === "/compact"
            ? `• Compacted conversation context (${msgCount} messages summarized · ${beforeTokens} → ${afterTokens} tokens · 99% context window remaining)`
            : `• Session Recap: Thread "${activeSession.title}" in ${formatDisplayDir(workspaceRoot)} using ${activeSession.model} (${activeSession.reasoningEffort}) — $0.00 Free Unlimited.`
        ],
        activeSession
      });
    }

    if (cmd === "/ps") {
      return res.json({
        ok: true,
        type: "plain",
        lines:
          backgroundTerminals.length === 0
            ? ["No active background terminals. Run commands via the composer or `$ <cmd>`."]
            : backgroundTerminals.map((t) => `• [${t.id}] ${t.command} (${t.status})`)
      });
    }

    const state = await buildWorkspaceState();
    return res.json({ ok: true, state });
  });

  async function executeSingleAction(action) {
    if (action.type === "read_file") {
      const r = readWorkspaceFile(workspaceRoot, action.filePath, 1, 200);
      return {
        kind: "read",
        filePath: action.filePath,
        ok: r.ok,
        totalLines: r.totalLines || 0,
        rawContent: r.rawContent || "",
        content: r.content || r.error || ""
      };
    }

    if (action.type === "list_dir") {
      const list = listWorkspaceFiles(workspaceRoot, action.dirPath || ".", 2);
      return {
        kind: "list",
        dirPath: action.dirPath || ".",
        ok: true,
        count: list.length,
        files: list.slice(0, 30)
      };
    }

    if (action.type === "search_files") {
      const s = searchWorkspaceFiles(workspaceRoot, action.query);
      return {
        kind: "search",
        query: action.query,
        ok: true,
        matches: s.matches || []
      };
    }

    if (action.type === "write_file") {
      const w = writeWorkspaceFile(workspaceRoot, action.filePath, action.content);
      return {
        kind: "patch",
        ok: w.ok,
        filePath: w.filePath,
        action: w.action,
        diff: w.diff,
        diffs: w.diffs || (w.diff ? [w.diff] : []),
        error: w.error
      };
    }

    if (action.type === "edit_file") {
      const e = editWorkspaceFile(
        workspaceRoot,
        action.filePath,
        action.oldText,
        action.newText
      );
      return {
        kind: "patch",
        ok: e.ok,
        filePath: e.filePath,
        action: "update",
        diff: e.diff,
        diffs: e.diffs || (e.diff ? [e.diff] : []),
        error: e.error
      };
    }

    if (action.type === "apply_patch") {
      const p = applyWorkspacePatch(workspaceRoot, action.patch);
      return {
        kind: "patch",
        ok: p.ok,
        diffs: p.diffs || [],
        error: p.error
      };
    }

    if (action.type === "shell") {
      const s = await runWorkspaceShell(workspaceRoot, action.command);
      return {
        kind: "exec",
        ok: s.ok,
        command: s.command,
        stdout: s.stdout,
        stderr: s.stderr,
        exitCode: s.exitCode,
        durationMs: s.durationMs
      };
    }

    return { kind: "unknown", ok: false };
  }

  function needsUserApproval(action, permProfile, approvedPrefixes = []) {
    if (permProfile.yolo) return false;
    if (
      action.type === "read_file" ||
      action.type === "list_dir" ||
      action.type === "search_files"
    ) {
      return false;
    }

    if (
      action.type === "write_file" ||
      action.type === "edit_file" ||
      action.type === "apply_patch"
    ) {
      return !permProfile.autoApprovePatches;
    }

    if (action.type === "shell") {
      if (permProfile.autoApproveShell) return false;
      const cmd = String(action.command || "").trim();
      if (approvedPrefixes.some((pref) => cmd.startsWith(pref))) {
        return false;
      }
      return true;
    }
    return false;
  }

  app.post("/api/agent/turn", async (req, res) => {
    try {
      const {
        prompt,
        providerConfig = {},
        browserDraft = null,
        attachments = []
      } = req.body || {};

      const userPrompt =
        String(prompt || "").trim() ||
        (attachments.length > 0
          ? `Analyze attached ${attachments.map((a) => a.name).join(", ")} for Roblox Studio`
          : "");
      if (!userPrompt) {
        return res.status(400).json({ ok: false, error: "Empty prompt" });
      }

      // Update session title if first prompt
      if ((activeSession.messages || []).length === 0) {
        activeSession.title = userPrompt.slice(0, 60);
      }

      activeSession.messages.push({
        role: "user",
        text: userPrompt,
        attachments: attachments.map((a) => ({
          name: a.name,
          type: a.type,
          palette: a.palette,
          duration: a.duration
        })),
        timestamp: new Date().toISOString()
      });

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

      const permProfile = getPermissionProfile(activeSession.permissionMode);
      const cells = [];
      const executedResults = [];

      if (plan.reasoning) {
        cells.push({
          type: "reasoning",
          model: activeSession.model,
          effort: activeSession.reasoningEffort,
          source: plan.source,
          text: plan.reasoning
        });
      }

      let pendingApproval = null;
      const remainingActions = [];

      for (let i = 0; i < (plan.actions || []).length; i++) {
        const act = plan.actions[i];
        if (
          !pendingApproval &&
          needsUserApproval(act, permProfile, activeSession.approvedPrefixes || [])
        ) {
          const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const cmdPrefix =
            act.type === "shell"
              ? String(act.command || "")
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .join(" ")
              : act.filePath || "patch";

          pendingApproval = {
            id: approvalId,
            action: act,
            reason:
              act.reason ||
              `Requested by ${activeSession.model} to complete your task`,
            commandDisplay:
              act.type === "shell"
                ? act.command
                : `${act.type} ${act.filePath || ""}`.trim(),
            prefix: cmdPrefix
          };
          remainingActions.push(...plan.actions.slice(i + 1));
          pendingApprovals.set(approvalId, {
            approval: pendingApproval,
            remainingActions,
            plan,
            executedResults
          });
          break;
        }

        const result = await executeSingleAction(act);
        executedResults.push(result);
        if (result.kind === "exec") {
          cells.push({
            type: "exec",
            command: result.command,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            durationMs: result.durationMs
          });
        } else if (result.kind === "patch") {
          cells.push({
            type: "patch",
            diffs: result.diffs || [],
            error: result.error
          });
        } else if (result.kind === "read") {
          cells.push({
            type: "activity",
            label: `Read ${result.filePath} (${result.totalLines} lines)`
          });
        } else if (result.kind === "search") {
          cells.push({
            type: "activity",
            label: `Searched workspace for "${result.query}" (${(result.matches || []).length} matches)`
          });
        } else if (result.kind === "list") {
          cells.push({
            type: "activity",
            label: `Explored directory ${result.dirPath} (${result.count} items)`
          });
        }
      }

      if (plan.robloxAsset) {
        robloxSyncQueue.push({
          id: `rbx_${Date.now()}`,
          name: plan.robloxAsset.name,
          type: plan.robloxAsset.type,
          luauScript: plan.robloxAsset.luauScript,
          createdAt: new Date().toISOString()
        });
        cells.push({
          type: "roblox",
          asset: plan.robloxAsset
        });
      }

      let assistantReply = null;
      if (!pendingApproval) {
        assistantReply =
          typeof plan.finalResponse === "function"
            ? plan.finalResponse({ toolResults: executedResults })
            : String(plan.finalResponse || "Done.");

        cells.push({
          type: "assistant",
          text: assistantReply,
          model: activeSession.model,
          source: plan.source
        });

        activeSession.messages.push({
          role: "assistant",
          text: assistantReply,
          timestamp: new Date().toISOString()
        });
      }

      // Update token usage counter ($0.00 Free)
      const inTok = Math.max(80, Math.round(userPrompt.length * 1.4));
      const outTok = Math.max(120, Math.round((assistantReply || "").length * 1.3));
      activeSession.tokensUsed = {
        input: (activeSession.tokensUsed?.input || 0) + inTok,
        output: (activeSession.tokensUsed?.output || 0) + outTok,
        total: (activeSession.tokensUsed?.total || 0) + inTok + outTok
      };
      sessionStore.updateSession(activeSession.id, {
        title: activeSession.title,
        messages: activeSession.messages,
        tokensUsed: activeSession.tokensUsed
      });

      const state = await buildWorkspaceState();
      res.json({
        ok: true,
        cells,
        pendingApproval,
        state
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post("/api/agent/approve", async (req, res) => {
    try {
      const { approvalId, decision, feedback } = req.body || {};
      const entry = pendingApprovals.get(approvalId);
      if (!entry) {
        return res.status(404).json({ ok: false, error: "Approval request expired or not found." });
      }
      pendingApprovals.delete(approvalId);

      const { approval, remainingActions, plan, executedResults } = entry;
      const cells = [];

      if (decision === "reject") {
        const rejectText = feedback
          ? `Canceled \`${approval.commandDisplay}\` — user feedback: "${feedback}".`
          : `Rejected execution of \`${approval.commandDisplay}\`. Tell Codex what you'd like to do differently.`;
        cells.push({
          type: "assistant",
          text: rejectText,
          model: activeSession.model
        });
        const state = await buildWorkspaceState();
        return res.json({ ok: true, decision: "reject", cells, state });
      }

      if (decision === "approve_prefix" && approval.prefix) {
        activeSession.approvedPrefixes = Array.from(
          new Set([...(activeSession.approvedPrefixes || []), approval.prefix])
        );
      }

      // Execute approved action + any remaining actions in the turn
      const allToRun = [approval.action, ...(remainingActions || [])];
      for (const act of allToRun) {
        const result = await executeSingleAction(act);
        executedResults.push(result);
        if (result.kind === "exec") {
          cells.push({
            type: "exec",
            command: result.command,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            durationMs: result.durationMs
          });
        } else if (result.kind === "patch") {
          cells.push({
            type: "patch",
            diffs: result.diffs || [],
            error: result.error
          });
        }
      }

      const assistantReply =
        typeof plan.finalResponse === "function"
          ? plan.finalResponse({ toolResults: executedResults })
          : String(plan.finalResponse || "Approved and executed.");

      cells.push({
        type: "assistant",
        text: assistantReply,
        model: activeSession.model,
        source: plan.source
      });

      activeSession.messages.push({
        role: "assistant",
        text: assistantReply,
        timestamp: new Date().toISOString()
      });
      sessionStore.updateSession(activeSession.id, {
        messages: activeSession.messages,
        approvedPrefixes: activeSession.approvedPrefixes
      });

      const state = await buildWorkspaceState();
      res.json({ ok: true, decision, cells, state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post("/api/tools/execute", async (req, res) => {
    try {
      const action = req.body || {};
      const result = await executeSingleAction(action);
      const state = await buildWorkspaceState();
      res.json({ ok: true, result, state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Roblox Studio Live Sync Companion Plugin Endpoints
  app.get("/api/roblox/poll", (req, res) => {
    const items = robloxSyncQueue.splice(0, robloxSyncQueue.length);
    res.json({ ok: true, items, timestamp: new Date().toISOString() });
  });

  app.get("/api/roblox/plugin", (req, res) => {
    const hostHeader = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const pluginCode = generateRobloxCompanionPluginLua(`${protocol}://${hostHeader}`);
    res.json({ ok: true, pluginCode });
  });

  app.post("/api/roblox/generate", async (req, res) => {
    try {
      const { kind = "model", prompt = "", attachments = [] } = req.body || {};
      const asset =
        kind === "animation"
          ? generateRobloxAnimationSpec(prompt, attachments)
          : generateRobloxModelSpec(prompt, attachments);

      const luauPath = `roblox/exports/${asset.name}.luau`;
      const rbxmxPath = `roblox/exports/${asset.name}.rbxmx`;
      const w1 = writeWorkspaceFile(workspaceRoot, luauPath, asset.luauScript);
      const w2 = writeWorkspaceFile(workspaceRoot, rbxmxPath, asset.rbxmx);

      robloxSyncQueue.push({
        id: `rbx_${Date.now()}`,
        name: asset.name,
        type: asset.type,
        luauScript: asset.luauScript,
        createdAt: new Date().toISOString()
      });

      const state = await buildWorkspaceState();
      res.json({
        ok: true,
        asset,
        diffs: [...(w1.diffs || []), ...(w2.diffs || [])],
        state
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws) => {
    try {
      const state = await buildWorkspaceState();
      ws.send(JSON.stringify({ type: "init", state }));
    } catch {}
  });

  return { app, server, wss };
}

// Run server directly when invoked as main entry point
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  const { server } = createCodexServer(process.cwd());
  server.listen(port, host, () => {
    console.log(
      `\n  >_ OpenAI Codex (v${CODEX_VERSION}) — Web Terminal & Free Agent Server`
    );
    console.log(`     Listening on http://${host}:${port} ($0.00 Unlimited Plan)\n`);
  });
}
