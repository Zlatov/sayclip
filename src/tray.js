import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import systrayPkg from "systray2";
import { pngFileToBase64, pngFileToIcoBase64 } from "./icon.js";

// systray2's ESM/CJS interop double-wraps the default export on some
// versions (m.default.default instead of m.default) — unwrap defensively.
const SysTray = typeof systrayPkg === "function" ? systrayPkg : systrayPkg.default;

const require = createRequire(import.meta.url);

// systray2 tries to chmod its bundled binary itself, but passes the shell
// syntax '+x' to Node's fs.chmod (which only accepts numeric modes) — that
// call silently throws and is swallowed, leaving the binary without exec
// permission and the later spawn failing with EACCES. Fix it ourselves
// before systray2 gets a chance to (mis)try.
function ensureTrayBinaryExecutable() {
  try {
    const pkgDir = path.dirname(require.resolve("systray2/package.json"));
    const binName = {
      win32: "tray_windows_release.exe",
      darwin: "tray_darwin_release",
      linux: "tray_linux_release",
    }[process.platform];
    if (binName) {
      fs.chmodSync(path.join(pkgDir, "traybin", binName), 0o755);
    }
  } catch {
    // best effort — if this fails, systray.ready() below will surface the real error
  }
}

const READY_PNG = fileURLToPath(new URL("./assets/tray-ready.png", import.meta.url));
const RECORDING_PNG = fileURLToPath(new URL("./assets/tray-recording.png", import.meta.url));

function iconFor(pngPath) {
  return process.platform === "win32" ? pngFileToIcoBase64(pngPath) : pngFileToBase64(pngPath);
}

let systray = null;

const quitItem = {
  title: "Quit",
  tooltip: "Stop sayclip",
  checked: false,
  enabled: true,
  click: () => {
    // kill() itself calls process.exit(0) once the tray subprocess has
    // confirmed it withdrew the icon — exiting eagerly here would race it
    // and leave a stale icon behind (only clears on hover).
    systray?.kill();
  },
};

function menuFor(pngPath, tooltip) {
  return {
    icon: iconFor(pngPath),
    title: "sayclip",
    tooltip,
    items: [quitItem],
  };
}

export async function startTray() {
  ensureTrayBinaryExecutable();

  systray = new SysTray({
    menu: menuFor(READY_PNG, "sayclip — ready"),
    debug: false,
    copyDir: false,
  });

  systray.onClick((action) => {
    action.item.click?.();
  });

  await systray.ready();
}

// Called on shutdown so the tray subprocess withdraws its icon cleanly
// before the process exits — otherwise Windows/Linux leave a stale icon
// that only disappears once the mouse hovers over it. Guarded with a
// timeout in case the subprocess is already gone and never fires 'exit'.
export function stopTray() {
  if (!systray) {
    return Promise.resolve();
  }
  return Promise.race([
    systray.kill().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

export function setTrayState(busy) {
  if (!systray) {
    return;
  }

  systray.sendAction({
    type: "update-menu",
    menu: busy
      ? menuFor(RECORDING_PNG, "sayclip — recording/transcribing")
      : menuFor(READY_PNG, "sayclip — ready"),
  });
}
