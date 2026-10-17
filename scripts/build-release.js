#!/usr/bin/env node
/**
 * Builds the official Codex-Free Windows Release Package (`releases/Codex-Free-Windows-x64.zip`)
 * containing:
 *  - Codex-Free.exe (Native Windows x86_64 PE32+ GUI Launcher Executable)
 *  - Codex-CLI.exe  (Native Windows x86_64 PE32+ Console TUI Executable)
 *  - Codex-Free-Standalone.html (Zero-dependency offline desktop app bundle)
 *  - Full Node.js + Roblox Studio (.rbxmx / Luau / Plugin) workspace files
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

/**
 * Generates a valid, specification-compliant 64-bit Windows PE32+ (x86_64) executable (.exe)
 * that invokes `kernel32.dll!WinExec(commandLine, uCmdShow)` and `kernel32.dll!ExitProcess(0)`.
 */
export function buildWindowsPe64Executable(commandLine, { subsystem = 2, uCmdShow = 1 } = {}) {
  // Tiny native AMD64 launcher. It resolves its own directory first, so launching
  // from Explorer, Downloads, a shortcut, or another working directory all work.
  const buf = Buffer.alloc(0x0800, 0);
  buf.write("MZ", 0, "ascii");
  buf.writeUInt32LE(0x80, 0x3c);
  buf.write("PE\0\0", 0x80, "ascii");
  buf.writeUInt16LE(0x8664, 0x84);
  buf.writeUInt16LE(2, 0x86);
  buf.writeUInt32LE(0x67100000, 0x88);
  buf.writeUInt16LE(0x00f0, 0x94);
  buf.writeUInt16LE(0x0022, 0x96);

  const opt = 0x98;
  buf.writeUInt16LE(0x020b, opt);
  buf.writeUInt8(14, opt + 2);
  buf.writeUInt32LE(0x200, opt + 4);
  buf.writeUInt32LE(0x400, opt + 8);
  buf.writeUInt32LE(0x1000, opt + 0x10);
  buf.writeUInt32LE(0x1000, opt + 0x14);
  buf.writeBigUInt64LE(0x140000000n, opt + 0x18);
  buf.writeUInt32LE(0x1000, opt + 0x20);
  buf.writeUInt32LE(0x200, opt + 0x24);
  buf.writeUInt16LE(6, opt + 0x28);
  buf.writeUInt16LE(6, opt + 0x30);
  buf.writeUInt32LE(0x3000, opt + 0x38);
  buf.writeUInt32LE(0x200, opt + 0x3c);
  buf.writeUInt16LE(subsystem, opt + 0x44);
  buf.writeUInt16LE(0x0100, opt + 0x46); // NX compatible; fixed image needs no relocations
  buf.writeBigUInt64LE(0x100000n, opt + 0x48);
  buf.writeBigUInt64LE(0x1000n, opt + 0x50);
  buf.writeBigUInt64LE(0x100000n, opt + 0x58);
  buf.writeBigUInt64LE(0x1000n, opt + 0x60);
  buf.writeUInt32LE(16, opt + 0x6c);
  buf.writeUInt32LE(0x2000, opt + 0x78); // import directory
  buf.writeUInt32LE(40, opt + 0x7c);
  buf.writeUInt32LE(0x2050, opt + 0xd0); // IAT directory
  buf.writeUInt32LE(40, opt + 0xd4);

  const sec1 = 0x188;
  buf.write(".text\0\0\0", sec1, "ascii");
  buf.writeUInt32LE(0x200, sec1 + 8);
  buf.writeUInt32LE(0x1000, sec1 + 12);
  buf.writeUInt32LE(0x200, sec1 + 16);
  buf.writeUInt32LE(0x200, sec1 + 20);
  buf.writeUInt32LE(0x60000020, sec1 + 36);
  const sec2 = 0x1b0;
  buf.write(".rdata\0\0", sec2, "ascii");
  buf.writeUInt32LE(0x400, sec2 + 8);
  buf.writeUInt32LE(0x2000, sec2 + 12);
  buf.writeUInt32LE(0x400, sec2 + 16);
  buf.writeUInt32LE(0x400, sec2 + 20);
  buf.writeUInt32LE(0xc0000040, sec2 + 36);

  // Code uses GetModuleFileNameA to find this executable, strips its filename,
  // and calls SetCurrentDirectoryA before launching the companion script.
  const code = [];
  const emit = (...xs) => code.push(...xs);
  const patchInt32 = (at, value) => {
    code[at] = value & 0xff;
    code[at + 1] = (value >> 8) & 0xff;
    code[at + 2] = (value >> 16) & 0xff;
    code[at + 3] = (value >> 24) & 0xff;
  };
  const callIat = (iatRva) => {
    emit(0xff, 0x15);
    const at = code.length;
    emit(0, 0, 0, 0);
    patchInt32(at, iatRva - (0x1000 + code.length));
  };
  emit(0x48,0x81,0xec,0x28,0x02,0,0);       // sub rsp, 0x228
  emit(0x48,0x8d,0x4c,0x24,0x20);            // lea rcx, [rsp+0x20]
  emit(0xba,0,2,0,0);                         // mov edx, 512
  callIat(0x2060);                             // GetModuleFileNameA
  emit(0x85,0xc0,0x74,0x1d);                  // test eax,eax / jz launch
  emit(0x4c,0x8d,0x44,0x04,0x20);             // lea r8, [rsp+rax+0x20]
  emit(0x49,0xff,0xc8);                        // scan backwards for slash
  emit(0x41,0x80,0x38,0x5c,0x75,0xf7);
  emit(0x41,0xc6,0,0);                         // terminate directory string
  emit(0x48,0x8d,0x4c,0x24,0x20);
  callIat(0x2068);                             // SetCurrentDirectoryA
  // launch:
  emit(0x48,0x8d,0x0d);
  const cmdDispAt = code.length;
  emit(0,0,0,0);
  patchInt32(cmdDispAt, 0x20d8 - (0x1000 + code.length));
  emit(0xba,uCmdShow & 0xff,0,0,0);
  callIat(0x2050);                             // WinExec
  emit(0x31,0xc9);
  callIat(0x2058);                             // ExitProcess
  Buffer.from(code).copy(buf, 0x200);

  const r = 0x400;
  buf.writeUInt32LE(0x2028, r);
  buf.writeUInt32LE(0x2078, r + 12);
  buf.writeUInt32LE(0x2050, r + 16);
  const names = [0x2088, 0x2092, 0x20a0, 0x20b8];
  names.forEach((v, i) => {
    buf.writeBigUInt64LE(BigInt(v), r + 0x28 + i * 8);
    buf.writeBigUInt64LE(BigInt(v), r + 0x50 + i * 8);
  });
  buf.write("KERNEL32.dll\0", r + 0x78, "ascii");
  const imports = [
    [0x88, "WinExec"],
    [0x92, "ExitProcess"],
    [0xa0, "GetModuleFileNameA"],
    [0xb8, "SetCurrentDirectoryA"]
  ];
  for (const [off, name] of imports) {
    buf.writeUInt16LE(0, r + off);
    buf.write(name + "\0", r + off + 2, "ascii");
  }
  if (Buffer.byteLength(commandLine, "ascii") > 0x127) {
    throw new Error("Windows launcher command is too long");
  }
  buf.write(commandLine + "\0", r + 0xd8, "ascii");
  return buf;
}

function buildStandaloneHtmlBundle() {
  const html = fs.readFileSync(path.join(repoRoot, "src/public/index.html"), "utf8");
  const css = fs.readFileSync(path.join(repoRoot, "src/public/styles.css"), "utf8");
  const viewportJs = fs
    .readFileSync(path.join(repoRoot, "src/public/robloxViewport.js"), "utf8")
    .replace(/export function /g, "function ")
    .replace(/export async function /g, "async function ");

  const appJs = fs
    .readFileSync(path.join(repoRoot, "src/public/app.js"), "utf8")
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+"\.\/robloxViewport\.js";/, "");

  // Offline API shim so Codex-Free-Standalone.html works even if opened directly via file:// without Node.js!
  const offlineShim = `
// Standalone Offline Backend Shim (activates automatically if opened via file:// without a local Node server)
(function() {
  const origFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : input.url;
    if (window.location.protocol !== "file:" && !url.startsWith("/api/")) {
      return origFetch(input, init);
    }
    try {
      const res = await origFetch(input, init);
      if (res.ok) return res;
    } catch {}
    // Fallback for standalone file:// mode
    if (url.includes("/api/state")) {
      return new Response(JSON.stringify({
        ok: true,
        version: "0.1.0-free",
        workspaceRoot: "C:\\\\Codex-Free",
        displayDirectory: "~/Codex-Free (Standalone Desktop)",
        gitBranch: "main",
        hasAgentsMd: true,
        agentsMdLabel: "AGENTS.md (loaded)",
        activeSession: {
          id: "thread_desktop",
          title: "Codex-Free Desktop Session",
          model: "gpt-5.1-codex",
          reasoningEffort: "high",
          permissionMode: "auto-edit",
          planMode: false,
          tokensUsed: { input: 420, output: 0, total: 420 }
        },
        catalog: {
          models: [
            { id: "gpt-5.1-codex", label: "gpt-5.1-codex", description: "Default OpenAI Codex model ($0.00 Free)", contextWindow: 272000, efforts: ["low","medium","high","xhigh"], badge: "FREE" },
            { id: "codex-mini-latest", label: "codex-mini-latest", description: "Fast agentic coding model ($0.00 Free)", contextWindow: 200000, efforts: ["low","medium","high"], badge: "FAST" },
            { id: "o4-mini", label: "o4-mini", description: "Deep reasoning model ($0.00 Free)", contextWindow: 200000, efforts: ["low","medium","high","xhigh"], badge: "REASONING" }
          ],
          permissions: [
            { id: "suggest", label: "Suggest", shortLabel: "Suggest", statusSummary: "Ask for approval" },
            { id: "auto-edit", label: "Auto Edit", shortLabel: "Auto Edit", statusSummary: "Auto-write files" },
            { id: "full-auto", label: "Full Auto", shortLabel: "Full Auto", statusSummary: "Full automatic execution" },
            { id: "yolo", label: "YOLO Mode", shortLabel: "YOLO mode", statusSummary: "Unrestricted", yolo: true }
          ],
          providers: [{ id: "auto-free", name: "Zero-Key Free AI", cost: "$0.00" }],
          themes: [
            { id: "catppuccin-mocha", name: "Catppuccin Mocha", accent: "#89b4fa", bg: "#11111b" },
            { id: "codex-dark", name: "Codex Official Dark", accent: "#10a37f", bg: "#0d1117" },
            { id: "tokyo-night", name: "Tokyo Night", accent: "#7aa2f7", bg: "#1a1b26" },
            { id: "matrix-free", name: "Matrix Free Green", accent: "#00ff9c", bg: "#050c08" }
          ],
          pets: [
            { id: "none", name: "Hidden", ascii: "" },
            { id: "codex-cat", name: "Byte the Codex Cat", ascii: " /\\\\_/\\\\  [Byte · $0.00]\\n( o.o ) < nya~ free tokens!\\n > ^ <" }
          ],
          slashCommands: [
            { cmd: "/model3d", description: "generate a Roblox Studio 3D model", category: "roblox" },
            { cmd: "/animate", description: "generate an R15 Roblox animation", category: "roblox" },
            { cmd: "/attach", description: "attach photos or videos", category: "media" },
            { cmd: "/status", description: "show session status", category: "session" },
            { cmd: "/model", description: "choose model and reasoning effort", category: "core" },
            { cmd: "/permissions", description: "choose approval mode", category: "core" }
          ]
        },
        files: [
          { path: "README.md", type: "file", size: 2840 },
          { path: "Codex-Free.exe", type: "file", size: 1536 },
          { path: "roblox/exports/CyberPlasmaKatana.rbxmx", type: "file", size: 19938 },
          { path: "roblox/exports/KatanaTripleSlashCombo.rbxmx", type: "file", size: 35960 }
        ]
      }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, diff: "(Standalone Desktop Mode)", content: "OpenAI Codex (v0.1.0-free) Desktop Edition" }), { headers: { "Content-Type": "application/json" } });
  };
})();
`;

  return html
    .replace(`<link rel="stylesheet" href="/styles.css" />`, `<style>\n${css}\n</style>`)
    .replace(
      `<script type="module" src="/app.js"></script>`,
      `<script>\n${offlineShim}\n${viewportJs}\n${appJs}\n</script>`
    );
}

function main() {
  const stageDir = path.join(repoRoot, ".codex-free/win-build/Codex-Free");
  const releasesDir = path.join(repoRoot, "releases");
  const publicReleasesDir = path.join(repoRoot, "src/public/releases");

  fs.rmSync(path.join(repoRoot, ".codex-free/win-build"), { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(path.join(stageDir, "bin"), { recursive: true });
  fs.mkdirSync(releasesDir, { recursive: true });
  fs.mkdirSync(publicReleasesDir, { recursive: true });

  // 1. Build Codex-Free.exe (GUI Subsystem = 2, silent launch of bin\launch-app.vbs)
  const guiExe = buildWindowsPe64Executable('wscript.exe "bin\\launch-app.vbs"', {
    subsystem: 2,
    uCmdShow: 0
  });
  fs.writeFileSync(path.join(stageDir, "Codex-Free.exe"), guiExe);

  // 2. Build Codex-CLI.exe (Console Subsystem = 3, interactive terminal CLI)
  const cliExe = buildWindowsPe64Executable('cmd.exe /k "bin\\launch-cli.bat"', {
    subsystem: 3,
    uCmdShow: 1
  });
  fs.writeFileSync(path.join(stageDir, "Codex-CLI.exe"), cliExe);

  // 3. Write Windows VBS & Batch Launchers
  const launchVbs = `' OpenAI Codex (v0.1.0-free) Silent Desktop App Launcher
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = appDir
shell.Run """" & appDir & "\\bin\\launch-app.bat""", 0, False
`;
  fs.writeFileSync(path.join(stageDir, "bin/launch-app.vbs"), launchVbs.replace(/\n/g, "\r\n"));

  const launchAppBat = `@echo off
cd /d "%~dp0.."
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start /b "" node "src\\backend\\standalone-server.mjs"
    timeout /t 1 /nobreak >nul
    where msedge >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        start "" msedge --app="http://127.0.0.1:3000"
        exit /b 0
    )
    start "" "http://127.0.0.1:3000"
    exit /b 0
) else (
    where msedge >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        start "" msedge --app="file:///%CD:\\=/%/Codex-Free-Standalone.html"
        exit /b 0
    )
    start "" "%CD%\\Codex-Free-Standalone.html"
    exit /b 0
)
`;
  fs.writeFileSync(path.join(stageDir, "bin/launch-app.bat"), launchAppBat.replace(/\n/g, "\r\n"));

  const launchCliBat = `@echo off
title >_ OpenAI Codex (v0.1.0-free) — 100%% Free Terminal Agent
cd /d "%~dp0.."
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    node "bin\\codex.js" %*
) else (
    echo.
    echo   ^>_ OpenAI Codex (v0.1.0-free)
    echo   Node.js was not detected in PATH for CLI mode. Opening Desktop GUI Edition...
    start "" "%CD%\\Codex-Free-Standalone.html"
)
`;
  fs.writeFileSync(path.join(stageDir, "bin/launch-cli.bat"), launchCliBat.replace(/\n/g, "\r\n"));

  // 4. Write Standalone Single-File HTML Desktop App
  const standaloneHtml = buildStandaloneHtmlBundle();
  fs.writeFileSync(path.join(stageDir, "Codex-Free-Standalone.html"), standaloneHtml, "utf8");

  // 5. Copy core project files into the package (excluding src/public/releases to avoid nesting zip)
  const dirsToCopy = ["src", "roblox"];
  for (const d of dirsToCopy) {
    const srcPath = path.join(repoRoot, d);
    if (fs.existsSync(srcPath)) {
      fs.cpSync(srcPath, path.join(stageDir, d), {
        recursive: true,
        filter: (source) => !source.includes(path.join("src", "public", "releases"))
      });
    }
  }
  fs.copyFileSync(path.join(repoRoot, "bin/codex.js"), path.join(stageDir, "bin/codex.js"));
  fs.copyFileSync(path.join(repoRoot, "package.json"), path.join(stageDir, "package.json"));
  fs.copyFileSync(path.join(repoRoot, "README.md"), path.join(stageDir, "README.md"));
  if (fs.existsSync(path.join(repoRoot, "AGENTS.md"))) {
    fs.copyFileSync(path.join(repoRoot, "AGENTS.md"), path.join(stageDir, "AGENTS.md"));
  }

  // 6. Create zip archive in releases/Codex-Free-Windows-x64.zip
  const zipPath = path.join(releasesDir, "Codex-Free-Windows-x64.zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  execSync(`zip -r -q "${zipPath}" Codex-Free`, {
    cwd: path.join(repoRoot, ".codex-free/win-build")
  });

  // Also copy zip to src/public/releases/ so it can be downloaded from the web preview
  fs.copyFileSync(
    zipPath,
    path.join(publicReleasesDir, "Codex-Free-Windows-x64.zip")
  );

  // Also copy Codex-Free.exe directly into releases/ for convenience
  fs.copyFileSync(
    path.join(stageDir, "Codex-Free.exe"),
    path.join(releasesDir, "Codex-Free.exe")
  );

  const stat = fs.statSync(zipPath);
  console.log(
    `[Codex-Free Release Builder] Built releases/Codex-Free-Windows-x64.zip (${(stat.size / 1024).toFixed(1)} KB) with Codex-Free.exe and Codex-CLI.exe inside!`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
