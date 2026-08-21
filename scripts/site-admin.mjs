import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createSiteAdminServer } from "./site-admin-tools.mjs";
import { parseArguments } from "./template-tools.mjs";

const root = process.cwd();
const args = parseArguments(process.argv.slice(2));
const port = Number(args.port || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("--port must be an integer between 1 and 65535.");
  process.exit(1);
}
const token = crypto.randomBytes(24).toString("hex");
const server = createSiteAdminServer({ root, token });

function openBrowser(url) {
  if (args["no-open"]) return;
  let command;
  let commandArgs;
  if (process.platform === "win32") {
    command = "rundll32.exe";
    commandArgs = ["url.dll,FileProtocolHandler", url];
  } else if (process.platform === "darwin") {
    command = "open";
    commandArgs = [url];
  } else {
    command = "xdg-open";
    commandArgs = [url];
  }
  const child = spawn(command, commandArgs, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `Port ${port} is already in use. Run with --port <number>.` : error.message);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/#token=${token}`;
  console.log(`Local Site Studio is ready: ${url}`);
  console.log("It can only be reached from this computer. Press Ctrl+C to stop it.");
  openBrowser(url);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
