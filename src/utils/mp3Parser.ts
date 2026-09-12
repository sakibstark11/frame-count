import * as fs from 'fs'
import { Logger } from 'pino'
import { logger } from './logger'

const FRAME_HEADER_BYTES = 4
const SIDE_INFO_BYTES = 32
const VBR_SIGNATURE_BYTES = 4
const XING_SIGNATURE_OFFSET = FRAME_HEADER_BYTES + SIDE_INFO_BYTES
const VBRI_SIGNATURE_OFFSET = XING_SIGNATURE_OFFSET + VBR_SIGNATURE_BYTES
const FIRST_FRAME_LOOKAHEAD_BYTES = VBRI_SIGNATURE_OFFSET + VBR_SIGNATURE_BYTES
const ID3V2_HEADER_BYTES = 10
const EMPTY_BUFFER = Buffer.alloc(0)

interface FrameHeader {
  frameSize: number
}

// Bitrate index table for MPEG1-Layer3 (kbps)
const BITRATES: (number | null)[] = [null, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, null]

// Sample rate table for MPEG1
const SAMPLE_RATES: (number | null)[] = [44100, 48000, 32000, null]

// Detect ID3v2 tag and skip it
function skipID3v2(buf: Buffer): number {
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0

  const size = (buf[6] & 0x7f) * 0x200000 + (buf[7] & 0x7f) * 0x4000 + (buf[8] & 0x7f) * 0x80 + (buf[9] & 0x7f)

  return 10 + size
}

function parseFrameHeader(buf: Buffer, offset: number): FrameHeader | null {
  const b1 = buf[offset]
  const b2 = buf[offset + 1]
  const b3 = buf[offset + 2]

  // Frame sync (11 bits)
  if (b1 !== 0xff || (b2 & 0xe0) !== 0xe0) return null

  const versionID = (b2 >> 3) & 3 // MPEG version
  const layer = (b2 >> 1) & 3 // Layer
  if (versionID !== 3 || layer !== 1) return null // Only support MPEG1-L3

  const bitrateIndex = (b3 >> 4) & 0x0f
  const sampleRateIndex = (b3 >> 2) & 0x03
  const padding = (b3 >> 1) & 1

  const bitrate = BITRATES[bitrateIndex]
  const sampleRate = SAMPLE_RATES[sampleRateIndex]

  if (!bitrate || !sampleRate) return null

  const frameSize = Math.floor((144 * bitrate * 1000) / sampleRate) + padding

  return { frameSize }
}

// Detect Xing/Info VBR header frame
function isXingFrame(buf: Buffer, offset: number): boolean {
  const sigStart = offset + XING_SIGNATURE_OFFSET
  const sig = buf.toString('ascii', sigStart, sigStart + VBR_SIGNATURE_BYTES)
  return sig === 'Xing' || sig === 'Info'
}

// Detect VBRI frame
function isVBRIFrame(buf: Buffer, offset: number): boolean {
  const sigStart = offset + VBRI_SIGNATURE_OFFSET
  const sig = buf.toString('ascii', sigStart, sigStart + VBR_SIGNATURE_BYTES)
  return sig === 'VBRI'
}

export interface FrameCounter {
  push(chunk: Buffer): void
  finish(): number
}

export function createFrameCounter(log: Logger = logger): FrameCounter {
  let pending: Buffer = EMPTY_BUFFER
  let bytesToSkip = 0
  let frames = 0
  let awaitingFirstFrame = true
  let atStreamStart = true

  function bytesNeeded(isFinal: boolean): number {
    if (isFinal) return FRAME_HEADER_BYTES
    if (atStreamStart) return ID3V2_HEADER_BYTES
    if (awaitingFirstFrame) return FIRST_FRAME_LOOKAHEAD_BYTES
    return FRAME_HEADER_BYTES
  }

  function skipAhead(buf: Buffer, offset: number): number {
    const skipped = Math.min(bytesToSkip, buf.length - offset)
    bytesToSkip -= skipped
    if (bytesToSkip > 0) log.debug({ bytesToSkip }, 'Frame continues in next chunk')
    return offset + skipped
  }

  function readId3Header(buf: Buffer, offset: number): number {
    atStreamStart = false
    bytesToSkip = skipID3v2(buf.subarray(offset))
    log.debug({ id3v2Bytes: bytesToSkip }, 'Checked for ID3v2 tag')
    return offset
  }

  function readFrameHeader(buf: Buffer, offset: number): number {
    const header = parseFrameHeader(buf, offset)
    if (!header) {
      log.debug({ offset }, 'No frame sync, advancing one byte')
      return offset + 1
    }
    const isMetadataFrame = awaitingFirstFrame && (isXingFrame(buf, offset) || isVBRIFrame(buf, offset))
    awaitingFirstFrame = false
    if (isMetadataFrame) {
      log.debug({ frameSize: header.frameSize }, 'Skipping metadata frame')
    } else {
      frames += 1
    }
    bytesToSkip = header.frameSize
    return offset
  }

  function consume(chunk: Buffer, isFinal: boolean): void {
    log.debug({ chunkBytes: chunk.length, pendingBytes: pending.length, isFinal }, 'Consuming chunk')
    const buf = pending.length > 0 ? Buffer.concat([pending, chunk]) : chunk
    pending = EMPTY_BUFFER
    let offset = 0
    while (offset < buf.length) {
      if (bytesToSkip > 0) {
        offset = skipAhead(buf, offset)
        continue
      }
      if (buf.length - offset < bytesNeeded(isFinal)) {
        log.debug(
          { remaining: buf.length - offset },
          isFinal ? 'Ignoring trailing bytes' : 'Holding bytes for next chunk'
        )
        if (!isFinal) pending = buf.subarray(offset)
        return
      }
      offset = atStreamStart ? readId3Header(buf, offset) : readFrameHeader(buf, offset)
    }
  }

  return {
    push(chunk: Buffer): void {
      consume(chunk, false)
    },
    finish(): number {
      consume(EMPTY_BUFFER, true)
      log.debug({ frames }, 'Finished counting')
      return frames
    }
  }
}

export function countFramesFromFile(path: string): number {
  const buf = fs.readFileSync(path)
  return countFramesFromBuffer(buf)
}

export function countFramesFromBuffer(buf: Buffer): number {
  const counter = createFrameCounter()
  counter.push(buf)
  return counter.finish()
}
