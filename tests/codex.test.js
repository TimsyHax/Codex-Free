import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  computeStructuredDiff,
  parseCodexPatch,
  applyCodexFileOperation,
  formatPatchSummaryPlain
} from "../src/shared/patchParser.js";
import { matchSlashCommands } from "../src/shared/slashCommands.js";
import {
  resolveSafePath,
  writeWorkspaceFile,
  readWorkspaceFile,
  applyWorkspacePatch,
  runWorkspaceShell
} from "../src/backend/tools.js";
import { createCodexServer } from "../src/backend/server.js";
import {
  generateRobloxModelSpec,
  generateRobloxAnimationSpec,
  generateRobloxCompanionPluginLua
} from "../src/shared/robloxStudio.js";
import { buildWindowsPe64Executable } from "../scripts/build-release.js";

test("Windows PE64 executable generator and release zip contain valid Codex-Free.exe", () => {
  const exe = buildWindowsPe64Executable('wscript.exe "bin\\launch-app.vbs"', {
    subsystem: 2,
    uCmdShow: 0
  });
  assert.equal(exe.toString("ascii", 0, 2), "MZ");
  assert.equal(exe.toString("ascii", 0x80, 0x84), "PE\0\0");
  assert.equal(exe.readUInt16LE(0x84), 0x8664); // AMD64

  const zipPath = path.join(process.cwd(), "releases/Codex-Free-Windows-x64.zip");
  assert.ok(fs.existsSync(zipPath), "releases/Codex-Free-Windows-x64.zip exists");
});

test("Roblox Studio 3D Model & R15 Animation Engine generates multi-part .rbxmx, .luau, and photo/video adaptations", () => {
  const katana = generateRobloxModelSpec("Build a Cyberpunk Plasma Katana", [
    { name: "ref.png", type: "image", palette: ["#111111", "#eeeeee", "#00ffcc", "#ff0066"] }
  ]);
  assert.equal(katana.type, "roblox_model");
  assert.ok(katana.partCount >= 15);
  assert.match(katana.luauScript, /Instance\.new\("Model"\)/);
  assert.match(katana.luauScript, /WeldConstraint/);
  assert.match(katana.rbxmx, /<roblox/);
  assert.match(katana.rbxmx, /CyberPlasmaKatana/);

  // Video motion-capture to R15 KeyframeSequence
  const mocapAnim = generateRobloxAnimationSpec("Convert video to R15 animation", [
    {
      name: "combo_clip.mp4",
      type: "video",
      duration: 1.5,
      motionFrames: [
        { centerX: 0.4, centerY: 0.5, energy: 0.4 },
        { centerX: 0.6, centerY: 0.3, energy: 0.9 },
        { centerX: 0.5, centerY: 0.6, energy: 0.5 }
      ]
    }
  ]);
  assert.equal(mocapAnim.type, "roblox_animation");
  assert.equal(mocapAnim.rigType, "R15");
  assert.equal(mocapAnim.keyframeCount, 3);
  assert.match(mocapAnim.luauScript, /Instance\.new\("KeyframeSequence"\)/);
  assert.match(mocapAnim.rbxmx, /<Item class="KeyframeSequence"/);

  const pluginLua = generateRobloxCompanionPluginLua("http://localhost:3000");
  assert.match(pluginLua, /HttpService:GetAsync/);
});

test("computeStructuredDiff and formatPatchSummaryPlain match OpenAI Codex patch cell format", () => {
  const diff = computeStructuredDiff(
    "existing.txt",
    "context\nbefore\ntail",
    "context\nafter\ntail",
    "update"
  );
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);

  const summary = formatPatchSummaryPlain([diff]);
  assert.match(summary, /• Edited existing\.txt \(\+1 -1\)/);
  assert.match(summary, /2 -before/);
  assert.match(summary, /2 \+after/);
});

test("parseCodexPatch and applyCodexFileOperation apply *** Begin Patch blocks", () => {
  const patchText = `*** Begin Patch
*** Update File: hello.js
@@
 const a = 1;
-console.log("old");
+console.log("new");
*** End Patch`;

  const ops = parseCodexPatch(patchText);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].action, "update");
  assert.equal(ops[0].filePath, "hello.js");

  const updated = applyCodexFileOperation(ops[0], 'const a = 1;\nconsole.log("old");\n');
  assert.match(updated, /console\.log\("new"\);/);
});

test("matchSlashCommands filters official OpenAI Codex slash commands", () => {
  const modelMatches = matchSlashCommands("/mod");
  assert.ok(modelMatches.some((m) => m.cmd === "/model"));

  const freeMatches = matchSlashCommands("/free");
  assert.ok(freeMatches.some((m) => m.cmd === "/free"));
});

test("Workspace tools safely write, read, patch, and execute shell commands", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-free-test-"));
  try {
    // Path traversal guard stays inside workspace root
    const safe = resolveSafePath(tmpDir, "../../etc/passwd");
    assert.equal(safe, tmpDir);

    const writeRes = writeWorkspaceFile(tmpDir, "demo.txt", "line1\nline2\n");
    assert.equal(writeRes.ok, true);
    assert.equal(writeRes.action, "add");

    const readRes = readWorkspaceFile(tmpDir, "demo.txt");
    assert.equal(readRes.ok, true);
    assert.match(readRes.rawContent, /line2/);

    const patchRes = applyWorkspacePatch(
      tmpDir,
      `*** Begin Patch\n*** Update File: demo.txt\n@@\n line1\n-line2\n+line2_updated\n*** End Patch`
    );
    assert.equal(patchRes.ok, true);
    assert.equal(patchRes.diffs[0].added, 1);

    const shellRes = await runWorkspaceShell(tmpDir, "echo codex_free_ok");
    assert.equal(shellRes.ok, true);
    assert.equal(shellRes.exitCode, 0);
    assert.match(shellRes.stdout, /codex_free_ok/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Codex HTTP server handles /api/state, /api/agent/turn, and approval flow", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-server-test-"));
  const { server } = createCodexServer(tmpDir);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Check /api/state
    const stateRes = await fetch(`${baseUrl}/api/state`).then((r) => r.json());
    assert.equal(stateRes.ok, true);
    assert.equal(stateRes.activeSession.model, "gpt-5.1-codex");

    // 2. Create a file via agent turn (auto-approved in default auto-edit mode)
    const createTurn = await fetch(`${baseUrl}/api/agent/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Create fibonacci.js that prints fibonacci numbers",
        providerConfig: { mode: "local-engine" }
      })
    }).then((r) => r.json());

    assert.equal(createTurn.ok, true);
    assert.ok(fs.existsSync(path.join(tmpDir, "fibonacci.js")));
    assert.ok(createTurn.cells.some((c) => c.type === "patch"));

    // 3. Request a shell command in auto-edit mode -> triggers pendingApproval modal
    const shellTurn = await fetch(`${baseUrl}/api/agent/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "$ echo approved_shell_test",
        providerConfig: { mode: "local-engine" }
      })
    }).then((r) => r.json());

    assert.equal(shellTurn.ok, true);
    assert.ok(shellTurn.pendingApproval);
    assert.equal(shellTurn.pendingApproval.commandDisplay, "echo approved_shell_test");

    // 4. Approve the command via /api/agent/approve
    const approveRes = await fetch(`${baseUrl}/api/agent/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvalId: shellTurn.pendingApproval.id,
        decision: "approve"
      })
    }).then((r) => r.json());

    assert.equal(approveRes.ok, true);
    const execCell = approveRes.cells.find((c) => c.type === "exec");
    assert.ok(execCell);
    assert.equal(execCell.exitCode, 0);
    assert.match(execCell.stdout, /approved_shell_test/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
