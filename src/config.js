import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { ensureWhisperRuntime, ensureWhisperModel, runtimeAvailableForThisMachine, MODELS } from "./runtime.js";
import { autostartSupported, isAutostartEnabled, enableAutostart, disableAutostart } from "./autostart.js";

const CONFIG_DIR = path.join(os.homedir(), ".sayclip");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeConfigFile(patch) {
  const config = { ...readConfigFile(), ...patch };
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function hasWhisperConfig() {
  const config = readConfigFile();
  return Boolean(config?.whisperBinary && config?.whisperModel);
}

export function getNotificationsEnabled() {
  const config = readConfigFile();
  return config?.notifications !== false;
}

function expandHome(rawPath) {
  if (rawPath === "~") {
    return os.homedir();
  }
  if (rawPath.startsWith("~/")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return rawPath;
}

async function chooseWhisperBinary(ask, currentBinary) {
  if (!runtimeAvailableForThisMachine()) {
    const answer = await ask(`Path to whisper-cli binary${currentBinary ? ` [${currentBinary}]` : ""}: `);
    return answer || currentBinary;
  }

  console.log("\nWhisper binary:");
  console.log("  1. Download prebuilt runtime automatically (recommended)");
  console.log("  2. Enter my own whisper-cli path");
  const hint = currentBinary ? `Enter to keep current: ${currentBinary}` : "Enter for option 1";
  const choice = await ask(`Choice [1/2] (${hint}): `);

  if (!choice) {
    return currentBinary || ensureWhisperRuntime();
  }
  if (choice === "2") {
    const answer = await ask("Path to whisper-cli binary: ");
    return answer || currentBinary;
  }
  return ensureWhisperRuntime();
}

function listModelsInSameDir(modelPath) {
  try {
    const dir = path.dirname(modelPath);
    return fs
      .readdirSync(dir)
      .filter((f) => /^ggml-.*\.bin$/.test(f))
      .map((f) => path.join(dir, f))
      .sort();
  } catch {
    return [];
  }
}

async function chooseWhisperModel(ask, currentModel) {
  const localModels = currentModel ? listModelsInSameDir(currentModel) : [];
  const downloadable = runtimeAvailableForThisMachine()
    ? MODELS.filter((m) => !localModels.some((p) => path.basename(p) === `ggml-${m.name}.bin`))
    : [];

  const entries = [
    ...localModels.map((p) => ({
      kind: "path",
      value: p,
      label: `${path.basename(p)}${p === currentModel ? " (current)" : ""}`,
    })),
    ...downloadable.map((m) => ({ kind: "download", value: m.name, label: `download: ${m.label}` })),
  ];

  if (entries.length === 0) {
    const answer = await ask(`Path to model (.bin)${currentModel ? ` [${currentModel}]` : ""}: `);
    return answer || currentModel;
  }

  console.log("\nWhisper model:");
  entries.forEach((e, i) => console.log(`  ${i + 1}. ${e.label}`));
  const pathChoiceNum = entries.length + 1;
  console.log(`  ${pathChoiceNum}. Enter a custom path`);

  const hint = currentModel ? "Enter to keep current" : "Enter for small";
  const choice = await ask(`Pick [1-${pathChoiceNum}] (${hint}): `);

  if (!choice) {
    if (currentModel) {
      return currentModel;
    }
    const small = entries.find((e) => e.kind === "download" && e.value === "small");
    return small ? ensureWhisperModel("small") : currentModel;
  }

  const idx = parseInt(choice, 10);
  if (idx === pathChoiceNum) {
    const answer = await ask("Path to model (.bin): ");
    return answer || currentModel;
  }

  const picked = entries[idx - 1];
  if (!picked) {
    return currentModel;
  }
  return picked.kind === "download" ? ensureWhisperModel(picked.value) : picked.value;
}

export async function getWhisperConfig() {
  const config = readConfigFile();
  if (config?.whisperBinary && config?.whisperModel) {
    return {
      binary: expandHome(config.whisperBinary),
      model: expandHome(config.whisperModel),
      language: config.language || "auto",
      prompt: config.prompt || "",
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  console.log("Whisper is not configured yet.");

  const binary = await chooseWhisperBinary(ask, config?.whisperBinary ? expandHome(config.whisperBinary) : null);
  const model = await chooseWhisperModel(ask, config?.whisperModel ? expandHome(config.whisperModel) : null);

  rl.close();

  if (!binary || !model) {
    return null;
  }

  writeConfigFile({ whisperBinary: binary, whisperModel: model });
  console.log(`\nSaved to ${CONFIG_PATH}\n`);
  return { binary: expandHome(binary), model: expandHome(model), language: "auto", prompt: "" };
}

function askRecordingDevice() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("Windows microphone device name not found.");
    console.log("Find it with: ffmpeg -f dshow -list_devices true -i dummy");
    console.log('Look under "DirectShow audio devices" and copy the name in quotes.');

    rl.question("Microphone device name: ", (device) => {
      rl.close();
      resolve(device.trim());
    });
  });
}

export async function getRecordingDevice() {
  if (process.platform !== "win32") {
    return null;
  }

  const config = readConfigFile();
  if (config?.recordingDevice) {
    return config.recordingDevice;
  }

  const device = await askRecordingDevice();
  if (!device) {
    return null;
  }

  writeConfigFile({ recordingDevice: device });
  console.log(`\nSaved to ${CONFIG_PATH}\n`);
  return device;
}

export async function reconfig() {
  const config = readConfigFile() ?? {};
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  console.log("Current sayclip settings. Press Enter to keep the current value.\n");

  const currentBinary = config.whisperBinary ? expandHome(config.whisperBinary) : null;
  const binary = await chooseWhisperBinary(ask, currentBinary);
  if (binary) {
    config.whisperBinary = binary;
  }

  const currentModel = config.whisperModel ? expandHome(config.whisperModel) : null;
  const model = await chooseWhisperModel(ask, currentModel);
  if (model) {
    config.whisperModel = model;
  }

  const currentLanguage = config.language || "auto";
  const languageAnswer = await ask(`\nRecognition language, e.g. "en", "ru", "auto" [${currentLanguage}]: `);
  if (languageAnswer) {
    config.language = languageAnswer;
  }

  const currentPrompt = config.prompt || "(none)";
  const promptAnswer = await ask(`Initial prompt for Whisper, biases vocabulary/style [${currentPrompt}]: `);
  if (promptAnswer) {
    config.prompt = promptAnswer;
  }

  const notifyEnabled = config.notifications !== false;
  const notifyAnswer = await ask(`\nEnable notifications after transcription? [${notifyEnabled ? "Y/n" : "y/N"}]: `);
  if (notifyAnswer) {
    config.notifications = /^y/i.test(notifyAnswer);
  }

  if (autostartSupported()) {
    const currentlyEnabled = await isAutostartEnabled();
    console.log(`\nAutostart on system login is currently: ${currentlyEnabled ? "enabled" : "disabled"}.`);
    const autostartAnswer = await ask("Type 'add' to enable, 'remove' to disable, or Enter to leave as is: ");
    const action = autostartAnswer.trim().toLowerCase();

    if (action === "add" || action === "a") {
      try {
        await enableAutostart();
        console.log("Autostart enabled.");
      } catch (err) {
        console.error(`Could not enable autostart: ${err.message}`);
      }
    } else if (action === "remove" || action === "r") {
      try {
        await disableAutostart();
        console.log("Autostart disabled.");
      } catch (err) {
        console.error(`Could not disable autostart: ${err.message}`);
      }
    }
  }

  if (process.platform === "win32") {
    const currentDevice = config.recordingDevice || "(not set)";
    console.log("\nFind it with: ffmpeg -f dshow -list_devices true -i dummy");
    const deviceAnswer = await ask(`Microphone device name [${currentDevice}]: `);
    if (deviceAnswer) {
      config.recordingDevice = deviceAnswer;
    }
  }

  rl.close();
  writeConfigFile(config);
  console.log(`\nSaved to ${CONFIG_PATH}\n`);
}
