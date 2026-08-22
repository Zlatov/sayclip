import path from "node:path";
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

  // Downloaded runtime binaries carry a build-machine RUNPATH that won't
  // exist on the user's machine; LD_LIBRARY_PATH takes precedence over it.
  const env =
    process.platform === "win32"
      ? process.env
      : {
          ...process.env,
          LD_LIBRARY_PATH: [path.dirname(whisper.binary), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
        };

  await execFileAsync(whisper.binary, args, { timeout: 60_000, env });

  const txtPath = `${wavPath}.txt`;
  const text = await readFile(txtPath, "utf8");

  await unlink(txtPath).catch(() => {});

  return text.trim();
}
