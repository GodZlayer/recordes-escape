import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = new Set();
let shuttingDown = false;

function portIsBusy(port, host) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

function start(command, args, name) {
  let child;
  try {
    child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: "inherit",
      windowsHide: false,
    });
  } catch (error) {
    console.error(`Não foi possível iniciar ${name}: ${error.message}`);
    shutdown(1);
    return null;
  }
  child.canvaName = name;
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`\n${name} foi encerrado inesperadamente (${signal || code || 0}).`);
      shutdown(code || 1);
    }
  });
  child.once("error", (error) => {
    console.error(`Não foi possível iniciar ${name}: ${error.message}`);
    shutdown(1);
  });
  return child;
}

function stopTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nEncerrando bridge e app Canva...");
  for (const child of children) stopTree(child);
  children.clear();
  process.exitCode = exitCode;
  setTimeout(() => process.exit(exitCode), 100);
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
process.once("SIGHUP", () => shutdown(0));

if (await portIsBusy(8080, "localhost") || await portIsBusy(3210, "127.0.0.1")) {
  console.error("As portas 8080 ou 3210 já estão em uso.");
  console.error("Feche a integração Canva anterior e execute este arquivo novamente.");
  process.exit(1);
}

console.log("Iniciando bridge: http://127.0.0.1:3210");
start(process.execPath, ["scripts/canva-bridge.mjs"], "Bridge Canva");

console.log("Iniciando bundle: http://localhost:8080");
if (process.platform === "win32") {
  start(
    process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
    ["/d", "/s", "/c", "npm.cmd --prefix canva-app run dev"],
    "App Canva",
  );
} else {
  start("npm", ["--prefix", "canva-app", "run", "dev"], "App Canva");
}

console.log("\nIntegração ativa. Pressione Ctrl+C para encerrar.\n");
await new Promise(() => {});
