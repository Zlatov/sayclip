import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

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

function expandHome(rawPath) {
  if (rawPath === "~") {
    return os.homedir();
  }
  if (rawPath.startsWith("~/")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return rawPath;
}

function askWhisperPaths() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("Whisper.cpp paths not found.");

    rl.question("Path to whisper-cli binary: ", (binary) => {
      rl.question("Path to model (.bin): ", (model) => {
        rl.close();
        resolve({ binary: binary.trim(), model: model.trim() });
      });
    });
  });
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

  const { binary, model } = await askWhisperPaths();
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

function listModelsInSameDir(modelPath) {
  try {
    const dir = path.dirname(modelPath);
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".bin"))
      .map((f) => path.join(dir, f))
      .sort();
  } catch {
    return [];
  }
}

export async function reconfig() {
  const config = readConfigFile() ?? {};
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

  console.log("Current sayclip settings. Press Enter to keep the current value.\n");

  const currentBinary = config.whisperBinary ? expandHome(config.whisperBinary) : "(not set)";
  const binaryAnswer = await ask(`Path to whisper-cli binary [${currentBinary}]: `);
  if (binaryAnswer) {
    config.whisperBinary = binaryAnswer;
  }

  const currentModel = config.whisperModel ? expandHome(config.whisperModel) : null;
  const models = currentModel ? listModelsInSameDir(currentModel) : [];

  if (models.length > 0) {
    console.log(`\nModels found in ${path.dirname(currentModel)}:`);
    models.forEach((m, i) => {
      const marker = m === currentModel ? " (current)" : "";
      console.log(`  ${i + 1}. ${path.basename(m)}${marker}`);
    });
    const pick = await ask(`Pick a model [1-${models.length}], paste a path, or Enter to keep current: `);
    if (pick) {
      const idx = parseInt(pick, 10);
      config.whisperModel = !isNaN(idx) && models[idx - 1] ? models[idx - 1] : pick;
    }
  } else {
    const modelAnswer = await ask(`Path to model (.bin) [${currentModel ?? "(not set)"}]: `);
    if (modelAnswer) {
      config.whisperModel = modelAnswer;
    }
  }

  const currentLanguage = config.language || "auto";
  const languageAnswer = await ask(`Recognition language, e.g. "en", "ru", "auto" [${currentLanguage}]: `);
  if (languageAnswer) {
    config.language = languageAnswer;
  }

  const currentPrompt = config.prompt || "(none)";
  const promptAnswer = await ask(`Initial prompt for Whisper, biases vocabulary/style [${currentPrompt}]: `);
  if (promptAnswer) {
    config.prompt = promptAnswer;
  }

  if (process.platform === "win32") {
    const currentDevice = config.recordingDevice || "(not set)";
    console.log('\nFind it with: ffmpeg -f dshow -list_devices true -i dummy');
    const deviceAnswer = await ask(`Microphone device name [${currentDevice}]: `);
    if (deviceAnswer) {
      config.recordingDevice = deviceAnswer;
    }
  }

  rl.close();
  writeConfigFile(config);
  console.log(`\nSaved to ${CONFIG_PATH}\n`);
}
