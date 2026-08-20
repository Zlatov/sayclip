import { spawn } from "node:child_process";

const LINUX_CANDIDATES = [
  { cmd: "xclip", args: ["-selection", "clipboard"] },
  { cmd: "xsel", args: ["--clipboard", "--input"] },
  { cmd: "wl-copy", args: [] },
];

// "clip.exe" spelled out, not "clip" — spawn() on Windows without
// shell:true doesn't reliably do PATHEXT extension resolution the way
// cmd.exe does, so relying on the bare name is a real risk here.
const WINDOWS_CANDIDATES = [{ cmd: "clip.exe", args: [] }];

export function copyToClipboard(text) {
  const candidates = process.platform === "win32" ? WINDOWS_CANDIDATES : LINUX_CANDIDATES;
  return tryTool(0);

  function tryTool(i) {
    if (i >= candidates.length) {
      const names = candidates.map((c) => c.cmd).join(", ");
      return Promise.reject(new Error(`No clipboard tool found (tried ${names}).`));
    }

    const { cmd, args } = candidates[i];

    return new Promise((resolve, reject) => {
      let settled = false;
      const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });

      child.on("error", () => {
        if (settled) return;
        settled = true;
        resolve(tryTool(i + 1));
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve();
        } else {
          resolve(tryTool(i + 1));
        }
      });

      child.stdin.write(text);
      child.stdin.end();
    });
  }
}
