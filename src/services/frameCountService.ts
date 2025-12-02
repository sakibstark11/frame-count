import { countFramesFromBuffer } from '../utils/mp3Parser'

export function processMP3File(buffer: Buffer): number {
  return countFramesFromBuffer(buffer)
}
