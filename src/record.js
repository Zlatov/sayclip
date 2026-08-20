import { spawn } from "node:child_process";

export function spawnRecording(filePath, { device } = {}) {
  if (process.platform === "win32") {
    return spawn(
      "ffmpeg",
      ["-f", "dshow", "-i", `audio=${device}`, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-y", filePath],
      { stdio: ["pipe", "ignore", "ignore"] },
    );
  }

  return spawn("arecord", ["-f", "S16_LE", "-r", "16000", "-c", "1", filePath], { stdio: "ignore" });
}

export function stopRecording(child) {
  if (process.platform === "win32") {
    // ffmpeg has no SIGINT-equivalent on Windows; it listens for "q" on
    // stdin to shut down and finalize the output file cleanly.
    child.stdin.write("q");
    child.stdin.end();
  } else {
    child.kill("SIGINT");
  }
}
