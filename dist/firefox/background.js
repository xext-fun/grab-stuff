"use strict";

const ext = typeof browser !== "undefined" ? browser : chrome;
const isBrowser = typeof browser !== "undefined";
let queue = Promise.resolve();

function getStorage() {
  return isBrowser ? ext.storage.local.get(["posts", "settings"]) :
    new Promise((resolve, reject) => ext.storage.local.get(["posts", "settings"], value => {
      const error = ext.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(value);
    }));
}

function setStorage(value) {
  return isBrowser ? ext.storage.local.set(value) :
    new Promise((resolve, reject) => ext.storage.local.set(value, () => {
      const error = ext.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve();
    }));
}

async function handle(message) {
  const state = await getStorage();
  const settings = { enabled: true, includeReplies: false, handles: [], ...state.settings };
  const posts = Array.isArray(state.posts) ? state.posts : [];
  if (message.type === "GET_STATE") return { posts, settings };
  if (message.type === "ADD_POSTS") {
    if (!settings.enabled) return { posts, settings, added: 0 };
    const result = GrabStuffCore.addUnique(posts,
      (message.posts || []).filter(post =>
        (settings.includeReplies || post.type !== "reply") &&
        GrabStuffCore.matchesHandle(post, settings.handles)));
    if (result.added) await setStorage({ posts: result.posts });
    return { posts: result.posts, settings, added: result.added };
  }
  if (message.type === "SET_SETTINGS") {
    const next = { ...settings };
    if (typeof message.enabled === "boolean") next.enabled = message.enabled;
    if (typeof message.includeReplies === "boolean") next.includeReplies = message.includeReplies;
    if (Array.isArray(message.handles)) {
      next.handles = [...new Set(message.handles.map(GrabStuffCore.normalizeHandle).filter(Boolean))].slice(0, 10000);
    }
    await setStorage({ settings: next });
    return { posts, settings: next };
  }
  if (message.type === "CLEAR_POSTS") {
    await setStorage({ posts: [] });
    return { posts: [], settings };
  }
  return null;
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["GET_STATE", "ADD_POSTS", "SET_SETTINGS", "CLEAR_POSTS"].includes(message.type)) return false;
  queue = queue.catch(() => {}).then(() => handle(message));
  queue.then(sendResponse, error => sendResponse({ error: String(error.message || error) }));
  return true;
});

ext.action.onClicked.addListener(tab => {
  if (tab.id == null) return;
  try {
    const result = ext.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" });
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch { /* No content script on this tab. */ }
});
