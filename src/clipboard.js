import { spawn } from "node:child_process";

const CANDIDATES = [
  { cmd: "xclip", args: ["-selection", "clipboard"] },
  { cmd: "xsel", args: ["--clipboard", "--input"] },
  { cmd: "wl-copy", args: [] },
];

export function copyToClipboard(text) {
  return tryTool(0);

  function tryTool(i) {
    if (i >= CANDIDATES.length) {
      return Promise.reject(new Error("No clipboard tool found (tried xclip, xsel, wl-copy)."));
    }

    const { cmd, args } = CANDIDATES[i];

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
