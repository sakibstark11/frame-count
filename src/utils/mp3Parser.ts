import * as fs from 'fs';

interface FrameHeader {
  frameSize: number;
}

// Bitrate index table for MPEG1-Layer3 (kbps)
const BITRATES: (number | null)[] = [
  null, 32, 40, 48, 56, 64, 80, 96,
  112, 128, 160, 192, 224, 256, 320, null
];

// Sample rate table for MPEG1
const SAMPLE_RATES: (number | null)[] = [44100, 48000, 32000, null];

// Detect ID3v2 tag and skip it
function skipID3v2(buf: Buffer): number {
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33)
    return 0;

  const size =
    (buf[6] & 0x7F) * 0x200000 +
    (buf[7] & 0x7F) * 0x4000 +
    (buf[8] & 0x7F) * 0x80 +
    (buf[9] & 0x7F);

  return 10 + size;
}

// Parse MPEG frame header
function parseFrameHeader(buf: Buffer, offset: number): FrameHeader | null {
  const b1 = buf[offset];
  const b2 = buf[offset + 1];
  const b3 = buf[offset + 2];
  const b4 = buf[offset + 3];

  // Frame sync (11 bits)
  if (b1 !== 0xFF || (b2 & 0xE0) !== 0xE0) return null;

  const versionID = (b2 >> 3) & 3;   // MPEG version
  const layer = (b2 >> 1) & 3;       // Layer
  if (versionID !== 3 || layer !== 1) return null; // Only support MPEG1-L3

  const bitrateIndex = (b3 >> 4) & 0x0F;
  const sampleRateIndex = (b3 >> 2) & 0x03;
  const padding = (b3 >> 1) & 1;

  const bitrate = BITRATES[bitrateIndex];
  const sampleRate = SAMPLE_RATES[sampleRateIndex];

  if (!bitrate || !sampleRate) return null;

  const frameSize = Math.floor((144 * bitrate * 1000) / sampleRate) + padding;

  return { frameSize };
}

// Detect Xing/Info VBR header frame
function isXingFrame(buf: Buffer, offset: number): boolean {
  const xingOffset = 4 + 32; // Standard offset for MPEG1-L3
  const sig = buf.toString('ascii', offset + xingOffset, offset + xingOffset + 4);
  return sig === 'Xing' || sig === 'Info';
}

// Detect VBRI frame
function isVBRIFrame(buf: Buffer, offset: number): boolean {
  const vbriOffset = 4 + 32 + 4;
  const sig = buf.toString('ascii', offset + vbriOffset, offset + vbriOffset + 4);
  return sig === 'VBRI';
}

// Count MP3 audio frames from file path
export function countFramesFromFile(path: string): number {
  const buf = fs.readFileSync(path);
  return countFramesFromBuffer(buf);
}

// Count MP3 audio frames from buffer
export function countFramesFromBuffer(buf: Buffer): number {
  let offset = skipID3v2(buf);
  let frames = 0;
  let firstFrame = true;

  while (offset < buf.length - 4) {
    const header = parseFrameHeader(buf, offset);
    if (!header) {
      offset++;
      continue;
    }

    // Skip metadata frame (Xing / Info / VBRI)
    if (firstFrame && (isXingFrame(buf, offset) || isVBRIFrame(buf, offset))) {
      firstFrame = false;
      offset += header.frameSize;
      continue;
    }

    firstFrame = false;
    frames++;
    offset += header.frameSize;
  }

  return frames;
}