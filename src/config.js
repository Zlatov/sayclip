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
    return { binary: expandHome(config.whisperBinary), model: expandHome(config.whisperModel) };
  }

  const { binary, model } = await askWhisperPaths();
  if (!binary || !model) {
    return null;
  }

  writeConfigFile({ whisperBinary: binary, whisperModel: model });
  console.log(`\nSaved to ${CONFIG_PATH}\n`);
  return { binary: expandHome(binary), model: expandHome(model) };
}
