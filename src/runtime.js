import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const SAYCLIP_DIR = path.join(os.homedir(), ".sayclip");
const RUNTIME_DIR = path.join(SAYCLIP_DIR, "runtime");
const MODELS_DIR = path.join(SAYCLIP_DIR, "models");

const RELEASE_BASE = "https://github.com/Zlatov/sayclip/releases/download/whisper-runtime-v1";

const RUNTIME_ASSETS = {
  linux: {
    url: `${RELEASE_BASE}/whisper-runtime-linux-avx2.tar.gz`,
    sha256: "63fbdc631ff03ca2703ca8cee1280c14b108c456aa58300f517471f6321fa9ad",
    binary: "whisper-cli",
  },
  win32: {
    url: `${RELEASE_BASE}/whisper-runtime-win-avx2.zip`,
    sha256: "3375517d89aff9a86d4a52f7c1c4e0b4af1fd0669484db841b8e9aa05229d31e",
    binary: "whisper-cli.exe",
  },
};

export const MODELS = [
  { name: "tiny", label: "tiny — fastest, least accurate (~75 MB)" },
  { name: "base", label: "base — fast, low accuracy (~142 MB)" },
  { name: "small", label: "small — recommended balance (~466 MB)" },
  { name: "medium", label: "medium — slow, most accurate (~1.5 GB)" },
];

export function runtimeAvailableForThisMachine() {
  return Boolean(RUNTIME_ASSETS[process.platform]) && process.arch === "x64";
}

async function downloadFile(url, destPath, onProgress) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const total = Number(res.headers.get("content-length")) || 0;
  let received = 0;

  const source = Readable.fromWeb(res.body);
  if (onProgress) {
    source.on("data", (chunk) => {
      received += chunk.length;
      onProgress(received, total);
    });
  }

  await pipeline(source, fs.createWriteStream(destPath));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function extractArchive(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    const child = spawn("tar", ["-xf", archivePath, "-C", destDir]);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with code ${code}`));
    });
  });
}

function progressLine(label) {
  let lastPrint = 0;
  return (received, total) => {
    const now = Date.now();
    if (now - lastPrint < 200 && received !== total) {
      return;
    }
    lastPrint = now;
    if (total > 0) {
      const pct = Math.floor((received / total) * 100);
      process.stdout.write(`\r${label}: ${pct}% (${(received / 1e6).toFixed(1)} MB)   `);
    } else {
      process.stdout.write(`\r${label}: ${(received / 1e6).toFixed(1)} MB   `);
    }
  };
}

export async function ensureWhisperRuntime() {
  const asset = RUNTIME_ASSETS[process.platform];
  if (!asset || process.arch !== "x64") {
    throw new Error(`No prebuilt whisper runtime available for ${process.platform}/${process.arch}.`);
  }

  const binaryPath = path.join(RUNTIME_DIR, asset.binary);
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  fs.mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
  const archivePath = path.join(os.tmpdir(), path.basename(asset.url));

  await downloadFile(asset.url, archivePath, progressLine("Downloading whisper runtime"));
  process.stdout.write("\n");

  const actualSha = sha256File(archivePath);
  if (actualSha !== asset.sha256) {
    fs.rmSync(archivePath, { force: true });
    throw new Error(`Checksum mismatch for whisper runtime (expected ${asset.sha256}, got ${actualSha}).`);
  }

  console.log("Extracting...");
  await extractArchive(archivePath, RUNTIME_DIR);
  fs.rmSync(archivePath, { force: true });

  if (process.platform !== "win32") {
    fs.chmodSync(binaryPath, 0o755);
  }

  if (!fs.existsSync(binaryPath)) {
    throw new Error("Runtime extracted but the expected binary was not found.");
  }

  return binaryPath;
}

export async function ensureWhisperModel(name) {
  const known = MODELS.find((m) => m.name === name);
  if (!known) {
    throw new Error(`Unknown model "${name}". Choose one of: ${MODELS.map((m) => m.name).join(", ")}.`);
  }

  const modelPath = path.join(MODELS_DIR, `ggml-${name}.bin`);
  if (fs.existsSync(modelPath)) {
    return modelPath;
  }

  fs.mkdirSync(MODELS_DIR, { recursive: true, mode: 0o700 });
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`;
  const tmpPath = `${modelPath}.part`;

  await downloadFile(url, tmpPath, progressLine(`Downloading ${name} model`));
  process.stdout.write("\n");

  fs.renameSync(tmpPath, modelPath);
  return modelPath;
}
