import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import systrayPkg from "systray2";
import { solidColorPngBase64, solidColorIcoBase64 } from "./icon.js";

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

const YELLOW = [242, 201, 76];
const GREEN = [87, 187, 138];

function iconFor(color) {
  return process.platform === "win32" ? solidColorIcoBase64(16, color) : solidColorPngBase64(16, color);
}

let systray = null;

const quitItem = {
  title: "Quit",
  tooltip: "Stop sayclip",
  checked: false,
  enabled: true,
  click: () => {
    systray?.kill();
    process.exit(0);
  },
};

function menuFor(color, tooltip) {
  return {
    icon: iconFor(color),
    title: "sayclip",
    tooltip,
    items: [quitItem],
  };
}

export async function startTray() {
  ensureTrayBinaryExecutable();

  systray = new SysTray({
    menu: menuFor(GREEN, "sayclip — ready"),
    debug: false,
    copyDir: false,
  });

  systray.onClick((action) => {
    action.item.click?.();
  });

  await systray.ready();
}

export function setTrayState(busy) {
  if (!systray) {
    return;
  }

  systray.sendAction({
    type: "update-menu",
    menu: busy ? menuFor(YELLOW, "sayclip — recording/transcribing") : menuFor(GREEN, "sayclip — ready"),
  });
}
