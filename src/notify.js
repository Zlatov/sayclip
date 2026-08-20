import { spawn } from "node:child_process";
import notifier from "node-notifier";

const TEXT_LIMIT = 500;

export function notify(body, { urgency = "normal" } = {}) {
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
