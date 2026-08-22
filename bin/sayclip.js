#!/usr/bin/env node

import pc from "picocolors";
import { version, description } from "../src/pkg.js";
import { transcribe } from "../src/transcribe.js";
import { startListening } from "../src/listen.js";
import { startDaemon, stopDaemon, restartDaemon, getRunningPid, registerCurrentProcess } from "../src/daemon.js";
import { reconfig } from "../src/config.js";

const cliArgs = process.argv.slice(2);

if (cliArgs.includes("--version") || cliArgs.includes("-v")) {
  console.log(version);
  process.exit(0);
}

if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
  console.log(
    [
      `sayclip ${version} — ${description}`,
      "",
      "Usage:",
      "  sayclip                    run in foreground, hold Right Ctrl to record",
      "  sayclip start              run in the background",
      "  sayclip stop               stop the background instance",
      "  sayclip restart            restart the background instance",
      "  sayclip transcribe <file>  transcribe a .wav file and print the text",
      "  sayclip reconfig           change whisper binary/model/language/prompt",
      "  sayclip --version          show version",
      "  sayclip --help             show this help",
    ].join("\n"),
  );
  process.exit(0);
}

function printHeader() {
  const line = pc.dim("─".repeat(40));
  console.log(line);
  console.log();
  console.log(`sayclip v${version}`);
  console.log();
  console.log(line);
}

if (cliArgs[0] === "start") {
  startDaemon();
} else if (cliArgs[0] === "stop") {
  stopDaemon();
} else if (cliArgs[0] === "restart") {
  await restartDaemon();
} else if (cliArgs[0] === "reconfig" || cliArgs.includes("--reconfig")) {
  await reconfig();
  process.exit(0);
} else if (cliArgs[0] === "transcribe") {
  const wavPath = cliArgs[1];
  if (!wavPath) {
    console.error("Usage: sayclip transcribe <file.wav>");
    process.exit(1);
  }

  try {
    const text = await transcribe(wavPath);
    console.log(text);
  } catch (err) {
    console.error(`Transcription failed: ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
} else {
  const existing = getRunningPid();
  if (existing) {
    console.log(`Already running in the background (pid ${existing}). Run "sayclip stop" first.`);
    process.exit(1);
  }

  registerCurrentProcess();
  printHeader();
  startListening();
}
