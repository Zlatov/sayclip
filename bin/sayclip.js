#!/usr/bin/env node

import pc from "picocolors";
import { version, description } from "../src/pkg.js";

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
      "  sayclip              show this header",
      "  sayclip --version    show version",
      "  sayclip --help       show this help",
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

printHeader();
