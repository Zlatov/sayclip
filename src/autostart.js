import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const CLI_SCRIPT_PATH = fileURLToPath(new URL("../bin/sayclip.js", import.meta.url));

const SYSTEMD_USER_DIR = path.join(os.homedir(), ".config", "systemd", "user");
const SYSTEMD_UNIT_PATH = path.join(SYSTEMD_USER_DIR, "sayclip.service");

const WIN_RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const WIN_RUN_VALUE = "sayclip";

export function autostartSupported() {
  return process.platform === "linux" || process.platform === "win32";
}

function systemdUnit() {
  // Absolute node + script paths, not the bare "sayclip" command: systemd
  // --user units don't source shell rc files, so a PATH that only exists
  // via .bashrc/.zshrc (nvm-managed installs) would otherwise be invisible
  // here. No ExecStart "start" arg — Type=simple wants ExecStart itself to
  // be the long-running foreground process, not a detached-daemon spawner.
  return [
    "[Unit]",
    "Description=sayclip push-to-talk voice-to-clipboard daemon",
    "After=graphical-session.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart="${process.execPath}" "${CLI_SCRIPT_PATH}"`,
    "Restart=on-failure",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

export async function isAutostartEnabled() {
  if (process.platform === "linux") {
    return fs.existsSync(SYSTEMD_UNIT_PATH);
  }
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("reg", ["query", WIN_RUN_KEY, "/v", WIN_RUN_VALUE], {
        windowsHide: true,
      });
      return stdout.includes(WIN_RUN_VALUE);
    } catch {
      return false;
    }
  }
  return false;
}

export async function enableAutostart() {
  if (process.platform === "linux") {
    fs.mkdirSync(SYSTEMD_USER_DIR, { recursive: true });
    fs.writeFileSync(SYSTEMD_UNIT_PATH, systemdUnit());
    await execFileAsync("systemctl", ["--user", "daemon-reload"]);
    await execFileAsync("systemctl", ["--user", "enable", "--now", "sayclip.service"]);
    return;
  }
  if (process.platform === "win32") {
    const command = `"${process.execPath}" "${CLI_SCRIPT_PATH}" start`;
    await execFileAsync("reg", ["add", WIN_RUN_KEY, "/v", WIN_RUN_VALUE, "/d", command, "/f"], {
      windowsHide: true,
    });
    return;
  }
  throw new Error(`Autostart is not supported on ${process.platform}.`);
}

export async function disableAutostart() {
  if (process.platform === "linux") {
    await execFileAsync("systemctl", ["--user", "disable", "--now", "sayclip.service"]).catch(() => {});
    fs.rmSync(SYSTEMD_UNIT_PATH, { force: true });
    return;
  }
  if (process.platform === "win32") {
    await execFileAsync("reg", ["delete", WIN_RUN_KEY, "/v", WIN_RUN_VALUE, "/f"], { windowsHide: true });
    return;
  }
}
