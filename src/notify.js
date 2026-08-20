import { spawn } from "node:child_process";

const TEXT_LIMIT = 500;

export function notify(body, { urgency = "normal" } = {}) {
  const truncated = body.length > TEXT_LIMIT ? `${body.slice(0, TEXT_LIMIT)}…` : body;
  spawn("notify-send", ["-a", "sayclip", "-u", urgency, "sayclip", truncated], { stdio: "ignore" }).on(
    "error",
    () => {},
  );
}
