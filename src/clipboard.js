import { spawn } from "node:child_process";

const LINUX_CANDIDATES = [
  { cmd: "xclip", args: ["-selection", "clipboard"] },
  { cmd: "xsel", args: ["--clipboard", "--input"] },
  { cmd: "wl-copy", args: [] },
];

function copyOnLinux(text) {
  return tryTool(0);

  function tryTool(i) {
    if (i >= LINUX_CANDIDATES.length) {
      const names = LINUX_CANDIDATES.map((c) => c.cmd).join(", ");
      return Promise.reject(new Error(`No clipboard tool found (tried ${names}).`));
    }

    const { cmd, args } = LINUX_CANDIDATES[i];

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

function copyOnWindows(text) {
  // clip.exe cannot reliably accept UTF-8 over stdin — it reinterprets the
  // bytes through a legacy codepage regardless of the console's own
  // codepage, mangling any non-ASCII text (confirmed: Cyrillic came out as
  // "╨Я╤А╨╕╨▓╨╡╤В..." garbage). Set-Clipboard goes through .NET's Unicode
  // clipboard API instead. The text travels as a base64 argument — not
  // interpolated into the command string — so neither PowerShell quoting
  // nor encoding can corrupt or inject into it (spoken text is arbitrary
  // user input; naively embedding it in a -Command string would be a real
  // injection risk).
  const b64 = Buffer.from(text, "utf8").toString("base64");
  const psCommand = `Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')))`;

  return new Promise((resolve, reject) => {
    let settled = false;
    // "powershell.exe" spelled out, not "powershell" — spawn() on Windows
    // without shell:true doesn't reliably do PATHEXT extension resolution
    // the way cmd.exe does.
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCommand], {
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`powershell Set-Clipboard exited with code ${code}`));
      }
    });
  });
}

export function copyToClipboard(text) {
  return process.platform === "win32" ? copyOnWindows(text) : copyOnLinux(text);
}
