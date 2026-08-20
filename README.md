# sayclip

> Push-to-talk: local speech transcription straight to your clipboard.

## About

Hold a hotkey, say something, release it — the text lands in your
clipboard a moment later. No cloud, no API keys: transcription runs
fully locally via [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

- Genuine push-to-talk — recording starts on key-down and stops on
  key-up, not a toggle
- Fully local transcription, nothing leaves your machine
- Runs in the foreground or as a background daemon
- Switchable model/language/prompt, no config file editing required

```
[hold Right Ctrl] "remind me to deploy the staging branch after lunch"
                                    ↓
                    copied to clipboard, paste anywhere
```

## System requirements

- Node.js ≥ 18
- Linux with an X11 session (Wayland/macOS/Windows are not supported yet)
- a microphone
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) built locally,
  see [Dependencies](#dependencies) below

## Installation

```bash
npm install -g sayclip
```

Verify:

```bash
sayclip --version
sayclip --help
```

## Configuration

Settings (whisper binary/model path, recognition language, initial
prompt) live in `~/.sayclip/config.json`. On first use, `sayclip` asks
for the whisper binary/model paths and saves them.

Change any setting later:

```bash
sayclip reconfig
```

## Usage

```bash
sayclip
```

| Command | What it does |
|---|---|
| `sayclip` | run in the foreground, hold Right Ctrl to record |
| `sayclip start` | run the same thing in the background |
| `sayclip stop` | stop the background instance |
| `sayclip transcribe <file.wav>` | transcribe a `.wav` file and print the text |
| `sayclip reconfig` | change whisper binary/model/language/prompt |
| `sayclip --version` / `-v` | show version |
| `sayclip --help` / `-h` | show help |

The hotkey is fixed to **Right Ctrl** for now (hold to record, release
to stop) — no rebinding option yet.

### Autostart on login (optional)

A systemd `--user` unit template ships with the package under
`contrib/systemd/sayclip.service` (also on GitHub). It includes
install instructions and a note about global npm installs managed via
nvm not being visible to non-interactive launchers like systemd.

## Dependencies

- `arecord` (package `alsa-utils`) — microphone recording. Check:
  `which arecord`
- `xclip` (or `xsel` / `wl-copy`) — clipboard access. Check:
  `which xclip`
- `notify-send` (package `libnotify-bin`) — result notifications.
  Check: `which notify-send`
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) — local
  transcription engine

On Ubuntu the first three are usually already installed. The global
hotkey listener (`uiohook-napi`) ships with prebuilt native binaries —
no extra system package needed for it.

whisper.cpp is built separately:

```bash
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build -j --config Release
sh ./models/download-ggml-model.sh small   # or base/medium/large-v3-turbo
```

Bigger models are more accurate but noticeably slower — `small` is
usually a good default. `sayclip reconfig` lists every `.bin` file
found next to the currently configured model, so switching later is a
menu pick, not a path to retype.

## License

MIT
