(function (root) {
  "use strict";

  const STATUS_PATH = /^\/(?:[^/]+)\/status\/(\d+)(?:\/|$)/;

  function parseStatusUrl(value) {
    try {
      const url = new URL(value, "https://x.com");
      if (!/^(?:x\.com|twitter\.com|www\.twitter\.com|www\.x\.com)$/i.test(url.hostname)) return null;
      const match = url.pathname.match(STATUS_PATH);
      if (!match) return null;
      const username = url.pathname.split("/")[1];
      return { id: match[1], username, url: `https://x.com/${username}/status/${match[1]}` };
    } catch {
      return null;
    }
  }

  function normalizePost(post) {
    const status = parseStatusUrl(post && post.url);
    if (!status) return null;
    return {
      id: status.id,
      url: status.url,
      username: status.username,
      text: String(post.text || "").trim(),
      createdAt: post.createdAt || null,
      capturedAt: post.capturedAt || new Date().toISOString(),
      type: post.type === "reply" ? "reply" : "post",
      source: post.source || null
    };
  }

  function normalizeHandle(value) {
    let candidate = String(value || "").trim().replace(/^\uFEFF/, "");
    if (/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\//i.test(candidate)) {
      try {
        const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
        if (!/^(?:x|twitter)\.com$|^www\.(?:x|twitter)\.com$/i.test(url.hostname)) return null;
        const parts = url.pathname.split("/").filter(Boolean);
        candidate = parts.length === 1 ? parts[0] : "";
      } catch { return null; }
    }
    candidate = candidate.replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(candidate)) return null;
    if (/^(?:handle|username|screen_name)$/i.test(candidate)) return null;
    return candidate.toLowerCase();
  }

  function csvRows(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(field); field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += char;
    }
    row.push(field);
    rows.push(row);
    return rows;
  }

  function parseHandleList(text, filename = "") {
    let values;
    if (/\.csv$/i.test(filename)) {
      const rows = csvRows(String(text));
      const header = rows[0]?.map(cell => cell.trim().toLowerCase()) || [];
      const index = header.findIndex(cell => ["handle", "username", "screen_name"].includes(cell));
      values = rows.slice(index >= 0 ? 1 : 0).map(row => row[index >= 0 ? index : 0]);
    } else {
      values = String(text).split(/[\s,;]+/);
    }
    return [...new Set(values.map(normalizeHandle).filter(Boolean))];
  }

  function matchesHandle(post, handles) {
    if (!Array.isArray(handles) || handles.length === 0) return true;
    const handle = normalizeHandle(post && post.username);
    return handle !== null && handles.includes(handle);
  }

  function addUnique(existing, incoming) {
    const byId = new Map();
    for (const post of existing || []) {
      const clean = normalizePost(post);
      if (clean) byId.set(clean.id, clean);
    }
    let added = 0;
    for (const post of incoming || []) {
      const clean = normalizePost(post);
      if (clean && !byId.has(clean.id)) {
        byId.set(clean.id, clean);
        added++;
      }
    }
    return { posts: [...byId.values()], added };
  }

  const api = { parseStatusUrl, normalizePost, normalizeHandle, parseHandleList, matchesHandle, addUnique };
  root.GrabStuffCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
