import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { uIOhook, UiohookKey } from "uiohook-napi";
import { transcribe } from "./transcribe.js";
import { copyToClipboard } from "./clipboard.js";
import { notify } from "./notify.js";

const HOTKEY = UiohookKey.CtrlRight;
const HOTKEY_LABEL = "Right Ctrl";

function readyLine() {
  return pc.dim(`● READY — hold ${HOTKEY_LABEL} to record`);
}

export function startListening() {
  let recording = null;

  function startRecording() {
    if (recording) {
      return;
    }

    const filePath = path.join(os.tmpdir(), `sayclip-voice-${Date.now()}.wav`);
    const child = spawn("arecord", ["-f", "S16_LE", "-r", "16000", "-c", "1", filePath], {
      stdio: "ignore",
    });

    child.on("error", (err) => {
      console.error(pc.red(`Failed to start arecord: ${err.message}`));
      recording = null;
    });

    recording = { process: child, filePath };
    console.log(pc.cyan("🎤 RECORDING"));
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    const { process: child, filePath } = recording;
    recording = null;

    console.log(pc.yellow("⏳ TRANSCRIBING"));

    await new Promise((resolve) => {
      child.once("close", resolve);
      child.kill("SIGINT");
    });

    try {
      const text = await transcribe(filePath);
      console.log(text || pc.dim("(empty)"));

      if (text) {
        try {
          await copyToClipboard(text);
          notify(text);
        } catch (clipErr) {
          console.error(pc.red(`Clipboard copy failed: ${clipErr.message}`));
          notify(text, { urgency: "low" });
        }
      }
    } catch (err) {
      console.error(pc.red(`Transcription failed: ${err.message}`));
      notify(`Transcription failed: ${err.message}`, { urgency: "critical" });
    } finally {
      fs.promises.unlink(filePath).catch(() => {});
    }

    console.log(readyLine());
  }

  uIOhook.on("keydown", (e) => {
    if (e.keycode === HOTKEY) {
      startRecording();
    }
  });

  uIOhook.on("keyup", (e) => {
    if (e.keycode === HOTKEY) {
      stopRecording();
    }
  });

  function shutdown() {
    uIOhook.stop();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  uIOhook.start();
  console.log(readyLine());
}
