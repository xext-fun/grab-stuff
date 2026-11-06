import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist");
await rm(out, { recursive: true, force: true });

const base = {
  manifest_version: 3,
  name: "Grab Stuff for X",
  version: "0.1.0",
  description: "Automatically save unique X timeline posts and download them as JSON or CSV.",
  icons: { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" },
  permissions: ["storage", "unlimitedStorage"],
  host_permissions: ["https://x.com/*", "https://twitter.com/*"],
  action: { default_title: "Show or hide Grab Stuff" },
  content_scripts: [{
    matches: ["https://x.com/*", "https://twitter.com/*"],
    js: ["core.js", "content.js"],
    run_at: "document_idle"
  }]
};

for (const target of ["chromium", "firefox", "safari"]) {
  const dir = join(out, target);
  await mkdir(dir, { recursive: true });
  await cp(join(root, "src", "core.js"), join(dir, "core.js"));
  await cp(join(root, "src", "content.js"), join(dir, "content.js"));
  await cp(join(root, "src", "background.js"), join(dir, "background.js"));
  await cp(join(root, "src", "icons"), join(dir, "icons"), { recursive: true });
  const manifest = { ...base };
  if (target === "firefox") {
    manifest.background = { scripts: ["core.js", "background.js"] };
    manifest.browser_specific_settings = { gecko: { id: "grab-stuff@example.org", strict_min_version: "109.0" } };
  } else {
    manifest.background = { service_worker: "background.js" };
    // In service workers, importScripts loads core before the event listeners register.
    const { readFile } = await import("node:fs/promises");
    const background = await readFile(join(dir, "background.js"), "utf8");
    await writeFile(join(dir, "background.js"), `importScripts("core.js");\n${background}`);
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}
