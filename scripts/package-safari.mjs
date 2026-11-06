import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const run = promisify(execFile);
const root = new URL("..", import.meta.url).pathname;
const output = join(root, "dist", "safari-app");
await run("xcrun", [
  "safari-web-extension-converter", join(root, "dist", "safari"),
  "--project-location", output,
  "--app-name", "Grab Stuff",
  "--bundle-identifier", "com.grabstuff.extension",
  "--macos-only", "--copy-resources", "--no-open", "--no-prompt", "--force"
]);

// The converter can give the app and embedded extension unrelated bundle IDs.
// Xcode requires the extension ID to start with the app's ID.
const project = join(output, "Grab Stuff", "Grab Stuff.xcodeproj", "project.pbxproj");
let pbx = await readFile(project, "utf8");
pbx = pbx.replaceAll("com.grabstuff.extension.Extension", "com.grabstuff.Grab-Stuff.Extension");
await writeFile(project, pbx);
console.log(`Safari Xcode project: ${project}`);
