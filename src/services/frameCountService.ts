import { countFramesFromFile } from '../utils/mp3Parser'

export function processMP3File(filePath: string): number {
  return countFramesFromFile(filePath)
}
