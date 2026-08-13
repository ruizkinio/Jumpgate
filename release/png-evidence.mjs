import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ALLOWED_CHUNKS = new Set(["IHDR", "IDAT", "IEND"]);
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function fail(message) {
  throw new Error(message);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function validatePublicEvidencePng(bytes, maximumBytes = 20 * 1024 * 1024) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || bytes.length > maximumBytes) {
    fail("VobSub cue capture must be a bounded complete PNG file");
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    fail("VobSub cue capture must be a PNG file");
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let channels = 0;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;
  const compressed = [];

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail("VobSub cue capture has a truncated PNG chunk");
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) fail("VobSub cue capture has a truncated PNG chunk");
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) fail("VobSub cue capture has an invalid PNG chunk type");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== expectedCrc) {
      fail(`VobSub cue capture has an invalid ${type} checksum`);
    }
    if (!ALLOWED_CHUNKS.has(type)) fail(`VobSub cue capture must not contain ancillary or private PNG chunk ${type}`);

    if (!sawIhdr) {
      if (type !== "IHDR" || length !== 13) fail("VobSub cue capture must begin with IHDR");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      if (width < 320 || width > 7680 || height < 240 || height > 4320) {
        fail("VobSub cue capture dimensions are outside the public evidence bounds");
      }
      if (bitDepth !== 8 || colorType !== 2 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        fail("VobSub cue capture must be a non-interlaced 8-bit RGB PNG");
      }
      channels = 3;
      sawIhdr = true;
    } else if (type === "IHDR") {
      fail("VobSub cue capture must contain exactly one IHDR chunk");
    } else if (type === "IDAT") {
      if (sawIend) fail("VobSub cue capture contains image data after IEND");
      sawIdat = true;
      compressed.push(data);
    } else if (type === "IEND") {
      if (length !== 0 || !sawIdat || sawIend) fail("VobSub cue capture has an invalid IEND chunk");
      sawIend = true;
      offset = end;
      if (offset !== bytes.length) fail("VobSub cue capture has trailing bytes after IEND");
      break;
    }
    offset = end;
  }

  if (!sawIhdr || !sawIdat || !sawIend) fail("VobSub cue capture is missing required PNG chunks");
  const rowBytes = width * channels;
  const expectedLength = height * (rowBytes + 1);
  let pixels;
  try {
    pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: expectedLength });
  } catch {
    fail("VobSub cue capture contains invalid compressed image data");
  }
  if (pixels.length !== expectedLength) fail("VobSub cue capture has an invalid decoded image size");
  for (let row = 0; row < height; row += 1) {
    if (pixels[row * (rowBytes + 1)] > 4) fail("VobSub cue capture has an invalid PNG row filter");
  }
  return { width, height };
}
