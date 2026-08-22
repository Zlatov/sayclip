import fs from "node:fs";

function pngWidth(pngBuffer) {
  return pngBuffer.readUInt32BE(16);
}

// A .ico container wrapping raw PNG bytes (Vista+ supports PNG-in-ICO
// directly, no need for a BMP encoder). systray expects .ico on Windows,
// plain .png on Linux/macOS.
function pngToIcoBase64(pngBuffer) {
  const size = pngWidth(pngBuffer);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width (0 means 256)
  entry[1] = size >= 256 ? 0 : size; // height (0 means 256)
  entry[2] = 0; // color count
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(pngBuffer.length, 8); // size of image data
  entry.writeUInt32LE(header.length + entry.length, 12); // offset of image data

  return Buffer.concat([header, entry, pngBuffer]).toString("base64");
}

export function pngFileToBase64(pngPath) {
  return fs.readFileSync(pngPath).toString("base64");
}

export function pngFileToIcoBase64(pngPath) {
  return pngToIcoBase64(fs.readFileSync(pngPath));
}
