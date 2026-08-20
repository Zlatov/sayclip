import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { getWhisperConfig } from "./config.js";

const execFileAsync = promisify(execFile);

export async function transcribe(wavPath) {
  const whisper = await getWhisperConfig();
  if (!whisper) {
    throw new Error("Whisper is not configured (missing binary/model path).");
  }

  const args = ["-m", whisper.model, "-f", wavPath, "-l", whisper.language, "-of", wavPath, "-otxt", "-nt"];
  if (whisper.prompt) {
    args.push("--prompt", whisper.prompt);
  }

  await execFileAsync(whisper.binary, args, { timeout: 60_000 });

  const txtPath = `${wavPath}.txt`;
  const text = await readFile(txtPath, "utf8");

  await unlink(txtPath).catch(() => {});

  return text.trim();
}
