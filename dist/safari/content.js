"use strict";

(() => {
  if (window.top !== window || document.getElementById("grab-stuff-host")) return;
  const ext = typeof browser !== "undefined" ? browser : chrome;
  const isBrowser = typeof browser !== "undefined";
  const core = GrabStuffCore;
  let state = { posts: [], settings: { enabled: true, includeReplies: false, handles: [] } };
  let sidebarOpen = true;
  let scanTimer;
  let scanning = false;
  let rescanRequested = false;
  const seen = new Set();

  function send(message) {
    if (isBrowser) return ext.runtime.sendMessage(message);
    return new Promise((resolve, reject) => ext.runtime.sendMessage(message, response => {
      const error = ext.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(response);
    }));
  }

  const host = document.createElement("div");
  host.id = "grab-stuff-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: system-ui, -apple-system, sans-serif; color: #17212b; }
      * { box-sizing: border-box; }
      .handle { position: fixed; right: 0; top: 40%; z-index: 2147483646; border: 0; border-radius: 12px 0 0 12px; background: #174ea6; color: white; padding: 12px 9px; cursor: pointer; box-shadow: 0 2px 10px #0003; writing-mode: vertical-rl; font: 700 13px system-ui; }
      .panel { position: fixed; inset: 0 0 0 auto; width: min(370px, 100vw); z-index: 2147483647; background: #fff; border-left: 1px solid #d5dce3; box-shadow: -4px 0 24px #0002; display: flex; flex-direction: column; font: 14px system-ui; }
      [hidden] { display: none !important; }
      header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e4e8ec; }
      h1 { font-size: 18px; margin: 0; }
      button { cursor: pointer; font: inherit; }
      .close { background: none; border: 0; font-size: 24px; line-height: 1; color: #435465; }
      .body { padding: 16px; overflow: auto; flex: 1; }
      .status { margin: 0 0 18px; color: #435465; }
      .switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid #e4e8ec; }
      input[type=checkbox] { width: 18px; height: 18px; accent-color: #174ea6; }
      .actions { display: flex; gap: 8px; margin: 18px 0 10px; }
      .primary, .secondary { border-radius: 8px; padding: 9px 12px; }
      .primary { background: #174ea6; color: white; border: 1px solid #174ea6; }
      .secondary { background: white; color: #174ea6; border: 1px solid #9fb7d7; }
      .clear { margin-top: 8px; background: none; border: 0; color: #a32828; padding: 6px 0; }
      .filter { border-top: 1px solid #e4e8ec; padding-top: 14px; }
      .filter strong { display: block; margin-bottom: 8px; }
      .filter input { width: 100%; font: inherit; }
      .filter-status { color: #435465; font-size: 12px; overflow-wrap: anywhere; }
      .remove-filter { background: none; border: 0; padding: 0; color: #174ea6; }
      .hint { color: #5d6b78; font-size: 12px; line-height: 1.45; }
      ol { list-style: none; padding: 0; margin: 12px 0; }
      li { border-top: 1px solid #e4e8ec; padding: 10px 0; }
      li a { color: #174ea6; text-decoration: none; font-weight: 600; }
      li p { margin: 5px 0 0; overflow-wrap: anywhere; white-space: pre-wrap; line-height: 1.4; }
      .error { color: #a32828; min-height: 18px; font-size: 12px; }
    </style>
    <button class="handle" type="button" hidden>Grab Stuff</button>
    <aside class="panel" aria-label="Grab Stuff sidebar">
      <header><h1>Grab Stuff</h1><button class="close" type="button" aria-label="Close sidebar">×</button></header>
      <div class="body">
        <p class="status"></p>
        <label class="switch"><span>Automatic capture</span><input class="enabled" type="checkbox"></label>
        <label class="switch"><span>Include replies</span><input class="replies" type="checkbox"></label>
        <div class="filter">
          <strong>Capture only these handles</strong>
          <input class="upload" type="file" accept=".txt,.csv,text/plain,text/csv" aria-label="Upload a TXT or CSV list of handles">
          <p class="filter-status"></p>
          <button class="remove-filter" type="button" hidden>Remove handle filter</button>
        </div>
        <div class="actions"><button class="primary json" type="button">Download JSON</button><button class="secondary csv" type="button">CSV</button></div>
        <p class="hint">Captures posts as they load while you browse or scroll. Each post is saved once by its status ID.</p>
        <button class="clear" type="button">Clear saved posts</button>
        <p class="error" role="alert"></p>
        <ol class="posts"></ol>
      </div>
    </aside>`;
  document.documentElement.appendChild(host);
  const $ = selector => shadow.querySelector(selector);

  function render() {
    $(".panel").hidden = !sidebarOpen;
    $(".handle").hidden = sidebarOpen;
    $(".enabled").checked = state.settings.enabled;
    $(".replies").checked = state.settings.includeReplies;
    const handles = state.settings.handles || [];
    $(".filter-status").textContent = handles.length
      ? `${handles.length} handle${handles.length === 1 ? "" : "s"}: ${handles.slice(0, 5).map(handle => `@${handle}`).join(", ")}${handles.length > 5 ? "…" : ""}`
      : "No list uploaded. Capturing from all handles.";
    $(".remove-filter").hidden = handles.length === 0;
    const count = state.posts.length;
    $(".status").textContent = `${count} unique post${count === 1 ? "" : "s"} saved`;
    $(".json").disabled = $(".csv").disabled = count === 0;
    const list = $(".posts");
    list.replaceChildren();
    for (const post of state.posts.slice(-30).reverse()) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = post.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `@${post.username} · ${post.type}`;
      const p = document.createElement("p");
      p.textContent = post.text || "(No text)";
      li.append(a, p);
      list.append(li);
    }
  }

  function extract(article) {
    const time = article.querySelector("time");
    const link = time && time.closest("a[href*='/status/']");
    const status = link && core.parseStatusUrl(link.href);
    if (!status) return null;
    const text = article.querySelector('[data-testid="tweetText"]')?.innerText || "";
    const articleText = article.innerText || "";
    const reply = /(?:^|\n)Replying to\s+@/i.test(articleText) ||
      !!article.querySelector('[data-testid="replyingTo"], [data-testid="replying-to"]');
    return { ...status, text, createdAt: time.dateTime || null,
      capturedAt: new Date().toISOString(), type: reply ? "reply" : "post", source: location.href };
  }

  async function scan() {
    if (scanning) { rescanRequested = true; return; }
    if (!state.settings.enabled) return;
    scanning = true;
    try {
      const fresh = [];
      for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
        const post = extract(article);
        if (!post || seen.has(post.id)) continue;
        seen.add(post.id);
        if ((state.settings.includeReplies || post.type !== "reply") &&
            core.matchesHandle(post, state.settings.handles)) fresh.push(post);
      }
      if (fresh.length) {
        const response = await send({ type: "ADD_POSTS", posts: fresh });
        if (response?.error) throw new Error(response.error);
        if (response) { state = response; render(); }
      }
    } catch (error) {
      $(".error").textContent = `Capture failed: ${error.message}`;
      for (const post of document.querySelectorAll('article[data-testid="tweet"]')) {
        const parsed = extract(post);
        if (parsed) seen.delete(parsed.id);
      }
    } finally {
      scanning = false;
      if (rescanRequested) { rescanRequested = false; scheduleScan(); }
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 250);
  }

  function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
  function download(format) {
    const posts = state.posts;
    let content, mime;
    if (format === "json") {
      content = JSON.stringify(posts, null, 2);
      mime = "application/json";
    } else {
      const fields = ["id", "url", "username", "text", "type", "createdAt", "capturedAt", "source"];
      content = [fields.join(","), ...posts.map(post => fields.map(field => csvCell(post[field])).join(","))].join("\r\n");
      mime = "text/csv";
    }
    const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `grab-stuff-${new Date().toISOString().slice(0, 10)}.${format}`;
    shadow.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function updateSettings(change) {
    try {
      const response = await send({ type: "SET_SETTINGS", ...change });
      if (response?.error) throw new Error(response.error);
      state = response;
      if ("handles" in change || change.includeReplies === true || change.enabled === true) seen.clear();
      render();
      scheduleScan();
    } catch (error) { $(".error").textContent = error.message; render(); }
  }

  $(".handle").addEventListener("click", () => { sidebarOpen = true; render(); });
  $(".close").addEventListener("click", () => { sidebarOpen = false; render(); });
  $(".enabled").addEventListener("change", event => updateSettings({ enabled: event.target.checked }));
  $(".replies").addEventListener("change", event => updateSettings({ includeReplies: event.target.checked }));
  $(".upload").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) { $(".error").textContent = "List must be 1 MB or smaller."; return; }
    try {
      const handles = core.parseHandleList(await file.text(), file.name);
      if (!handles.length) throw new Error("No valid X handles found in that file.");
      if (handles.length > 10000) throw new Error("The list must contain at most 10,000 handles.");
      $(".error").textContent = "";
      await updateSettings({ handles });
    } catch (error) { $(".error").textContent = error.message; }
  });
  $(".remove-filter").addEventListener("click", () => updateSettings({ handles: [] }));
  $(".json").addEventListener("click", () => download("json"));
  $(".csv").addEventListener("click", () => download("csv"));
  $(".clear").addEventListener("click", async () => {
    if (!confirm("Clear all saved posts?")) return;
    const response = await send({ type: "CLEAR_POSTS" });
    if (response?.error) { $(".error").textContent = response.error; return; }
    state = response;
    render();
  });

  ext.runtime.onMessage.addListener(message => {
    if (message?.type === "TOGGLE_SIDEBAR") { sidebarOpen = !sidebarOpen; render(); }
  });
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.posts) state.posts = changes.posts.newValue || [];
    if (changes.settings) {
      const wasEnabled = state.settings.enabled;
      const previousHandles = JSON.stringify(state.settings.handles || []);
      state.settings = { ...state.settings, ...changes.settings.newValue };
      if ((!wasEnabled && state.settings.enabled) ||
          previousHandles !== JSON.stringify(state.settings.handles || [])) {
        seen.clear(); scheduleScan();
      }
    }
    render();
  });
  new MutationObserver(records => {
    if (records.some(record => !host.contains(record.target))) scheduleScan();
  }).observe(document.documentElement, { childList: true, subtree: true });
  send({ type: "GET_STATE" }).then(response => {
    if (response?.error) throw new Error(response.error);
    state = response;
    render();
    scheduleScan();
  }).catch(error => { $(".error").textContent = error.message; });
})();
