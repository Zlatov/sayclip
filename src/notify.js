import { spawn } from "node:child_process";
import notifier from "node-notifier";
import { getNotificationsEnabled } from "./config.js";

const TEXT_LIMIT = 500;

export function notify(body, { urgency = "normal" } = {}) {
  // Errors stay visible even with notifications turned off — the toggle is
  // meant to silence the routine "here's your text" ping, not real failures.
  if (urgency !== "critical" && !getNotificationsEnabled()) {
    return;
  }

  const truncated = body.length > TEXT_LIMIT ? `${body.slice(0, TEXT_LIMIT)}…` : body;

  if (process.platform === "win32") {
    notifier.notify({ title: "sayclip", message: truncated });
    return;
  }

  spawn("notify-send", ["-a", "sayclip", "-u", urgency, "sayclip", truncated], { stdio: "ignore" }).on(
    "error",
    () => {},
  );
}
