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
export function buildWindowsPe64Executable(commandLine, { subsystem = 2, uCmdShow = 0 } = {}) {
  // File size: 0x0600 (1536 bytes):
  //   0x0000..0x0200: DOS + PE32+ Headers (RVA 0x0000)
  //   0x0200..0x0400: .text section       (RVA 0x1000)
  //   0x0400..0x0600: .rdata/.idata       (RVA 0x2000)
  const buf = Buffer.alloc(0x0600, 0);

  // 1. DOS Header at 0x0000
  buf.write("MZ", 0x00, "ascii");
  buf.writeUInt16LE(0x0090, 0x02);
  buf.writeUInt16LE(0x0003, 0x04);
  buf.writeUInt16LE(0x0004, 0x08);
  buf.writeUInt16LE(0xffff, 0x0c);
  buf.writeUInt16LE(0x00b8, 0x10);
  buf.writeUInt16LE(0x0040, 0x18);
  buf.writeUInt32LE(0x00000080, 0x3c); // e_lfanew = 0x80

  // 2. PE Signature at 0x0080 ("PE\0\0")
  buf.write("PE\0\0", 0x80, "ascii");

  // 3. COFF File Header at 0x0084 (20 bytes)
  buf.writeUInt16LE(0x8664, 0x84); // Machine = IMAGE_FILE_MACHINE_AMD64
  buf.writeUInt16LE(2, 0x86);      // NumberOfSections = 2 (.text, .rdata)
  buf.writeUInt32LE(0x67100000, 0x88); // TimeDateStamp
  buf.writeUInt32LE(0, 0x8c);      // PointerToSymbolTable
  buf.writeUInt32LE(0, 0x90);      // NumberOfSymbols
  buf.writeUInt16LE(0x00f0, 0x94); // SizeOfOptionalHeader = 240 bytes (PE32+)
  buf.writeUInt16LE(0x0022, 0x96); // Characteristics = EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE

  // 4. Optional Header PE32+ at 0x0098 (240 bytes)
  const opt = 0x98;
  buf.writeUInt16LE(0x020b, opt + 0x00); // Magic = PE32+ (64-bit)
  buf.writeUInt8(14, opt + 0x02);        // MajorLinkerVersion
  buf.writeUInt8(0, opt + 0x03);         // MinorLinkerVersion
  buf.writeUInt32LE(0x0200, opt + 0x04); // SizeOfCode
  buf.writeUInt32LE(0x0200, opt + 0x08); // SizeOfInitializedData
  buf.writeUInt32LE(0, opt + 0x0c);      // SizeOfUninitializedData
  buf.writeUInt32LE(0x1000, opt + 0x10); // AddressOfEntryPoint = 0x1000 (.text)
  buf.writeUInt32LE(0x1000, opt + 0x14); // BaseOfCode = 0x1000
  buf.writeBigUInt64LE(0x0000000140000000n, opt + 0x18); // ImageBase
  buf.writeUInt32LE(0x1000, opt + 0x20); // SectionAlignment = 0x1000
  buf.writeUInt32LE(0x0200, opt + 0x24); // FileAlignment = 0x0200
  buf.writeUInt16LE(6, opt + 0x28);      // MajorOperatingSystemVersion
  buf.writeUInt16LE(0, opt + 0x2a);      // MinorOperatingSystemVersion
  buf.writeUInt16LE(0, opt + 0x2c);      // MajorImageVersion
  buf.writeUInt16LE(0, opt + 0x2e);      // MinorImageVersion
  buf.writeUInt16LE(6, opt + 0x30);      // MajorSubsystemVersion
  buf.writeUInt16LE(0, opt + 0x32);      // MinorSubsystemVersion
  buf.writeUInt32LE(0, opt + 0x34);      // Win32VersionValue
  buf.writeUInt32LE(0x3000, opt + 0x38); // SizeOfImage = 0x3000
  buf.writeUInt32LE(0x0200, opt + 0x3c); // SizeOfHeaders = 0x0200
  buf.writeUInt32LE(0, opt + 0x40);      // CheckSum
  buf.writeUInt16LE(subsystem, opt + 0x44); // Subsystem (2 = GUI, 3 = Console)
  buf.writeUInt16LE(0x0140, opt + 0x46); // DllCharacteristics (DYNAMIC_BASE | NX_COMPAT)
  buf.writeBigUInt64LE(0x100000n, opt + 0x48); // SizeOfStackReserve
  buf.writeBigUInt64LE(0x1000n, opt + 0x50);   // SizeOfStackCommit
  buf.writeBigUInt64LE(0x100000n, opt + 0x58); // SizeOfHeapReserve
  buf.writeBigUInt64LE(0x1000n, opt + 0x60);   // SizeOfHeapCommit
  buf.writeUInt32LE(0, opt + 0x68);            // LoaderFlags
  buf.writeUInt32LE(16, opt + 0x6c);           // NumberOfRvaAndSizes = 16

  // Data Directories start at opt + 0x70
  // Directory[1] = Import Table (RVA 0x2000, Size 40)
  buf.writeUInt32LE(0x2000, opt + 0x70 + 1 * 8);
  buf.writeUInt32LE(40, opt + 0x70 + 1 * 8 + 4);
  // Directory[12] = IAT (RVA 0x2040, Size 24)
  buf.writeUInt32LE(0x2040, opt + 0x70 + 12 * 8);
  buf.writeUInt32LE(24, opt + 0x70 + 12 * 8 + 4);

  // 5. Section Headers at 0x0188 (2 sections * 40 bytes)
  const sec1 = 0x0188;
  buf.write(".text\0\0\0", sec1 + 0x00, "ascii");
  buf.writeUInt32LE(0x0100, sec1 + 0x08); // VirtualSize
  buf.writeUInt32LE(0x1000, sec1 + 0x0c); // VirtualAddress = 0x1000
  buf.writeUInt32LE(0x0200, sec1 + 0x10); // SizeOfRawData = 0x0200
  buf.writeUInt32LE(0x0200, sec1 + 0x14); // PointerToRawData = 0x0200
  buf.writeUInt32LE(0x60000020, sec1 + 0x24); // CODE | EXECUTE | READ

  const sec2 = 0x01b0;
  buf.write(".rdata\0\0", sec2 + 0x00, "ascii");
  buf.writeUInt32LE(0x0180, sec2 + 0x08); // VirtualSize
  buf.writeUInt32LE(0x2000, sec2 + 0x0c); // VirtualAddress = 0x2000
  buf.writeUInt32LE(0x0200, sec2 + 0x10); // SizeOfRawData = 0x0200
  buf.writeUInt32LE(0x0400, sec2 + 0x14); // PointerToRawData = 0x0400
  buf.writeUInt32LE(0xc0000040, sec2 + 0x24); // INITIALIZED_DATA | READ | WRITE (for IAT patching)

  // 6. .text Section Machine Code at File Offset 0x0200 (RVA 0x1000)
  //   0x1000: 48 83 EC 28             sub rsp, 0x28
  //   0x1004: 48 8D 0D 7D 10 00 00    lea rcx, [rip + 0x107d]  ; -> RVA 0x2088 (command string)
  //   0x100B: BA <uCmdShow:u32>       mov edx, uCmdShow
  //   0x1010: FF 15 2A 10 00 00       call qword ptr [rip + 0x102a] ; -> RVA 0x2040 (WinExec)
  //   0x1016: 31 C9                   xor ecx, ecx
  //   0x1018: FF 15 2A 10 00 00       call qword ptr [rip + 0x102a] ; -> RVA 0x2048 (ExitProcess)
  //   0x101E: 48 83 C4 28             add rsp, 0x28
  //   0x1022: C3                      ret
  const code = Buffer.from([
    0x48, 0x83, 0xec, 0x28,
    0x48, 0x8d, 0x0d, 0x7d, 0x10, 0x00, 0x00,
    0xba, uCmdShow & 0xff, 0x00, 0x00, 0x00,
    0xff, 0x15, 0x2a, 0x10, 0x00, 0x00,
    0x31, 0xc9,
    0xff, 0x15, 0x2a, 0x10, 0x00, 0x00,
    0x48, 0x83, 0xc4, 0x28,
    0xc3
  ]);
  code.copy(buf, 0x0200);

  // 7. .rdata / Import Table at File Offset 0x0400 (RVA 0x2000)
  const rdata = 0x0400;
  // IMAGE_IMPORT_DESCRIPTOR[0] for KERNEL32.dll
  buf.writeUInt32LE(0x2028, rdata + 0x00); // OriginalFirstThunk (ILT RVA)
  buf.writeUInt32LE(0, rdata + 0x04);      // TimeDateStamp
  buf.writeUInt32LE(0, rdata + 0x08);      // ForwarderChain
  buf.writeUInt32LE(0x2058, rdata + 0x0c); // Name RVA ("KERNEL32.dll")
  buf.writeUInt32LE(0x2040, rdata + 0x10); // FirstThunk (IAT RVA)
  // IMAGE_IMPORT_DESCRIPTOR[1] is all zeros (0x2014..0x2028)

  // ILT at RVA 0x2028 (File Offset 0x0428)
  buf.writeBigUInt64LE(0x2068n, rdata + 0x28); // Hint/Name RVA for WinExec
  buf.writeBigUInt64LE(0x2074n, rdata + 0x30); // Hint/Name RVA for ExitProcess
  buf.writeBigUInt64LE(0n, rdata + 0x38);      // Null terminator

  // IAT at RVA 0x2040 (File Offset 0x0440)
  buf.writeBigUInt64LE(0x2068n, rdata + 0x40); // Patched to &WinExec at load
  buf.writeBigUInt64LE(0x2074n, rdata + 0x48); // Patched to &ExitProcess at load
  buf.writeBigUInt64LE(0n, rdata + 0x50);      // Null terminator

  // DLL Name at RVA 0x2058 (File Offset 0x0458)
  buf.write("KERNEL32.dll\0", rdata + 0x58, "ascii");

  // Hint/Name 0 at RVA 0x2068 (File Offset 0x0468): Hint=0, "WinExec\0"
  buf.writeUInt16LE(0, rdata + 0x68);
  buf.write("WinExec\0", rdata + 0x6a, "ascii");

  // Hint/Name 1 at RVA 0x2074 (File Offset 0x0474): Hint=0, "ExitProcess\0"
  buf.writeUInt16LE(0, rdata + 0x74);
  buf.write("ExitProcess\0", rdata + 0x76, "ascii");

  // Command Line String at RVA 0x2088 (File Offset 0x0488)
  buf.write(commandLine + "\0", rdata + 0x88, "ascii");

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
