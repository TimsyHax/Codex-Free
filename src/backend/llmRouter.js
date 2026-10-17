import fs from "node:fs";
import path from "node:path";
import { MODELS_CATALOG } from "../shared/constants.js";
import { listWorkspaceFiles } from "./tools.js";
import { planLocalAgentTurn } from "./localAgent.js";

export function buildCodexSystemPrompt(workspaceRoot, modelId, reasoningEffort) {
  const files = listWorkspaceFiles(workspaceRoot, ".", 2)
    .filter((f) => f.type === "file")
    .map((f) => f.path)
    .slice(0, 40);

  let agentsMd = "";
  try {
    const agentsPath = path.join(workspaceRoot, "AGENTS.md");
    if (fs.existsSync(agentsPath)) {
      agentsMd = fs.readFileSync(agentsPath, "utf8").slice(0, 1500);
    }
  } catch {}

  return `You are OpenAI Codex (v0.1.0-free), a lightweight coding agent running in the user's terminal.
Current model: ${modelId} (reasoning effort: ${reasoningEffort}) — $0.00 Free Unlimited Plan.
Workspace root: ${workspaceRoot}
Workspace files: ${files.join(", ")}
${agentsMd ? `\nAGENTS.md instructions:\n${agentsMd}\n` : ""}

When the user asks you to inspect, create, edit, or run code in the workspace, respond in valid JSON with this schema:
{
  "reasoning": "Brief 1-2 sentence explanation of your plan",
  "actions": [
    { "type": "read_file", "filePath": "relative/path", "reason": "Why reading" },
    { "type": "write_file", "filePath": "relative/path", "content": "full file content", "reason": "Why writing" },
    { "type": "edit_file", "filePath": "relative/path", "oldText": "exact snippet", "newText": "replacement", "reason": "Why editing" },
    { "type": "apply_patch", "patch": "*** Begin Patch\\n*** Update File: path\\n@@\\n-old\\n+new\\n*** End Patch", "reason": "Why patching" },
    { "type": "shell", "command": "shell command", "reason": "Why running command" },
    { "type": "search_files", "query": "search term", "reason": "Why searching" }
  ],
  "reply": "Clear markdown response to display in the Codex TUI transcript after actions run."
}
Only include actions that are needed. Keep responses concise, technical, and formatted for a terminal TUI.`;
}

export function parseStructuredAgentJson(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && (Array.isArray(parsed.actions) || typeof parsed.reply === "string")) {
      return parsed;
    }
  } catch {}

  // Try extracting JSON code block
  const jsonBlockMatch =
    trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i) ||
    trimmed.match(/(\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\})/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      if (parsed && (Array.isArray(parsed.actions) || typeof parsed.reply === "string")) {
        return parsed;
      }
    } catch {}
  }

  return null;
}

/**
 * Attempts a fast zero-key cloud/local OpenAI-compatible completion,
 * and seamlessly falls back to the built-in Local Autonomous Agent Engine.
 */
export async function generateAgentTurnPlan({
  workspaceRoot,
  prompt,
  model = "gpt-5.1-codex",
  reasoningEffort = "high",
  planMode = false,
  providerConfig = {},
  browserDraft = null,
  attachments = []
}) {
  // Always let the specialized Roblox Studio 3D Model / R15 Animation / Photo-Video engine handle Roblox or media tasks directly
  const localCandidate = await planLocalAgentTurn({
    workspaceRoot,
    prompt,
    model,
    reasoningEffort,
    planMode,
    attachments
  });

  if (localCandidate.robloxAsset || (attachments && attachments.length > 0)) {
    return {
      source: "roblox-studio-engine",
      ...localCandidate
    };
  }

  // 1. If the browser already obtained a structured response from Zero-Key Cloud LLM, use it!
  if (browserDraft && typeof browserDraft === "object") {
    const parsed =
      Array.isArray(browserDraft.actions) || browserDraft.reply
        ? browserDraft
        : parseStructuredAgentJson(browserDraft.rawText);

    if (parsed) {
      return {
        source: browserDraft.provider || "zero-key-browser-cloud",
        reasoning:
          parsed.reasoning ||
          `Analyzed workspace task using ${model} (${reasoningEffort} reasoning · $0.00 Free).`,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        finalResponse: () => parsed.reply || "Task completed."
      };
    }
  }

  const modelMeta = MODELS_CATALOG.find((m) => m.id === model) || MODELS_CATALOG[0];

  // 2. If user didn't explicitly pick offline local-autonomous, try configured endpoint or Ollama/Pollinations with a fast timeout
  if (model !== "local-autonomous" && providerConfig?.mode !== "local-engine") {
    const endpoint =
      providerConfig?.endpoint ||
      (model === "ollama-local"
        ? "http://localhost:11434/v1/chat/completions"
        : "https://text.pollinations.ai/openai/chat/completions");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3200);
      const headers = { "Content-Type": "application/json" };
      if (providerConfig?.apiKey) {
        headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
      }

      const sysPrompt = buildCodexSystemPrompt(workspaceRoot, model, reasoningEffort);
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: providerConfig?.customModel || modelMeta.pollinationsModel || "openai",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || "";
        const structured = parseStructuredAgentJson(content);
        if (structured) {
          return {
            source: "zero-key-cloud",
            reasoning:
              structured.reasoning ||
              `Planned with ${model} (${reasoningEffort} reasoning · $0.00 Free).`,
            actions: Array.isArray(structured.actions) ? structured.actions : [],
            finalResponse: () => structured.reply || content
          };
        }
        if (content.trim()) {
          // If plain text reply AND prompt didn't explicitly ask for local file mutation, use it
          const localPlan = await planLocalAgentTurn({
            workspaceRoot,
            prompt,
            model,
            reasoningEffort,
            planMode
          });
          if (localPlan.actions.length === 0) {
            return {
              source: "zero-key-cloud",
              reasoning: `Generated response via ${model} ($0.00 Free Cloud).`,
              actions: [],
              finalResponse: () => content.trim()
            };
          }
        }
      }
    } catch {
      // Fallback to built-in Local Autonomous Agent Engine
    }
  }

  // 3. Built-in Local Autonomous Agent Engine (works 100% offline/sandboxed with real workspace tools)
  const plan = await planLocalAgentTurn({
    workspaceRoot,
    prompt,
    model,
    reasoningEffort,
    planMode
  });
  return {
    source: "local-autonomous-engine",
    ...plan
  };
}
