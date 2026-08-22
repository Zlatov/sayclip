
```bash
# commit/push <что изменилось>
npm version patch -m "Release v%s: <что изменилось>"
git push
npm publish --otp=<код>

npm install -g sayclip@latest

node bin/sayclip.js transcribe /tmp/debash-voice-1787228081126.wav
node bin/sayclip.js listen

gh release create whisper-runtime-v1 \
    whisper-runtime-linux-avx2.tar.gz \
    whisper-runtime-win-avx2.zip \
    --title "whisper.cpp AVX2 runtime v1" \
    --notes "Minimal whisper.cpp AVX2 build for sayclip's auto-install. SHA-256 in checksums.txt."
```
