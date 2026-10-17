/**
 * Official OpenAI Codex CLI Slash Commands registry (1:1 with codex-rs/tui/src/slash_command.rs)
 * plus /free and /provider for Codex-Free zero-key controls.
 */
export const SLASH_COMMANDS = [
  {
    cmd: "/model",
    aliases: ["/m"],
    description: "choose what model and reasoning effort to use",
    category: "core",
    opensModal: "model"
  },
  {
    cmd: "/permissions",
    aliases: ["/approval", "/mode"],
    description: "choose what Codex is allowed to do",
    category: "core",
    opensModal: "permissions"
  },
  {
    cmd: "/free",
    aliases: ["/provider", "/zero-key"],
    description: "inspect or configure Zero-Key Free AI providers & unlimited plan status",
    category: "core",
    opensModal: "provider"
  },
  {
    cmd: "/roblox",
    aliases: ["/studio", "/rbx"],
    description: "open Roblox Studio 3D Model, R15 Animation & Live Sync Workbench",
    category: "roblox"
  },
  {
    cmd: "/model3d",
    aliases: ["/rbxmodel"],
    description: "generate a high-precision multi-part Roblox Studio 3D model (.rbxmx + Luau)",
    category: "roblox"
  },
  {
    cmd: "/animate",
    aliases: ["/rbxanim", "/r15"],
    description: "generate an accurate R15/R6 Roblox Studio KeyframeSequence animation",
    category: "roblox"
  },
  {
    cmd: "/attach",
    aliases: ["/photo", "/video", "/media"],
    description: "attach photos or videos to guide code, Roblox 3D models, or motion-capture animations",
    category: "media"
  },
  {
    cmd: "/plugin",
    aliases: ["/rbxplugin"],
    description: "export & install the Roblox Studio Live HttpService Sync Companion Plugin",
    category: "roblox"
  },
  {
    cmd: "/status",
    aliases: [],
    description: "show current session configuration and token usage",
    category: "session"
  },
  {
    cmd: "/init",
    aliases: [],
    description: "create an AGENTS.md file with instructions for Codex",
    category: "workspace"
  },
  {
    cmd: "/diff",
    aliases: [],
    description: "show git diff (including untracked files)",
    category: "workspace"
  },
  {
    cmd: "/review",
    aliases: [],
    description: "review my current changes and find issues",
    category: "workspace"
  },
  {
    cmd: "/plan",
    aliases: [],
    description: "switch to Plan mode",
    category: "agent"
  },
  {
    cmd: "/compact",
    aliases: [],
    description: "summarize conversation to prevent hitting the context limit",
    category: "session"
  },
  {
    cmd: "/recap",
    aliases: [],
    description: "summarize the current conversation now",
    category: "session"
  },
  {
    cmd: "/new",
    aliases: [],
    description: "start a new chat during a conversation",
    category: "session"
  },
  {
    cmd: "/resume",
    aliases: [],
    description: "resume a saved chat",
    category: "session",
    opensModal: "resume"
  },
  {
    cmd: "/fork",
    aliases: [],
    description: "fork the current chat",
    category: "session"
  },
  {
    cmd: "/rename",
    aliases: [],
    description: "rename the current thread",
    category: "session"
  },
  {
    cmd: "/clear",
    aliases: [],
    description: "clear the terminal and start a new chat",
    category: "session"
  },
  {
    cmd: "/mention",
    aliases: ["@"],
    description: "mention a file",
    category: "workspace",
    opensModal: "mention"
  },
  {
    cmd: "/presets",
    aliases: [],
    description: "run or save reusable prompts and slash commands",
    category: "agent",
    opensModal: "presets"
  },
  {
    cmd: "/skills",
    aliases: [],
    description: "use skills to improve how Codex performs specific tasks",
    category: "agent"
  },
  {
    cmd: "/agents",
    aliases: ["/subagents"],
    description: "open the agent command center",
    category: "agent"
  },
  {
    cmd: "/goal",
    aliases: [],
    description: "set or view the goal for a long-running task",
    category: "agent"
  },
  {
    cmd: "/copy",
    aliases: [],
    description: "copy the last response or part of it",
    category: "utility"
  },
  {
    cmd: "/export",
    aliases: [],
    description: "export the conversation as markdown",
    category: "utility"
  },
  {
    cmd: "/pwd",
    aliases: ["/cwd"],
    description: "show the current working directory",
    category: "workspace"
  },
  {
    cmd: "/cd",
    aliases: [],
    description: "change the current working directory",
    category: "workspace"
  },
  {
    cmd: "/usage",
    aliases: [],
    description: "view account usage or use a usage limit reset",
    category: "session"
  },
  {
    cmd: "/config",
    aliases: ["/debug-config"],
    description: "configure Codex preferences",
    category: "utility"
  },
  {
    cmd: "/theme",
    aliases: [],
    description: "choose a syntax highlighting theme",
    category: "utility",
    opensModal: "theme"
  },
  {
    cmd: "/pets",
    aliases: ["/pet"],
    description: "choose or hide the terminal pet",
    category: "utility",
    opensModal: "pets"
  },
  {
    cmd: "/vim",
    aliases: [],
    description: "toggle Vim mode for the composer",
    category: "utility"
  },
  {
    cmd: "/mcp",
    aliases: [],
    description: "list MCP tools; use /mcp verbose or /mcp login <name>",
    category: "agent"
  },
  {
    cmd: "/ps",
    aliases: [],
    description: "list background terminals",
    category: "workspace"
  },
  {
    cmd: "/help",
    aliases: ["/?"],
    description: "show all slash commands and keyboard shortcuts",
    category: "utility"
  },
  {
    cmd: "/quit",
    aliases: ["/exit"],
    description: "exit Codex",
    category: "session"
  }
];

export function matchSlashCommands(query = "") {
  const clean = query.trim().toLowerCase();
  if (!clean || clean === "/") return SLASH_COMMANDS;
  const normalized = clean.startsWith("/") ? clean : `/${clean}`;
  return SLASH_COMMANDS.filter(
    (item) =>
      item.cmd.toLowerCase().includes(normalized) ||
      item.cmd.slice(1).toLowerCase().includes(clean.replace(/^\//, "")) ||
      item.aliases.some((a) => a.toLowerCase().includes(normalized)) ||
      item.description.toLowerCase().includes(clean.replace(/^\//, ""))
  );
}
