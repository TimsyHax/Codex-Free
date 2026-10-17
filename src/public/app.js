// OpenAI Codex (v0.1.0-free) — 1:1 Interactive TUI, Roblox Studio 3D/R15 Engine & Media Client
import {
  createRobloxViewportController,
  analyzeMediaFile,
  createDemoPhotoAttachment,
  createDemoVideoAttachment
} from "./robloxViewport.js";

const state = {
  version: "0.1.0-free",
  workspaceRoot: "",
  displayDirectory: "~/Codex-Free",
  gitBranch: "main",
  gitStatusShort: "",
  hasAgentsMd: true,
  agentsMdLabel: "AGENTS.md (loaded)",
  activeSession: {
    id: "thread_init",
    title: "New Codex Session",
    model: "gpt-5.1-codex",
    reasoningEffort: "high",
    permissionMode: "auto-edit",
    planMode: false,
    goal: null,
    tokensUsed: { input: 420, output: 0, total: 420 }
  },
  sessions: [],
  catalog: {
    models: [],
    permissions: [],
    providers: [],
    themes: [],
    pets: [],
    slashCommands: []
  },
  files: [],
  selectedFile: "README.md",
  providerConfig: {
    mode: "auto-free",
    endpoint: "",
    apiKey: "",
    customModel: ""
  },
  attachments: [],
  activeRobloxAsset: null,
  vimMode: false,
  activePet: "none",
  promptHistory: [],
  historyIndex: -1,
  overlay: null,
  pendingApproval: null,
  isWorking: false
};

// DOM Elements
const elTranscript = document.getElementById("tui-transcript");
const elOverlay = document.getElementById("tui-overlay");
const elWorkingBar = document.getElementById("tui-working-bar");
const elWorkingText = document.getElementById("working-text");
const elWorkingSpinner = document.getElementById("working-spinner");
const elComposerInput = document.getElementById("composer-input");
const elComposerSend = document.getElementById("composer-send-btn");
const elAttachmentsStrip = document.getElementById("composer-attachments-strip");
const elMediaFileInput = document.getElementById("media-file-input");
const elPlanBanner = document.getElementById("composer-plan-banner");
const elPetWidget = document.getElementById("terminal-pet-widget");

const elTopVersion = document.getElementById("top-version");
const elTopCwd = document.getElementById("top-cwd");
const elTopBranch = document.getElementById("top-branch");
const elTopModelLabel = document.getElementById("top-model-label");
const elTopPermLabel = document.getElementById("top-perm-label");
const elTopFileCount = document.getElementById("top-file-count");
const elFooterContext = document.getElementById("footer-context-left");
const elFooterProvider = document.getElementById("footer-provider-tag");

const elDrawer = document.getElementById("workspace-drawer");
const elFileList = document.getElementById("drawer-file-list");
const elPreviewFileName = document.getElementById("preview-file-name");
const elPreviewFileCode = document.getElementById("preview-file-code");
const elDiffContent = document.getElementById("drawer-diff-content");

// Drawer Roblox Stage Elements
const elDrawerCanvas = document.getElementById("drawer-roblox-canvas");
const elRbxStageTitle = document.getElementById("rbx-stage-title");
const elRbxStageBadge = document.getElementById("rbx-stage-badge");
const elRbxSlider = document.getElementById("rbx-timeline-slider");
const elRbxPlayBtn = document.getElementById("btn-rbx-play-toggle");

let drawerViewport = null;
let spinnerTimer = null;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Initialize App
async function initApp() {
  bindEvents();
  initDrawerRobloxViewport();
  await fetchWorkspaceState();
  renderInitialSessionTranscript();
  await loadFilePreview("README.md");
  await refreshDiffViewer();
  elComposerInput.focus();
}

async function initDrawerRobloxViewport() {
  if (!elDrawerCanvas) return;
  drawerViewport = createRobloxViewportController(elDrawerCanvas, null, (t, dur) => {
    if (elRbxSlider && dur > 0) {
      elRbxSlider.value = String(Math.round((t / dur) * 100));
    }
  });
  // Load initial showcase 3D model into the drawer viewport
  try {
    const res = await fetch("/api/roblox/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "model", prompt: "Aegis Titan Mech" })
    });
    const data = await res.json();
    if (data.ok && data.asset) {
      updateDrawerRobloxStage(data.asset);
      if (data.state) applyServerState(data.state);
    }
  } catch {}
}

function updateDrawerRobloxStage(asset) {
  if (!asset) return;
  state.activeRobloxAsset = asset;
  if (drawerViewport) {
    drawerViewport.setAsset(asset);
  }
  if (elRbxStageTitle) {
    elRbxStageTitle.textContent =
      asset.type === "roblox_animation"
        ? `${asset.name} (${asset.keyframeCount} keyframes · ${asset.duration}s)`
        : `${asset.name} (${asset.partCount} parts)`;
  }
  if (elRbxStageBadge) {
    elRbxStageBadge.textContent =
      asset.type === "roblox_animation" ? "R15 ANIMATION" : "3D MODEL";
  }
}

async function fetchWorkspaceState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    if (data.ok) {
      applyServerState(data);
    }
  } catch (err) {
    console.error("Failed to fetch state:", err);
  }
}

function applyServerState(data) {
  if (!data) return;
  state.version = data.version || state.version;
  state.workspaceRoot = data.workspaceRoot || state.workspaceRoot;
  state.displayDirectory = data.displayDirectory || state.displayDirectory;
  state.gitBranch = data.gitBranch || state.gitBranch;
  state.gitStatusShort = data.gitStatusShort ?? state.gitStatusShort;
  state.hasAgentsMd = Boolean(data.hasAgentsMd);
  state.agentsMdLabel =
    data.agentsMdLabel || (state.hasAgentsMd ? "AGENTS.md (loaded)" : "<none>");
  if (data.activeSession) state.activeSession = data.activeSession;
  if (data.sessions) state.sessions = data.sessions;
  if (data.catalog) state.catalog = data.catalog;
  if (data.files) state.files = data.files;

  updateChromeUI();
  renderFileList();
}

function getPermissionProfile(id) {
  return (
    (state.catalog.permissions || []).find((p) => p.id === id) || {
      id: "auto-edit",
      label: "Auto Edit (Workspace Write + Ask for Shell Commands)",
      shortLabel: "Auto Edit (workspace write, ask for shell)",
      yolo: false
    }
  );
}

function getModelMeta(id) {
  return (
    (state.catalog.models || []).find((m) => m.id === id) || {
      id: "gpt-5.1-codex",
      label: "gpt-5.1-codex",
      contextWindow: 272000,
      efforts: ["low", "medium", "high", "xhigh"]
    }
  );
}

function updateChromeUI() {
  const sess = state.activeSession;
  const perm = getPermissionProfile(sess.permissionMode);
  const modelMeta = getModelMeta(sess.model);

  elTopVersion.textContent = `(v${state.version})`;
  elTopCwd.textContent = state.displayDirectory;
  elTopBranch.textContent = state.gitBranch;
  elTopModelLabel.textContent = `${sess.model} (${sess.reasoningEffort})`;
  elTopPermLabel.textContent = perm.yolo ? "YOLO mode" : perm.id;
  const onlyFiles = (state.files || []).filter((f) => f.type === "file");
  elTopFileCount.textContent = String(onlyFiles.length);

  if (sess.planMode) {
    elPlanBanner.classList.remove("hidden");
  } else {
    elPlanBanner.classList.add("hidden");
  }

  const used = sess.tokensUsed?.total || 420;
  const maxWin = modelMeta.contextWindow || 272000;
  const pctLeft = Math.max(1, Math.min(100, Math.round(((maxWin - used) / maxWin) * 100)));
  elFooterContext.textContent = `${pctLeft}% context left (${formatTokens(used)} / ${formatTokens(maxWin)})`;

  const modeLabel =
    state.providerConfig.mode === "local-engine"
      ? "Local Autonomous Engine ($0.00)"
      : state.providerConfig.mode === "ollama"
      ? "Local Ollama ($0.00)"
      : "Zero-Key Free AI ($0.00)";
  elFooterProvider.textContent = `${modeLabel}${state.vimMode ? " · [VIM]" : ""}`;
}

function formatTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render Attachments Strip in Composer
function renderComposerAttachments() {
  if (!elAttachmentsStrip) return;
  if (state.attachments.length === 0) {
    elAttachmentsStrip.classList.add("hidden");
    elAttachmentsStrip.innerHTML = "";
    return;
  }

  elAttachmentsStrip.classList.remove("hidden");
  elAttachmentsStrip.innerHTML = state.attachments
    .map((att) => {
      const swatches = (att.palette || [])
        .map(
          (hex) =>
            `<span class="color-swatch-dot" style="background:${escapeHtml(hex)}" title="${escapeHtml(
              hex
            )}"></span>`
        )
        .join("");

      const badgeText =
        att.type === "video"
          ? `🎥 Video Mocap (${att.motionFrames?.length || 6} frames · ${att.duration || 1.8}s)`
          : `📸 Photo Ref (${att.width || 512}×${att.height || 512})`;

      return `
        <div class="attachment-chip" data-id="${escapeHtml(att.id)}">
          ${
            att.previewUrl
              ? `<img src="${att.previewUrl}" class="attachment-thumb" alt="${escapeHtml(att.name)}" />`
              : `<div class="attachment-thumb" style="display:flex;align-items:center;justify-content:center;">${
                  att.type === "video" ? "🎬" : "🖼️"
                }</div>`
          }
          <div class="attachment-meta">
            <span class="attachment-name">${escapeHtml(att.name)}</span>
            <div class="attachment-swatches">
              <span class="brand-version">${escapeHtml(badgeText)}</span>
              ${swatches}
            </div>
          </div>
          <button class="attachment-remove" data-remove="${escapeHtml(att.id)}" title="Remove attachment">✕</button>
        </div>
      `;
    })
    .join("");

  elAttachmentsStrip.querySelectorAll(".attachment-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove");
      state.attachments = state.attachments.filter((a) => a.id !== id);
      renderComposerAttachments();
    });
  });
}

// Render Initial OpenAI Codex Session Header + Help Block
function renderInitialSessionTranscript() {
  elTranscript.innerHTML = "";
  appendSessionHeaderCell();
  appendStartupHelpCell();
}

function appendSessionHeaderCell() {
  const sess = state.activeSession;
  const perm = getPermissionProfile(sess.permissionMode);
  const cell = document.createElement("div");
  cell.className = "tui-session-box";
  cell.innerHTML = `
    <div class="session-box-title">
      <span class="brand-prompt">&gt;_</span>
      <span class="brand-title">OpenAI Codex</span>
      <span class="brand-version">(v${escapeHtml(state.version)})</span>
      <span class="free-inline-badge">· ∞ Pro 200 + Roblox Studio Unlocked ($0.00 FREE)</span>
    </div>
    <div class="session-box-grid">
      <span class="session-key">model:</span>
      <span class="session-val">${escapeHtml(sess.model)} (${escapeHtml(sess.reasoningEffort)}) <span class="brand-version">· /model to change</span></span>
      <span class="session-key">directory:</span>
      <span class="session-val">${escapeHtml(state.displayDirectory)}</span>
      <span class="session-key">permissions:</span>
      <span class="session-val">${
        perm.yolo
          ? `<span class="yolo-badge">YOLO mode</span>`
          : escapeHtml(perm.shortLabel)
      } <span class="brand-version">· /permissions to change</span></span>
      <span class="session-key">roblox sync:</span>
      <span class="session-val"><span class="free-inline-badge">Active (.rbxmx + Luau + R15 KeyframeSequence + Photo/Video Capture)</span></span>
    </div>
  `;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendStartupHelpCell() {
  const help = document.createElement("div");
  help.className = "tui-startup-help";
  const cmds = [
    ["/model3d", "generate a high-precision multi-part Roblox Studio 3D model (.rbxmx + Luau)"],
    ["/animate", "generate an accurate R15/R6 Roblox Studio KeyframeSequence animation"],
    ["/attach", "attach photos (for 3D model color/shape) or videos (for R15 motion capture)"],
    ["/plugin", "export the Roblox Studio Live HttpService Sync Companion Plugin"],
    ["/status", "show current session configuration and unlimited free plan status"],
    ["/model", "choose what model and reasoning effort to use"],
    ["/diff", "show git diff (including untracked files)"]
  ];

  help.innerHTML = `
    <div class="startup-help-lead">To get started, describe a coding or Roblox Studio task, drop a photo/video, or try one of these commands:</div>
    ${cmds
      .map(
        ([c, desc]) => `
      <div class="startup-cmd-row">
        <span class="startup-cmd-trigger" data-cmd="${c}">${c}</span>
        <span>- ${escapeHtml(desc)}</span>
      </div>`
      )
      .join("")}
  `;

  help.querySelectorAll(".startup-cmd-trigger").forEach((el) => {
    el.addEventListener("click", () => {
      const cmd = el.getAttribute("data-cmd");
      handleUserSubmission(cmd);
    });
  });

  elTranscript.appendChild(help);
  scrollToBottom();
}

function appendUserCell(text, attachedList = []) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-user";
  const formatted = escapeHtml(text).replace(
    /@([a-zA-Z0-9_./-]+)/g,
    `<span class="mention-token">@$1</span>`
  );

  const attHtml =
    attachedList && attachedList.length > 0
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;padding-left:18px;">
          ${attachedList
            .map(
              (a) => `
            <div class="attachment-chip">
              ${
                a.previewUrl
                  ? `<img src="${a.previewUrl}" class="attachment-thumb" alt="${escapeHtml(a.name)}" />`
                  : `<span>${a.type === "video" ? "🎬" : "📸"}</span>`
              }
              <div class="attachment-meta">
                <span class="attachment-name">${escapeHtml(a.name)}</span>
                <div class="attachment-swatches">
                  <span class="brand-version">${
                    a.type === "video"
                      ? `Video Mocap (${a.motionFrames?.length || 6} frames)`
                      : "Photo Reference"
                  }</span>
                  ${(a.palette || [])
                    .map(
                      (hex) =>
                        `<span class="color-swatch-dot" style="background:${escapeHtml(hex)}"></span>`
                    )
                    .join("")}
                </div>
              </div>
            </div>`
            )
            .join("")}
        </div>`
      : "";

  cell.innerHTML = `
    <div class="cell-user-line">
      <span class="user-glyph">›</span>
      <span>${formatted}</span>
    </div>
    ${attHtml}
  `;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendRobloxAssetCell(asset) {
  if (!asset) return;
  updateDrawerRobloxStage(asset);

  const cell = document.createElement("div");
  cell.className = "history-cell inline-roblox-cell";
  const isAnim = asset.type === "roblox_animation";

  cell.innerHTML = `
    <div class="roblox-stage-header">
      <span>${isAnim ? "🎬 R15 Animation Rig Preview:" : "🧱 3D Roblox Model Viewport:"} ${escapeHtml(
    asset.name
  )}</span>
      <span class="free-badge-mini">${
        isAnim
          ? `${asset.keyframeCount} Keyframes · ${asset.duration}s`
          : `${asset.partCount} Precision Parts`
      }</span>
    </div>
    <canvas width="640" height="260" class="roblox-canvas"></canvas>
    <div class="roblox-stage-controls">
      <button class="mini-action-btn btn-inline-play">⏸ Pause</button>
      <input type="range" min="0" max="100" value="0" class="rbx-slider inline-slider" />
      <button class="mini-action-btn btn-inline-rbxmx">⬇ Download .rbxmx</button>
      <button class="mini-action-btn btn-inline-luau">📋 Copy Luau Script</button>
    </div>
  `;

  elTranscript.appendChild(cell);
  const canvas = cell.querySelector("canvas");
  const slider = cell.querySelector(".inline-slider");
  const playBtn = cell.querySelector(".btn-inline-play");

  const controller = createRobloxViewportController(canvas, asset, (t, dur) => {
    if (slider && dur > 0) {
      slider.value = String(Math.round((t / dur) * 100));
    }
  });

  playBtn?.addEventListener("click", () => {
    const playing = controller.togglePlay();
    playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
  });

  slider?.addEventListener("input", (e) => {
    controller.setNormalizedTime(e.target.value);
  });

  cell.querySelector(".btn-inline-rbxmx")?.addEventListener("click", () => {
    downloadTextFile(`${asset.name}.rbxmx`, asset.rbxmx, "application/xml");
  });

  cell.querySelector(".btn-inline-luau")?.addEventListener("click", async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(asset.luauScript);
      appendPlainCell([`• Copied ${asset.name}.luau Command Bar script to clipboard!`]);
    }
  });

  scrollToBottom();
}

function downloadTextFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content || ""], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function appendPlainCell(lines = []) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-reasoning";
  cell.innerHTML = lines
    .map((l) => `<div style="padding-left: 6px;">${escapeHtml(l)}</div>`)
    .join("");
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendReasoningCell({ model, effort, text }) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-reasoning";
  cell.innerHTML = `
    <div class="reasoning-header">
      <span class="bullet-dim">•</span>
      <span>Thinking (${escapeHtml(model || state.activeSession.model)} · reasoning: ${escapeHtml(effort || state.activeSession.reasoningEffort)})</span>
    </div>
    <div class="reasoning-body">${escapeHtml(text)}</div>
  `;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendActivityCell(label) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-reasoning";
  cell.innerHTML = `
    <div class="reasoning-header">
      <span class="bullet-dim">•</span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendExecCell({ command, stdout, stderr, exitCode, durationMs }) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-exec";
  const parts = String(command || "").trim().split(/\s+/);
  const bin = parts[0] || "";
  const args = parts.slice(1).join(" ");
  const ok = exitCode === 0;

  const combinedOut = [stdout, stderr].filter(Boolean).join("\n").trim();
  const outLines = combinedOut ? combinedOut.split("\n") : [];
  const previewLines = outLines.slice(0, 18);

  cell.innerHTML = `
    <div class="exec-header">
      <span class="${ok ? "exec-bullet-ok" : "exec-bullet-err"}">•</span>
      <span class="exec-status-label">${ok ? "Ran" : `Exited (status ${exitCode})`}</span>
      <span class="exec-cmd-bin">${escapeHtml(bin)}</span>
      <span class="exec-cmd-args">${escapeHtml(args)}</span>
      <span class="exec-duration">(${durationMs ?? 0}ms)</span>
    </div>
    ${
      previewLines.length > 0
        ? `<div class="exec-output-tree">${previewLines
            .map(
              (line, idx) =>
                `<div><span class="exec-tree-branch">${idx === 0 ? "  └ " : "    "}</span><span class="${
                  !ok && stderr ? "exec-stderr" : ""
                }">${escapeHtml(line)}</span></div>`
            )
            .join("")}${
            outLines.length > previewLines.length
              ? `<div><span class="exec-tree-branch">    </span><span class="exec-duration">... +${
                  outLines.length - previewLines.length
                } more output lines</span></div>`
              : ""
          }</div>`
        : ""
    }
  `;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendPatchCell({ diffs = [], error }) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-patch";

  if (error) {
    cell.innerHTML = `
      <div class="patch-header" style="color: var(--accent-red);">
        <span>✘ Failed to apply patch</span>
      </div>
      <div class="exec-output-tree">  └ ${escapeHtml(error)}</div>
    `;
    elTranscript.appendChild(cell);
    scrollToBottom();
    return;
  }

  const totalAdd = diffs.reduce((acc, d) => acc + (d.added || 0), 0);
  const totalDel = diffs.reduce((acc, d) => acc + (d.removed || 0), 0);

  let title = `Edited ${diffs.length} files`;
  if (diffs.length === 1) {
    const d0 = diffs[0];
    if (d0.action === "add") title = `Added ${d0.filePath}`;
    else if (d0.action === "delete") title = `Deleted ${d0.filePath}`;
    else title = `Edited ${d0.filePath}`;
  }

  const filesHtml = diffs
    .map((d) => {
      const rows = (d.lines || []).slice(0, 22);
      const rowsHtml = rows
        .map((r) => {
          if (r.type === "gap") {
            return `<div class="diff-row diff-row-ctx"><span class="diff-lineno">⋮</span><span class="diff-sign"> </span><span></span></div>`;
          }
          const cls =
            r.type === "add"
              ? "diff-row-add"
              : r.type === "del"
              ? "diff-row-del"
              : "diff-row-ctx";
          const sign = r.type === "add" ? "+" : r.type === "del" ? "-" : " ";
          const num = r.type === "del" ? r.oldLine : r.newLine ?? r.oldLine ?? "";
          return `<div class="diff-row ${cls}"><span class="diff-lineno">${num}</span><span class="diff-sign">${sign}</span><span>${escapeHtml(
            r.text
          )}</span></div>`;
        })
        .join("");

      return `
        <div class="patch-file-block">
          <div class="patch-file-title">
            <span class="exec-tree-branch">└ </span>
            <span>${escapeHtml(d.filePath)}</span>
            <span class="patch-stat-add">(+${d.added || 0}</span>
            <span class="patch-stat-del">-${d.removed || 0})</span>
          </div>
          <div class="patch-diff-table">${rowsHtml}</div>
        </div>
      `;
    })
    .join("");

  cell.innerHTML = `
    <div class="patch-header">
      <span class="exec-bullet-ok">•</span>
      <span>${escapeHtml(title)}</span>
      <span class="patch-stat-add">(+${totalAdd}</span>
      <span class="patch-stat-del">-${totalDel})</span>
    </div>
    ${filesHtml}
  `;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendStatusCardCell() {
  const sess = state.activeSession;
  const perm = getPermissionProfile(sess.permissionMode);
  const modelMeta = getModelMeta(sess.model);
  const used = sess.tokensUsed?.total || 420;
  const maxWin = modelMeta.contextWindow || 272000;
  const pctLeft = Math.max(1, Math.min(100, Math.round(((maxWin - used) / maxWin) * 100)));

  const cell = document.createElement("div");
  cell.className = "history-cell cell-status-card";
  cell.innerHTML = `  <span class="brand-prompt">&gt;_</span> <strong>OpenAI Codex</strong> <span class="brand-version">(v${escapeHtml(
    state.version
  )})</span>

  <span class="brand-version">Everything is unlocked &amp; 100% free — zero API keys or subscriptions required</span>

  Model:           <strong>${escapeHtml(sess.model)}</strong> (reasoning ${escapeHtml(
    sess.reasoningEffort
  )}, summaries auto)
  Directory:       ${escapeHtml(state.displayDirectory)}
  Permissions:     ${
    perm.yolo ? `<span class="yolo-badge">YOLO mode</span>` : escapeHtml(perm.shortLabel)
  }
  Roblox Studio:   <span class="status-bar-meter">Enabled (.rbxmx 3D Models + R15 Animations + Live Plugin)</span>
  Media Capture:   <span class="status-bar-meter">Photo Color/Shape + Video R15 Motion Capture</span>
  Account:         free@codex.local <span class="status-bar-meter">(Pro 200 Unlocked · $0.00 FREE)</span>

  Context window:  ${pctLeft}% left (${formatTokens(used)} used / ${formatTokens(maxWin)})
  5h limit:        <span class="status-bar-meter">[████████████████████] 100% left</span> (UNLIMITED · FREE)
  Weekly limit:    <span class="status-bar-meter">[████████████████████] 100% left</span> (UNLIMITED · FREE)
  Credits:         <span class="status-bar-meter">∞ Unlimited ($0.00 / Free Forever)</span>`;
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function appendAssistantCell(markdownText) {
  const cell = document.createElement("div");
  cell.className = "history-cell cell-assistant";
  cell.innerHTML = renderSimpleMarkdown(markdownText);
  elTranscript.appendChild(cell);
  scrollToBottom();
}

function renderSimpleMarkdown(md) {
  let html = escapeHtml(md || "");

  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${code.trimEnd()}</code></pre>`;
  });

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  const lines = html.split("\n");
  const out = [];
  let inList = false;

  for (const line of lines) {
    if (line.trim().startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${line.trim().slice(2)}</li>`);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (line.trim() === "") {
        out.push("");
      } else if (
        line.startsWith("<h3>") ||
        line.startsWith("<pre>") ||
        line.endsWith("</pre>")
      ) {
        out.push(line);
      } else {
        out.push(`<p>${line}</p>`);
      }
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    elTranscript.scrollTop = elTranscript.scrollHeight;
  });
}

function setWorking(working, label) {
  state.isWorking = working;
  if (working) {
    elWorkingText.textContent =
      label ||
      `Thinking (${state.activeSession.model} · ${state.activeSession.reasoningEffort} · $0.00 Free)…`;
    elWorkingBar.classList.remove("hidden");
    let frame = 0;
    clearInterval(spinnerTimer);
    spinnerTimer = setInterval(() => {
      frame = (frame + 1) % SPINNER_FRAMES.length;
      elWorkingSpinner.textContent = SPINNER_FRAMES[frame];
    }, 80);
  } else {
    clearInterval(spinnerTimer);
    elWorkingBar.classList.add("hidden");
  }
}

// Overlay / Popup System
function closeOverlay() {
  state.overlay = null;
  elOverlay.classList.add("hidden");
  elOverlay.innerHTML = "";
}

function renderOverlay() {
  const ov = state.overlay;
  if (!ov) {
    closeOverlay();
    return;
  }

  elOverlay.classList.remove("hidden");

  if (ov.type === "approval") {
    const appr = ov.approval;
    elOverlay.innerHTML = `
      <div class="overlay-title">
        <span>Would you like to run the following command?</span>
        <span class="free-badge-mini">Approval Required</span>
      </div>
      <div class="overlay-subtitle">Reason: ${escapeHtml(appr.reason)}</div>
      <div class="overlay-cmd-preview">$ ${escapeHtml(appr.commandDisplay)}</div>
      <div class="picker-list">
        ${ov.items
          .map(
            (item, idx) => `
          <div class="picker-item ${idx === ov.activeIndex ? "active" : ""}" data-idx="${idx}">
            <div class="picker-left">
              <span class="picker-cursor">${idx === ov.activeIndex ? "›" : " "}</span>
              <span class="picker-label">${idx + 1}. ${escapeHtml(item.label)}</span>
            </div>
            <span class="picker-badge">${escapeHtml(item.shortcut)}</span>
          </div>
        `
          )
          .join("")}
      </div>
      <div class="overlay-footer-hint">Press enter to confirm · y/p/n shortcuts · esc to cancel</div>
    `;
  } else {
    elOverlay.innerHTML = `
      <div class="overlay-title">
        <span>${escapeHtml(ov.title)}</span>
        <span class="brand-version">${escapeHtml(ov.rightTag || "")}</span>
      </div>
      ${ov.subtitle ? `<div class="overlay-subtitle">${escapeHtml(ov.subtitle)}</div>` : ""}
      <div class="picker-list">
        ${ov.items
          .map(
            (item, idx) => `
          <div class="picker-item ${idx === ov.activeIndex ? "active" : ""}" data-idx="${idx}">
            <div class="picker-left">
              <span class="picker-cursor">${idx === ov.activeIndex ? "›" : " "}</span>
              <span class="picker-label">${escapeHtml(item.label)}</span>
              <span class="picker-desc">${escapeHtml(item.description || "")}</span>
            </div>
            ${item.badge ? `<span class="picker-badge">${escapeHtml(item.badge)}</span>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
      <div class="overlay-footer-hint">${escapeHtml(
        ov.footerHint || "↑/↓ navigate · enter select · esc close"
      )}</div>
    `;
  }

  elOverlay.querySelectorAll(".picker-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-idx"));
      state.overlay.activeIndex = idx;
      confirmOverlaySelection();
    });
  });
}

function openSlashPopup(query = "/") {
  const clean = query.trim().toLowerCase();
  const q = clean.replace(/^\//, "");
  const all = state.catalog.slashCommands || [];
  const matches = all.filter(
    (c) =>
      c.cmd.toLowerCase().includes(q) ||
      (c.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    closeOverlay();
    return;
  }

  state.overlay = {
    type: "slash",
    title: "Slash Commands",
    rightTag: `${matches.length} commands`,
    items: matches.slice(0, 12).map((c) => ({
      id: c.cmd,
      label: c.cmd,
      description: c.description,
      badge: c.category
    })),
    activeIndex: 0,
    footerHint: "↑/↓ navigate · tab autocomplete · enter run · esc dismiss"
  };
  renderOverlay();
}

function openMentionPopup(query = "") {
  const q = query.trim().toLowerCase();
  const files = (state.files || []).filter(
    (f) => f.type === "file" && (!q || f.path.toLowerCase().includes(q))
  );
  if (files.length === 0) {
    closeOverlay();
    return;
  }

  state.overlay = {
    type: "mention",
    title: "Mention Workspace File (@)",
    rightTag: `${files.length} files`,
    items: files.slice(0, 10).map((f) => ({
      id: f.path,
      label: `@${f.path}`,
      description: `${f.size} bytes`,
      badge: "file"
    })),
    activeIndex: 0,
    footerHint: "↑/↓ navigate · enter/tab insert @file · esc dismiss"
  };
  renderOverlay();
}

function openModelPicker() {
  const models = state.catalog.models || [];
  const currentIdx = Math.max(
    0,
    models.findIndex((m) => m.id === state.activeSession.model)
  );
  state.overlay = {
    type: "model",
    title: "Select Model (/model)",
    subtitle: "All OpenAI Codex & open-weights models are unlocked at $0.00 Free Unlimited",
    rightTag: "$0.00 FREE",
    items: models.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      badge: m.id === state.activeSession.model ? `✓ ${m.badge}` : m.badge,
      raw: m
    })),
    activeIndex: currentIdx
  };
  renderOverlay();
}

function openReasoningEffortPicker(selectedModel) {
  const efforts = selectedModel.efforts || ["low", "medium", "high"];
  const descriptions = {
    low: "Fastest responses with light reasoning",
    medium: "Balanced speed and coding depth",
    high: "Deep architectural & multi-file reasoning (Recommended)",
    xhigh: "Maximum reasoning depth — unlocked $0.00 Free (no rate limit penalty)"
  };
  const currentIdx = Math.max(
    0,
    efforts.indexOf(state.activeSession.reasoningEffort)
  );

  state.overlay = {
    type: "effort",
    title: `Select Reasoning Level for ${selectedModel.label}`,
    subtitle: "In Codex-Free, High & Extra High reasoning never consume usage limits.",
    rightTag: "Step 2 of 2",
    selectedModelId: selectedModel.id,
    items: efforts.map((eff) => ({
      id: eff,
      label: eff,
      description: descriptions[eff] || "",
      badge: eff === state.activeSession.reasoningEffort ? "current" : "$0.00"
    })),
    activeIndex: currentIdx
  };
  renderOverlay();
}

function openPermissionsPicker() {
  const perms = state.catalog.permissions || [];
  const currentIdx = Math.max(
    0,
    perms.findIndex((p) => p.id === state.activeSession.permissionMode)
  );
  state.overlay = {
    type: "permissions",
    title: "Choose what Codex is allowed to do (/permissions)",
    subtitle: "Controls whether file edits and shell commands run automatically or ask for approval.",
    rightTag: state.activeSession.permissionMode,
    items: perms.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.statusSummary,
      badge: p.id === state.activeSession.permissionMode ? "active" : p.id
    })),
    activeIndex: currentIdx
  };
  renderOverlay();
}

function openFreeProviderPicker() {
  const providers = state.catalog.providers || [];
  state.overlay = {
    type: "provider",
    title: "Zero-Key Free AI Providers & Unlimited Plan (/free)",
    subtitle: "Switch between Zero-Key Cloud Inference, Local Autonomous Engine, or Local Ollama.",
    rightTag: "∞ $0.00 Forever",
    items: providers.map((p) => ({
      id: p.id,
      label: p.name,
      description: p.description,
      badge: p.cost
    })),
    activeIndex: 0
  };
  renderOverlay();
}

function openResumePicker() {
  const sessions = state.sessions || [];
  state.overlay = {
    type: "resume",
    title: "Resume Saved Session (/resume)",
    subtitle: "Select a recorded session thread to restore its transcript and settings.",
    rightTag: `${sessions.length} threads`,
    items: sessions.map((s) => ({
      id: s.id,
      label: s.title || s.id,
      description: `${s.model} (${s.reasoningEffort}) · ${s.messageCount || 0} messages`,
      badge: s.id === state.activeSession.id ? "active" : s.id.slice(0, 11)
    })),
    activeIndex: 0
  };
  renderOverlay();
}

function openThemePicker() {
  const themes = state.catalog.themes || [];
  state.overlay = {
    type: "theme",
    title: "Select Syntax & Terminal Theme (/theme)",
    rightTag: document.documentElement.getAttribute("data-theme"),
    items: themes.map((t) => ({
      id: t.id,
      label: t.name,
      description: `Accent ${t.accent} · Background ${t.bg}`,
      badge: t.id
    })),
    activeIndex: 0
  };
  renderOverlay();
}

function openPetsPicker() {
  const pets = state.catalog.pets || [];
  state.overlay = {
    type: "pets",
    title: "Choose or hide the terminal pet (/pets)",
    subtitle: "Official OpenAI Codex CLI easter egg companion",
    items: pets.map((p) => ({
      id: p.id,
      label: p.name,
      description: p.id === "none" ? "Hide pet overlay" : "Display ASCII companion in terminal corner",
      badge: p.id === state.activePet ? "active" : p.id,
      raw: p
    })),
    activeIndex: 0
  };
  renderOverlay();
}

function openShortcutsOverlay() {
  state.overlay = {
    type: "shortcuts",
    title: "OpenAI Codex CLI & Roblox Studio Shortcuts (?)",
    rightTag: "Keymap",
    items: [
      { id: "enter", label: "Enter", description: "Submit prompt (+ attached photos/videos) to Codex", badge: "send" },
      { id: "attach", label: "📎 Media / Drag & Drop / Paste", description: "Attach Photos (3D Model colors) or Videos (R15 Mocap)", badge: "media" },
      { id: "roblox", label: "/model3d or /animate", description: "Generate Roblox Studio .rbxmx 3D Models & R15 Animations", badge: "roblox" },
      { id: "slash", label: "/", description: "Open slash command popup", badge: "commands" },
      { id: "at", label: "@", description: "Mention a workspace file", badge: "files" },
      { id: "approval", label: "y / p / n / Esc", description: "Approve, Always allow prefix, or Reject command", badge: "approval" }
    ],
    activeIndex: 0
  };
  renderOverlay();
}

function openApprovalModal(approval) {
  state.pendingApproval = approval;
  state.overlay = {
    type: "approval",
    approval,
    activeIndex: 0,
    items: [
      { id: "approve", label: "Yes, proceed", shortcut: "y" },
      {
        id: "approve_prefix",
        label: `Yes, and don't ask again for commands that start with \`${approval.prefix}\``,
        shortcut: "p"
      },
      { id: "reject", label: "No, and tell Codex what to do differently", shortcut: "esc / n" }
    ]
  };
  renderOverlay();
}

async function confirmOverlaySelection() {
  const ov = state.overlay;
  if (!ov) return;
  const selected = ov.items[ov.activeIndex];
  if (!selected) {
    closeOverlay();
    return;
  }

  if (ov.type === "slash") {
    closeOverlay();
    elComposerInput.value = "";
    await handleUserSubmission(selected.id);
    return;
  }

  if (ov.type === "mention") {
    closeOverlay();
    const val = elComposerInput.value;
    const replaced = val.replace(/@[a-zA-Z0-9_./-]*$/, `@${selected.id} `);
    elComposerInput.value = replaced.includes(`@${selected.id}`)
      ? replaced
      : `${val} @${selected.id} `.trimStart();
    elComposerInput.focus();
    return;
  }

  if (ov.type === "model") {
    openReasoningEffortPicker(selected.raw);
    return;
  }

  if (ov.type === "effort") {
    const newModel = ov.selectedModelId;
    const newEffort = selected.id;
    closeOverlay();
    await updateSessionConfig({ model: newModel, reasoningEffort: newEffort });
    appendPlainCell([
      `• Model set to ${newModel} (reasoning effort: ${newEffort} · $0.00 Free Unlimited)`
    ]);
    return;
  }

  if (ov.type === "permissions") {
    closeOverlay();
    await updateSessionConfig({ permissionMode: selected.id });
    appendPlainCell([`• Permissions updated to: ${selected.label}`]);
    return;
  }

  if (ov.type === "provider") {
    closeOverlay();
    const selEl = document.getElementById("select-provider-mode");
    if (selected.id === "local-engine" || selected.id === "auto-free" || selected.id === "ollama") {
      state.providerConfig.mode = selected.id;
      if (selEl) selEl.value = selected.id;
    } else {
      state.providerConfig.mode = "custom";
      if (selEl) selEl.value = "custom";
      document.getElementById("custom-endpoint-fields")?.classList.remove("hidden");
    }
    updateChromeUI();
    appendPlainCell([
      `• Free AI Provider switched to: ${selected.label} (${selected.badge})`
    ]);
    return;
  }

  if (ov.type === "resume") {
    closeOverlay();
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume", sessionId: selected.id })
    });
    const data = await res.json();
    if (data.ok) {
      applyServerState(data);
      renderInitialSessionTranscript();
      for (const m of state.activeSession.messages || []) {
        if (m.role === "user") appendUserCell(m.text, m.attachments || []);
        else appendAssistantCell(m.text);
      }
      appendPlainCell([`• Resumed session "${state.activeSession.title}"`]);
    }
    return;
  }

  if (ov.type === "theme") {
    closeOverlay();
    document.documentElement.setAttribute("data-theme", selected.id);
    appendPlainCell([`• Theme changed to ${selected.label}`]);
    return;
  }

  if (ov.type === "pets") {
    closeOverlay();
    state.activePet = selected.id;
    if (selected.id === "none" || !selected.raw?.ascii) {
      elPetWidget.classList.add("hidden");
      elPetWidget.textContent = "";
      appendPlainCell(["• Terminal pet hidden."]);
    } else {
      elPetWidget.textContent = selected.raw.ascii;
      elPetWidget.classList.remove("hidden");
      appendPlainCell([`• Summoned terminal companion: ${selected.label}`]);
    }
    return;
  }

  if (ov.type === "shortcuts") {
    closeOverlay();
    return;
  }

  if (ov.type === "approval") {
    const decision = selected.id;
    const approvalId = ov.approval.id;
    closeOverlay();
    await submitApprovalDecision(approvalId, decision);
    return;
  }
}

async function submitApprovalDecision(approvalId, decision) {
  setWorking(true, "Executing approved command in workspace…");
  try {
    const res = await fetch("/api/agent/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision })
    });
    const data = await res.json();
    setWorking(false);
    state.pendingApproval = null;
    if (data.ok) {
      if (data.state) applyServerState(data.state);
      renderTurnCells(data.cells || []);
      await refreshDiffViewer();
    } else {
      appendPlainCell([`✘ Error: ${data.error}`]);
    }
  } catch (err) {
    setWorking(false);
    appendPlainCell([`✘ Network error: ${err.message}`]);
  }
}

async function updateSessionConfig(patch) {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (data.ok) applyServerState(data);
  } catch {}
}

// Main User Submission Handler
async function handleUserSubmission(rawText) {
  let text = String(rawText ?? elComposerInput.value).trim();
  const currentAttachments = [...state.attachments];

  if (!text && currentAttachments.length > 0) {
    const hasVid = currentAttachments.some((a) => a.type === "video");
    text = hasVid
      ? `Convert attached video "${currentAttachments[0].name}" into a Roblox Studio R15 KeyframeSequence animation`
      : `Build a high-precision Roblox Studio 3D Model color-matched to attached photo "${currentAttachments[0].name}"`;
  }

  if (!text || state.isWorking) return;

  elComposerInput.value = "";
  elComposerInput.style.height = "auto";
  state.attachments = [];
  renderComposerAttachments();
  closeOverlay();

  state.promptHistory.unshift(text);
  state.historyIndex = -1;

  if (text.startsWith("/") && currentAttachments.length === 0) {
    await executeSlashCommand(text);
    return;
  }

  appendUserCell(text, currentAttachments);
  setWorking(
    true,
    `Synthesizing (${state.activeSession.model} · ${state.activeSession.reasoningEffort} · $0.00 Free)…`
  );

  let browserDraft = null;
  if (
    currentAttachments.length === 0 &&
    (state.providerConfig.mode === "auto-free" || state.providerConfig.mode === "custom")
  ) {
    browserDraft = await tryBrowserZeroKeyCompletion(text);
  }

  try {
    const res = await fetch("/api/agent/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        providerConfig: state.providerConfig,
        browserDraft,
        attachments: currentAttachments.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          width: a.width,
          height: a.height,
          duration: a.duration,
          palette: a.palette,
          motionFrames: a.motionFrames
        }))
      })
    });
    const data = await res.json();
    setWorking(false);

    if (!data.ok) {
      appendPlainCell([`✘ Error: ${data.error || "Turn failed"}`]);
      return;
    }

    if (data.state) applyServerState(data.state);
    renderTurnCells(data.cells || []);

    if (data.pendingApproval) {
      openApprovalModal(data.pendingApproval);
    }

    await refreshDiffViewer();
    if (state.selectedFile) {
      await loadFilePreview(state.selectedFile);
    }
  } catch (err) {
    setWorking(false);
    appendPlainCell([`✘ Request failed: ${err.message}`]);
  }
}

function renderTurnCells(cells) {
  for (const cell of cells) {
    if (cell.type === "reasoning") {
      appendReasoningCell(cell);
    } else if (cell.type === "activity") {
      appendActivityCell(cell.label);
    } else if (cell.type === "exec") {
      appendExecCell(cell);
    } else if (cell.type === "patch") {
      appendPatchCell(cell);
    } else if (cell.type === "roblox") {
      appendRobloxAssetCell(cell.asset);
    } else if (cell.type === "assistant") {
      appendAssistantCell(cell.text);
    }
  }
}

async function tryBrowserZeroKeyCompletion(prompt) {
  if (
    prompt.startsWith("$") ||
    prompt.startsWith("!") ||
    /\b(?:create|write|edit|update|run|execute|test|search|review|agents\.md|roblox|model|katana|mech|supercar|tower|rifle|animation|animate|r15|backflip|slash|sprint)\b/i.test(
      prompt
    )
  ) {
    return null;
  }

  const endpoint =
    state.providerConfig.mode === "custom" && state.providerConfig.endpoint
      ? state.providerConfig.endpoint
      : "https://text.pollinations.ai/openai/chat/completions";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    const headers = { "Content-Type": "application/json" };
    if (state.providerConfig.apiKey) {
      headers["Authorization"] = `Bearer ${state.providerConfig.apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: state.providerConfig.customModel || "openai",
        messages: [
          {
            role: "system",
            content:
              "You are OpenAI Codex CLI (v0.1.0-free), a concise terminal & Roblox Studio coding agent. Reply in clean markdown."
          },
          { role: "user", content: prompt }
        ]
      })
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content && content.trim()) {
      return {
        provider: "browser-zero-key-cloud",
        reasoning: `Synthesized response via Zero-Key Free Cloud (${state.activeSession.model} · $0.00).`,
        actions: [],
        reply: content.trim()
      };
    }
  } catch {}
  return null;
}

// Slash Commands Execution
async function executeSlashCommand(rawInput) {
  const parts = rawInput.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  if (cmd === "/roblox" || cmd === "/studio" || cmd === "/rbx") {
    appendUserCell(rawInput);
    switchDrawerTab("roblox");
    appendAssistantCell(
      `### 🎮 Roblox Studio 3D Model & R15 Animation Workbench\n- **Generate 3D Models**: Try \`/model3d Cyber Plasma Katana\`, \`/model3d Aegis Titan Mech\`, or \`/model3d Cyber GT Supercar\`\n- **Generate R15 Animations**: Try \`/animate R15 Katana 3-hit slash combo\` or \`/animate R15 parkour backflip\`\n- **Attach Photos & Videos**: Click \`📎 Media\` (or drag & drop) to attach reference photos or motion-capture videos!`
    );
    return;
  }

  if (cmd === "/model3d" || cmd === "/rbxmodel") {
    const taskPrompt = args
      ? `Build a Roblox Studio 3D model: ${args}`
      : "Build a Cyberpunk Plasma Katana 3D model for Roblox Studio";
    await handleUserSubmission(taskPrompt);
    return;
  }

  if (cmd === "/animate" || cmd === "/rbxanim" || cmd === "/r15") {
    const animPrompt = args
      ? `Make an R15 Roblox Studio animation: ${args}`
      : "Make an R15 Katana 3-hit slash combo animation for Roblox Studio";
    await handleUserSubmission(animPrompt);
    return;
  }

  if (cmd === "/attach" || cmd === "/photo" || cmd === "/video" || cmd === "/media") {
    appendUserCell(rawInput);
    elMediaFileInput?.click();
    appendPlainCell([
      "• Select any Photo (.png, .jpg, .webp) or Video (.mp4, .webm, .mov) from your device, or use the '🎨 Demo Photo' / '🎥 Demo Video' buttons in the Roblox Studio drawer!"
    ]);
    return;
  }

  if (cmd === "/plugin" || cmd === "/rbxplugin") {
    await handleUserSubmission("Create the Roblox Studio Live Sync Plugin");
    return;
  }

  appendUserCell(rawInput);

  if (cmd === "/model" || cmd === "/m") {
    if (args) {
      const match = (state.catalog.models || []).find(
        (m) => m.id.toLowerCase() === args.toLowerCase()
      );
      if (match) {
        await updateSessionConfig({ model: match.id });
        appendPlainCell([`• Switched model to ${match.id} ($0.00 Free Unlimited)`]);
        return;
      }
    }
    openModelPicker();
    return;
  }

  if (cmd === "/permissions" || cmd === "/approval" || cmd === "/mode") {
    openPermissionsPicker();
    return;
  }

  if (cmd === "/free" || cmd === "/provider" || cmd === "/zero-key") {
    openFreeProviderPicker();
    return;
  }

  if (cmd === "/status" || cmd === "/usage") {
    appendStatusCardCell();
    return;
  }

  if (cmd === "/init") {
    setWorking(true, "Generating AGENTS.md for workspace…");
    const res = await fetch("/api/slash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "/init" })
    });
    const data = await res.json();
    setWorking(false);
    if (data.state) applyServerState(data.state);
    if (data.patchCell) appendPatchCell(data.patchCell);
    if (data.message) appendAssistantCell(data.message);
    await loadFilePreview("AGENTS.md");
    return;
  }

  if (cmd === "/diff") {
    setWorking(true, "Computing git diff (including untracked files)…");
    const res = await fetch("/api/slash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "/diff" })
    });
    const data = await res.json();
    setWorking(false);
    appendAssistantCell(`### Working Tree Git Diff (\`/diff\`)\n\`\`\`diff\n${data.diff}\n\`\`\``);
    elDiffContent.textContent = data.diff;
    return;
  }

  if (cmd === "/review") {
    await handleUserSubmission("Review my current changes and find issues");
    return;
  }

  if (cmd === "/plan") {
    const nextPlan = !state.activeSession.planMode;
    await updateSessionConfig({ planMode: nextPlan });
    appendPlainCell([
      nextPlan
        ? "• Switched to Plan Mode. Codex will design engineering plans without modifying files."
        : "• Exited Plan Mode. Codex can now apply patches and run commands."
    ]);
    return;
  }

  if (cmd === "/new" || cmd === "/clear") {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new" })
    });
    const data = await res.json();
    if (data.ok) {
      applyServerState(data);
      renderInitialSessionTranscript();
    }
    return;
  }

  if (cmd === "/resume") {
    openResumePicker();
    return;
  }

  if (cmd === "/fork") {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fork" })
    });
    const data = await res.json();
    if (data.ok) {
      applyServerState(data);
      appendSessionHeaderCell();
      appendPlainCell([
        `• Forked current conversation into new thread ${state.activeSession.id}`
      ]);
    }
    return;
  }

  if (cmd === "/rename") {
    const newTitle = args || "Renamed Codex Thread";
    await updateSessionConfig({ title: newTitle });
    appendPlainCell([`• Renamed thread to "${newTitle}"`]);
    return;
  }

  if (cmd === "/goal") {
    if (!args) {
      appendPlainCell([
        state.activeSession.goal
          ? `• Current session goal: ${state.activeSession.goal}`
          : "• No goal set. Use `/goal <objective>` to set a session goal."
      ]);
    } else {
      await updateSessionConfig({ goal: args });
      appendPlainCell([`• Session goal set to: "${args}"`]);
    }
    return;
  }

  if (cmd === "/compact" || cmd === "/recap" || cmd === "/pwd" || cmd === "/cwd" || cmd === "/cd" || cmd === "/ps") {
    const res = await fetch("/api/slash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd, args })
    });
    const data = await res.json();
    if (data.state) applyServerState(data.state);
    if (data.activeSession) {
      state.activeSession = data.activeSession;
      updateChromeUI();
    }
    appendPlainCell(data.lines || []);
    return;
  }

  if (cmd === "/theme") {
    openThemePicker();
    return;
  }

  if (cmd === "/pets" || cmd === "/pet") {
    openPetsPicker();
    return;
  }

  if (cmd === "/vim") {
    state.vimMode = !state.vimMode;
    updateChromeUI();
    appendPlainCell([`• Vim composer mode ${state.vimMode ? "enabled" : "disabled"}.`]);
    return;
  }

  if (cmd === "/copy") {
    const msgs = state.activeSession.messages || [];
    const last = [...msgs].reverse().find((m) => m.role === "assistant");
    if (last && navigator.clipboard) {
      await navigator.clipboard.writeText(last.text);
      appendPlainCell(["• Copied last assistant response to clipboard."]);
    } else {
      appendPlainCell(["• Nothing to copy yet."]);
    }
    return;
  }

  if (cmd === "/export") {
    const msgs = state.activeSession.messages || [];
    const md = [
      `# OpenAI Codex Session Export (${state.activeSession.title})`,
      `- Model: ${state.activeSession.model} (${state.activeSession.reasoningEffort})`,
      `- Directory: ${state.displayDirectory}`,
      `- Plan: $0.00 Free Unlimited`,
      ``,
      ...msgs.map((m) => `## ${m.role.toUpperCase()}\n\n${m.text}\n`)
    ].join("\n");
    downloadTextFile(`${state.activeSession.id}.md`, md, "text/markdown");
    appendPlainCell([`• Exported conversation transcript as ${state.activeSession.id}.md`]);
    return;
  }

  if (cmd === "/help" || cmd === "/?") {
    const list = (state.catalog.slashCommands || [])
      .map((c) => `- \`${c.cmd}\` — ${c.description}`)
      .join("\n");
    appendAssistantCell(`### OpenAI Codex CLI & Roblox Studio Slash Commands\n${list}`);
    return;
  }

  if (cmd === "/quit" || cmd === "/exit") {
    appendPlainCell(["• Session saved. In web mode, use `/new` or `/clear` to reset."]);
    return;
  }

  appendPlainCell([
    `✘ Unrecognized slash command: ${cmd}. Type /help to see all available commands.`
  ]);
}

function switchDrawerTab(tabId) {
  elDrawer.classList.remove("collapsed");
  document.querySelectorAll(".drawer-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".drawer-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector(`.drawer-tab[data-tab="${tabId}"]`)?.classList.add("active");
  document.getElementById(`panel-${tabId}`)?.classList.add("active");
}

// Workspace Drawer Helpers
function renderFileList() {
  const files = (state.files || []).filter((f) => f.type === "file");
  elFileList.innerHTML = files
    .map(
      (f) => `
    <div class="file-item ${f.path === state.selectedFile ? "selected" : ""}" data-path="${escapeHtml(
        f.path
      )}">
      <span>📄 ${escapeHtml(f.path)}</span>
      <span class="file-size">${f.size} B</span>
    </div>
  `
    )
    .join("");

  elFileList.querySelectorAll(".file-item").forEach((el) => {
    el.addEventListener("click", () => {
      const p = el.getAttribute("data-path");
      loadFilePreview(p);
    });
  });
}

async function loadFilePreview(filePath) {
  state.selectedFile = filePath;
  renderFileList();
  elPreviewFileName.textContent = filePath;
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.ok) {
      elPreviewFileCode.textContent = data.content;
    } else {
      elPreviewFileCode.textContent = data.error || "Unable to read file";
    }
  } catch (err) {
    elPreviewFileCode.textContent = err.message;
  }
}

async function refreshDiffViewer() {
  try {
    const res = await fetch("/api/diff");
    const data = await res.json();
    if (data.ok) {
      elDiffContent.textContent = data.diff;
    }
  } catch {}
}

async function handleSelectedMediaFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  setWorking(true, `Analyzing ${files.length} attached media file(s) (color palette & motion vectors)…`);
  for (const file of files) {
    const analyzed = await analyzeMediaFile(file);
    state.attachments.push(analyzed);
  }
  setWorking(false);
  renderComposerAttachments();
  elComposerInput.focus();
}

// Event Listeners & Keyboard Navigation
function bindEvents() {
  elComposerInput.addEventListener("input", () => {
    elComposerInput.style.height = "auto";
    elComposerInput.style.height = `${Math.min(140, elComposerInput.scrollHeight)}px`;

    const val = elComposerInput.value;
    if (val.startsWith("/") && !val.includes(" ")) {
      openSlashPopup(val);
      return;
    }

    const mentionMatch = val.match(/(?:^|\s)@([a-zA-Z0-9_./-]*)$/);
    if (mentionMatch) {
      openMentionPopup(mentionMatch[1]);
      return;
    }

    if (state.overlay && (state.overlay.type === "slash" || state.overlay.type === "mention")) {
      closeOverlay();
    }
  });

  elComposerInput.addEventListener("keydown", (e) => {
    if (state.overlay) {
      const ov = state.overlay;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        ov.activeIndex = (ov.activeIndex + 1) % ov.items.length;
        renderOverlay();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        ov.activeIndex = (ov.activeIndex - 1 + ov.items.length) % ov.items.length;
        renderOverlay();
        return;
      }
      if (e.key === "Tab" && (ov.type === "slash" || ov.type === "mention")) {
        e.preventDefault();
        const item = ov.items[ov.activeIndex];
        if (item) {
          if (ov.type === "slash") {
            elComposerInput.value = `${item.id} `;
          } else {
            elComposerInput.value = elComposerInput.value.replace(
              /@[a-zA-Z0-9_./-]*$/,
              `@${item.id} `
            );
          }
          closeOverlay();
        }
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        confirmOverlaySelection();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (ov.type === "approval") {
          submitApprovalDecision(ov.approval.id, "reject");
        }
        closeOverlay();
        return;
      }
      if (ov.type === "approval" && elComposerInput.value === "") {
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          submitApprovalDecision(ov.approval.id, "approve");
          closeOverlay();
          return;
        }
        if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          submitApprovalDecision(ov.approval.id, "approve_prefix");
          closeOverlay();
          return;
        }
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          submitApprovalDecision(ov.approval.id, "reject");
          closeOverlay();
          return;
        }
      }
    }

    if (e.key === "?" && elComposerInput.value === "" && !state.overlay) {
      e.preventDefault();
      openShortcutsOverlay();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserSubmission();
      return;
    }

    if (e.key === "ArrowUp" && elComposerInput.value === "" && state.promptHistory.length > 0) {
      e.preventDefault();
      state.historyIndex = Math.min(
        state.promptHistory.length - 1,
        state.historyIndex + 1
      );
      elComposerInput.value = state.promptHistory[state.historyIndex];
      return;
    }
  });

  elComposerSend.addEventListener("click", () => handleUserSubmission());

  // Photo & Video Attachment Triggers
  document.getElementById("composer-attach-btn")?.addEventListener("click", () => {
    elMediaFileInput?.click();
  });
  document.getElementById("footer-attach-btn")?.addEventListener("click", () => {
    elMediaFileInput?.click();
  });
  document.getElementById("btn-upload-media-drawer")?.addEventListener("click", () => {
    elMediaFileInput?.click();
  });

  elMediaFileInput?.addEventListener("change", async (e) => {
    await handleSelectedMediaFiles(e.target.files);
    elMediaFileInput.value = "";
  });

  // Demo Photo & Demo Video 1-click buttons
  document.getElementById("btn-demo-photo")?.addEventListener("click", () => {
    const demoPhoto = createDemoPhotoAttachment();
    state.attachments.push(demoPhoto);
    renderComposerAttachments();
    if (!elComposerInput.value) {
      elComposerInput.value =
        "Build a Cyberpunk Plasma Katana 3D model for Roblox Studio using my attached photo colors";
    }
    elComposerInput.focus();
  });

  document.getElementById("btn-demo-video")?.addEventListener("click", () => {
    const demoVideo = createDemoVideoAttachment();
    state.attachments.push(demoVideo);
    renderComposerAttachments();
    if (!elComposerInput.value) {
      elComposerInput.value =
        "Convert my attached martial arts video into an R15 Roblox Studio KeyframeSequence animation";
    }
    elComposerInput.focus();
  });

  // Drag & Drop Photos/Videos anywhere on the app
  const dropZone = document.getElementById("drop-zone");
  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  dropZone?.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) {
      await handleSelectedMediaFiles(e.dataTransfer.files);
    }
  });

  // Clipboard Paste Photos/Videos
  window.addEventListener("paste", async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const mediaFiles = items
      .filter((it) => it.type.startsWith("image/") || it.type.startsWith("video/"))
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (mediaFiles.length > 0) {
      await handleSelectedMediaFiles(mediaFiles);
    }
  });

  // Drawer Roblox Stage Controls
  elRbxPlayBtn?.addEventListener("click", () => {
    if (!drawerViewport) return;
    const playing = drawerViewport.togglePlay();
    elRbxPlayBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
  });

  elRbxSlider?.addEventListener("input", (e) => {
    drawerViewport?.setNormalizedTime(e.target.value);
  });

  document.getElementById("btn-rbx-download-rbxmx")?.addEventListener("click", () => {
    const asset = state.activeRobloxAsset;
    if (asset) {
      downloadTextFile(`${asset.name}.rbxmx`, asset.rbxmx, "application/xml");
    }
  });

  document.getElementById("btn-rbx-copy-luau")?.addEventListener("click", async () => {
    const asset = state.activeRobloxAsset;
    if (asset && navigator.clipboard) {
      await navigator.clipboard.writeText(asset.luauScript);
      appendPlainCell([`• Copied ${asset.name}.luau Command Bar script to clipboard!`]);
    }
  });

  document.getElementById("btn-download-plugin")?.addEventListener("click", async () => {
    const res = await fetch("/api/roblox/plugin");
    const data = await res.json();
    if (data.ok) {
      downloadTextFile("CodexFreeStudioPlugin.lua", data.pluginCode, "text/plain");
      appendPlainCell([
        "• Downloaded CodexFreeStudioPlugin.lua! Drop it in your Roblox Studio Plugins folder or run it in the Command Bar."
      ]);
    }
  });

  document.querySelectorAll(".rbx-gen-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-prompt");
      if (p) handleUserSubmission(p);
    });
  });

  // Topbar buttons
  document.getElementById("btn-open-roblox-tab")?.addEventListener("click", () => {
    switchDrawerTab("roblox");
  });
  document.getElementById("btn-open-model")?.addEventListener("click", openModelPicker);
  document.getElementById("btn-open-permissions")?.addEventListener("click", openPermissionsPicker);
  document.getElementById("btn-open-free")?.addEventListener("click", openFreeProviderPicker);
  document.getElementById("btn-toggle-drawer")?.addEventListener("click", () => {
    elDrawer.classList.toggle("collapsed");
  });

  // Footer shortcut triggers
  document.getElementById("footer-shortcuts-btn")?.addEventListener("click", openShortcutsOverlay);
  document.getElementById("footer-slash-btn")?.addEventListener("click", () => {
    elComposerInput.value = "/";
    openSlashPopup("/");
    elComposerInput.focus();
  });
  document.getElementById("footer-roblox-btn")?.addEventListener("click", () => {
    handleUserSubmission("/roblox");
  });

  // Drawer tabs
  document.querySelectorAll(".drawer-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      switchDrawerTab(target);
      if (target === "diff") refreshDiffViewer();
    });
  });

  document.getElementById("btn-refresh-files")?.addEventListener("click", fetchWorkspaceState);
  document.getElementById("btn-refresh-diff")?.addEventListener("click", refreshDiffViewer);
  document.getElementById("btn-mention-selected-file")?.addEventListener("click", () => {
    if (state.selectedFile) {
      elComposerInput.value = `${elComposerInput.value} @${state.selectedFile} `.trimStart();
      elComposerInput.focus();
    }
  });

  // Free AI Provider Config controls
  const selMode = document.getElementById("select-provider-mode");
  const customFields = document.getElementById("custom-endpoint-fields");
  selMode?.addEventListener("change", () => {
    state.providerConfig.mode = selMode.value;
    if (selMode.value === "custom" || selMode.value === "ollama") {
      customFields?.classList.remove("hidden");
      if (selMode.value === "ollama") {
        document.getElementById("input-custom-endpoint").value =
          "http://localhost:11434/v1/chat/completions";
      }
    } else {
      customFields?.classList.add("hidden");
    }
    updateChromeUI();
  });

  document.getElementById("input-custom-endpoint")?.addEventListener("input", (e) => {
    state.providerConfig.endpoint = e.target.value.trim();
  });
  document.getElementById("input-custom-apikey")?.addEventListener("input", (e) => {
    state.providerConfig.apiKey = e.target.value.trim();
  });
  document.getElementById("input-custom-model")?.addEventListener("input", (e) => {
    state.providerConfig.customModel = e.target.value.trim();
  });

  // Quick Task Preset Cards
  document.querySelectorAll(".preset-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      if (prompt) handleUserSubmission(prompt);
    });
  });
}

initApp();
