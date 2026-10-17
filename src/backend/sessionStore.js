import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_PERMISSION_MODE
} from "../shared/constants.js";

export class SessionStore {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.storeDir = path.join(workspaceRoot, ".codex-free");
    this.storeFile = path.join(this.storeDir, "sessions.json");
    this.sessions = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storeFile)) {
        const raw = JSON.parse(fs.readFileSync(this.storeFile, "utf8"));
        if (Array.isArray(raw)) {
          for (const s of raw) {
            this.sessions.set(s.id, s);
          }
        }
      }
    } catch {}
  }

  save() {
    try {
      fs.mkdirSync(this.storeDir, { recursive: true });
      const arr = Array.from(this.sessions.values()).slice(-30);
      fs.writeFileSync(this.storeFile, JSON.stringify(arr, null, 2), "utf8");
    } catch {}
  }

  createSession({
    title = "New Codex Session",
    model = DEFAULT_MODEL,
    reasoningEffort = DEFAULT_REASONING_EFFORT,
    permissionMode = DEFAULT_PERMISSION_MODE,
    forkedFrom = null
  } = {}) {
    const id = `thread_${crypto.randomBytes(6).toString("hex")}`;
    const session = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model,
      reasoningEffort,
      permissionMode,
      forkedFrom,
      planMode: false,
      goal: null,
      tokensUsed: {
        input: 420,
        output: 0,
        total: 420
      },
      messages: [],
      approvedPrefixes: []
    };
    this.sessions.set(id, session);
    this.save();
    return session;
  }

  getSession(id) {
    if (id && this.sessions.has(id)) {
      return this.sessions.get(id);
    }
    const all = this.listSessions();
    if (all.length > 0) return all[0];
    return this.createSession();
  }

  listSessions() {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  updateSession(id, patch) {
    const s = this.getSession(id);
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    this.sessions.set(s.id, s);
    this.save();
    return s;
  }

  forkSession(id) {
    const orig = this.getSession(id);
    const forked = this.createSession({
      title: `${orig.title} (fork)`,
      model: orig.model,
      reasoningEffort: orig.reasoningEffort,
      permissionMode: orig.permissionMode,
      forkedFrom: orig.id
    });
    forked.messages = JSON.parse(JSON.stringify(orig.messages || []));
    forked.tokensUsed = { ...orig.tokensUsed };
    this.sessions.set(forked.id, forked);
    this.save();
    return forked;
  }
}
