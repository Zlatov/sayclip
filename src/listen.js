import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import pc from "picocolors";
import { uIOhook, UiohookKey } from "uiohook-napi";
import { transcribe } from "./transcribe.js";
import { copyToClipboard } from "./clipboard.js";
import { notify } from "./notify.js";
import { spawnRecording, stopRecording as stopRecordingProcess } from "./record.js";
import { getRecordingDevice } from "./config.js";
import { startTray, setTrayState, stopTray } from "./tray.js";

const HOTKEY = UiohookKey.CtrlRight;
const HOTKEY_LABEL = "Right Ctrl";
const MIN_RECORDING_MS = 400;

function readyLine() {
  return pc.dim(`● READY — hold ${HOTKEY_LABEL} to record`);
}

export function startListening() {
  let recording = null;
  let starting = false;

  startTray().catch((err) => {
    console.error(pc.dim(`(tray icon unavailable: ${err.message})`));
  });

  async function startRecording() {
    if (recording || starting) {
      return;
    }
    starting = true;

    try {
      const device = await getRecordingDevice();
      if (process.platform === "win32" && !device) {
        console.error(pc.red("No microphone device configured."));
        return;
      }

      const filePath = path.join(os.tmpdir(), `sayclip-voice-${Date.now()}.wav`);
      const child = spawnRecording(filePath, { device });

      child.on("error", (err) => {
        console.error(pc.red(`Failed to start recording: ${err.message}`));
        recording = null;
        setTrayState(false);
      });

      recording = { process: child, filePath, startedAt: Date.now() };
      console.log(pc.cyan("🎤 RECORDING"));
      setTrayState(true);
    } finally {
      starting = false;
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    const { process: child, filePath, startedAt } = recording;
    recording = null;

    const tooShort = Date.now() - startedAt < MIN_RECORDING_MS;
    console.log(tooShort ? pc.dim("(too short, skipped)") : pc.yellow("⏳ TRANSCRIBING"));

    await new Promise((resolve) => {
      child.once("close", resolve);
      stopRecordingProcess(child);
    });

    if (tooShort) {
      fs.promises.unlink(filePath).catch(() => {});
      setTrayState(false);
      console.log(readyLine());
      return;
    }

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

    setTrayState(false);
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

  async function shutdown() {
    uIOhook.stop();
    await stopTray();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  uIOhook.start();
  console.log(readyLine());
}
