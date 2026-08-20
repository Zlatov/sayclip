
```bash
# commit/push <что изменилось>
npm version patch -m "Release v%s: <что изменилось>"
git push
npm publish --otp=<код>

npm install -g sayclip@latest

node bin/sayclip.js transcribe /tmp/debash-voice-1787228081126.wav
node bin/sayclip.js listen
```
