/**
 * OpenAI Codex `apply_patch` parser, applier, and structured diff generator.
 * Produces line-numbered unified diffs matching `codex-rs/tui/src/history_cell/patches.rs`.
 */

export function computeStructuredDiff(filePath, oldContent, newContent, action = "update") {
  const oldLines = oldContent == null ? [] : String(oldContent).replace(/\r\n/g, "\n").split("\n");
  const newLines = newContent == null ? [] : String(newContent).replace(/\r\n/g, "\n").split("\n");

  if (action === "add" || oldContent == null) {
    const lines = newLines.map((text, idx) => ({
      type: "add",
      oldLine: null,
      newLine: idx + 1,
      text
    }));
    return {
      filePath,
      action: "add",
      added: newLines.length,
      removed: 0,
      lines
    };
  }

  if (action === "delete" || newContent == null) {
    const lines = oldLines.map((text, idx) => ({
      type: "del",
      oldLine: idx + 1,
      newLine: null,
      text
    }));
    return {
      filePath,
      action: "delete",
      added: 0,
      removed: oldLines.length,
      lines
    };
  }

  // LCS-based line diff for reasonable sizes, or fast window diff for huge files
  const m = oldLines.length;
  const n = newLines.length;

  if (m * n > 250000) {
    // Fast prefix/suffix diff for very large files
    let start = 0;
    while (start < m && start < n && oldLines[start] === newLines[start]) {
      start++;
    }
    let endOld = m - 1;
    let endNew = n - 1;
    while (endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) {
      endOld--;
      endNew--;
    }

    const lines = [];
    if (start > 0) {
      lines.push({
        type: "context",
        oldLine: start,
        newLine: start,
        text: oldLines[start - 1]
      });
    }
    let removed = 0;
    let added = 0;
    for (let i = start; i <= endOld; i++) {
      lines.push({ type: "del", oldLine: i + 1, newLine: null, text: oldLines[i] });
      removed++;
    }
    for (let j = start; j <= endNew; j++) {
      lines.push({ type: "add", oldLine: null, newLine: j + 1, text: newLines[j] });
      added++;
    }
    if (endNew + 1 < n) {
      lines.push({
        type: "context",
        oldLine: endOld + 2,
        newLine: endNew + 2,
        text: newLines[endNew + 1]
      });
    }
    return { filePath, action: "update", added, removed, lines };
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rawOps = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      rawOps.push({ type: "context", oldLine: i + 1, newLine: j + 1, text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawOps.push({ type: "del", oldLine: i + 1, newLine: null, text: oldLines[i] });
      removed++;
      i++;
    } else {
      rawOps.push({ type: "add", oldLine: null, newLine: j + 1, text: newLines[j] });
      added++;
      j++;
    }
  }
  while (i < m) {
    rawOps.push({ type: "del", oldLine: i + 1, newLine: null, text: oldLines[i] });
    removed++;
    i++;
  }
  while (j < n) {
    rawOps.push({ type: "add", oldLine: null, newLine: j + 1, text: newLines[j] });
    added++;
    j++;
  }

  // Keep changed lines plus up to 2 lines of surrounding context
  const changedIndices = new Set();
  rawOps.forEach((op, idx) => {
    if (op.type !== "context") {
      for (let c = Math.max(0, idx - 2); c <= Math.min(rawOps.length - 1, idx + 2); c++) {
        changedIndices.add(c);
      }
    }
  });

  const filtered = [];
  let lastIdx = -1;
  for (let idx = 0; idx < rawOps.length; idx++) {
    if (!changedIndices.has(idx)) continue;
    if (lastIdx !== -1 && idx - lastIdx > 1) {
      filtered.push({ type: "gap", oldLine: null, newLine: null, text: "⋮" });
    }
    filtered.push(rawOps[idx]);
    lastIdx = idx;
  }

  return {
    filePath,
    action: "update",
    added,
    removed,
    lines: filtered
  };
}

/**
 * Parses OpenAI Codex `*** Begin Patch` format into file operations.
 */
export function parseCodexPatch(patchText) {
  const lines = String(patchText || "").replace(/\r\n/g, "\n").split("\n");
  const operations = [];
  let currentOp = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("*** Begin Patch") || line.startsWith("*** End Patch")) {
      continue;
    }
    if (line.startsWith("*** Add File:")) {
      if (currentOp) operations.push(currentOp);
      currentOp = {
        action: "add",
        filePath: line.replace("*** Add File:", "").trim(),
        lines: []
      };
      continue;
    }
    if (line.startsWith("*** Update File:")) {
      if (currentOp) operations.push(currentOp);
      currentOp = {
        action: "update",
        filePath: line.replace("*** Update File:", "").trim(),
        lines: []
      };
      continue;
    }
    if (line.startsWith("*** Delete File:")) {
      if (currentOp) operations.push(currentOp);
      currentOp = {
        action: "delete",
        filePath: line.replace("*** Delete File:", "").trim(),
        lines: []
      };
      continue;
    }
    if (currentOp) {
      currentOp.lines.push(line);
    }
  }
  if (currentOp) operations.push(currentOp);
  return operations;
}

/**
 * Applies a parsed Codex operation to an existing string content.
 */
export function applyCodexFileOperation(op, existingContent = "") {
  if (op.action === "delete") {
    return null;
  }
  if (op.action === "add") {
    return op.lines
      .map((l) => (l.startsWith("+") ? l.slice(1) : l))
      .join("\n");
  }

  // Update file using hunks separated by @@
  const sourceLines = existingContent.replace(/\r\n/g, "\n").split("\n");
  const hunks = [];
  let currentHunk = [];

  for (const line of op.lines) {
    if (line.startsWith("@@")) {
      if (currentHunk.length > 0) hunks.push(currentHunk);
      currentHunk = [];
      continue;
    }
    if (line.startsWith("***")) continue;
    currentHunk.push(line);
  }
  if (currentHunk.length > 0) hunks.push(currentHunk);

  let working = [...sourceLines];

  for (const hunk of hunks) {
    const beforeBlock = [];
    const afterBlock = [];
    for (const line of hunk) {
      if (line.startsWith("-")) {
        beforeBlock.push(line.slice(1));
      } else if (line.startsWith("+")) {
        afterBlock.push(line.slice(1));
      } else if (line.startsWith(" ")) {
        beforeBlock.push(line.slice(1));
        afterBlock.push(line.slice(1));
      } else {
        beforeBlock.push(line);
        afterBlock.push(line);
      }
    }

    if (beforeBlock.length === 0) {
      working.push(...afterBlock);
      continue;
    }

    // Locate beforeBlock in working
    let matchIdx = -1;
    for (let i = 0; i <= working.length - beforeBlock.length; i++) {
      let matches = true;
      for (let k = 0; k < beforeBlock.length; k++) {
        if (working[i + k].trimEnd() !== beforeBlock[k].trimEnd()) {
          matches = false;
          break;
        }
      }
      if (matches) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      working.splice(matchIdx, beforeBlock.length, ...afterBlock);
    } else {
      // Fallback: fuzzy single-line or append
      working.push(...afterBlock);
    }
  }

  return working.join("\n");
}

/**
 * Formats a PatchHistoryCell summary into plain/ANSI lines for terminal/transcript output.
 */
export function formatPatchSummaryPlain(diffs) {
  if (!diffs || diffs.length === 0) return "• No file changes";
  const totalAdd = diffs.reduce((acc, d) => acc + (d.added || 0), 0);
  const totalDel = diffs.reduce((acc, d) => acc + (d.removed || 0), 0);
  const header =
    diffs.length === 1 && diffs[0].action === "add"
      ? `• Added ${diffs[0].filePath} (+${totalAdd} -${totalDel})`
      : diffs.length === 1 && diffs[0].action === "delete"
      ? `• Deleted ${diffs[0].filePath} (+${totalAdd} -${totalDel})`
      : diffs.length === 1
      ? `• Edited ${diffs[0].filePath} (+${totalAdd} -${totalDel})`
      : `• Edited ${diffs.length} files (+${totalAdd} -${totalDel})`;

  const out = [header];
  for (const d of diffs) {
    if (diffs.length > 1) {
      out.push(`  └ ${d.filePath} (+${d.added} -${d.removed})`);
    }
    const maxPreview = 16;
    const shown = (d.lines || []).slice(0, maxPreview);
    for (const l of shown) {
      if (l.type === "gap") {
        out.push(`      ⋮`);
      } else if (l.type === "add") {
        const num = String(l.newLine ?? "").padStart(4, " ");
        out.push(`${num} +${l.text}`);
      } else if (l.type === "del") {
        const num = String(l.oldLine ?? "").padStart(4, " ");
        out.push(`${num} -${l.text}`);
      } else {
        const num = String(l.newLine ?? l.oldLine ?? "").padStart(4, " ");
        out.push(`${num}  ${l.text}`);
      }
    }
    if ((d.lines || []).length > maxPreview) {
      out.push(`      ... +${d.lines.length - maxPreview} more diff lines`);
    }
  }
  return out.join("\n");
}
