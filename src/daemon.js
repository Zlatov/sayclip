import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SAYCLIP_DIR = path.join(os.homedir(), ".sayclip");
const PID_PATH = path.join(SAYCLIP_DIR, "daemon.pid");
const LOG_PATH = path.join(SAYCLIP_DIR, "daemon.log");
const CLI_SCRIPT_PATH = fileURLToPath(new URL("../bin/sayclip.js", import.meta.url));

export { LOG_PATH };

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getRunningPid() {
  let pid;
  try {
    pid = parseInt(fs.readFileSync(PID_PATH, "utf8").trim(), 10);
  } catch {
    return null;
  }

  if (!pid || !isAlive(pid)) {
    fs.rmSync(PID_PATH, { force: true });
    return null;
  }

  return pid;
}

export function registerCurrentProcess() {
  fs.mkdirSync(SAYCLIP_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(PID_PATH, String(process.pid));

  process.on("exit", () => {
    try {
      if (fs.readFileSync(PID_PATH, "utf8").trim() === String(process.pid)) {
        fs.rmSync(PID_PATH, { force: true });
      }
    } catch {
      // already gone
    }
  });
}

export function startDaemon() {
  const existing = getRunningPid();
  if (existing) {
    console.log(`Already running (pid ${existing}). Log: ${LOG_PATH}`);
    return;
  }

  fs.mkdirSync(SAYCLIP_DIR, { recursive: true, mode: 0o700 });
  const out = fs.openSync(LOG_PATH, "a");
  const err = fs.openSync(LOG_PATH, "a");

  const child = spawn(process.execPath, [CLI_SCRIPT_PATH], {
    detached: true,
    stdio: ["ignore", out, err],
  });
  child.unref();

  console.log(`Started (pid ${child.pid}). Log: ${LOG_PATH}`);
}

export function stopDaemon() {
  const pid = getRunningPid();
  if (!pid) {
    console.log("Not running.");
    return;
  }

  process.kill(pid, "SIGTERM");
  fs.rmSync(PID_PATH, { force: true });
  console.log(`Stopped (pid ${pid}).`);
}
