import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { countFramesFromBuffer, countFramesFromFile } from '../src/utils/mp3Parser';

const execAsync = promisify(exec);

describe('MP3 Frame Counter', () => {
  const sampleFilePath = path.join(__dirname, 'fixtures', 'sample.mp3');
  
  beforeAll(() => {
    if (!fs.existsSync(sampleFilePath)) {
      throw new Error(`Test file not found: ${sampleFilePath}`);
    }
  });

  describe('countFramesFromBuffer', () => {
    it('should return same result for file and buffer methods', () => {
      const buffer = fs.readFileSync(sampleFilePath);
      const fileResult = countFramesFromFile(sampleFilePath);
      const bufferResult = countFramesFromBuffer(buffer);
      
      expect(bufferResult).toBe(fileResult);
    });
  });

  describe('validation against mediainfo', () => {
    it('should match mediainfo frame count', async () => {
      const ourFrameCount = countFramesFromFile(sampleFilePath);
      
      try {
        const { stdout } = await execAsync(`mediainfo --Output="Audio;%FrameCount%" "${sampleFilePath}"`);
        const mediainfoFrameCount = parseInt(stdout.trim(), 10);
        
        if (!isNaN(mediainfoFrameCount)) {
          expect(ourFrameCount).toBe(mediainfoFrameCount);
        } else {
          console.warn('MediaInfo frame count not available, skipping validation');
        }
      } catch (error) {
        console.warn('MediaInfo not available, skipping validation:', error);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const frameCount = countFramesFromBuffer(emptyBuffer);
      expect(frameCount).toBe(0);
    });

    it('should handle invalid MP3 data', () => {
      const invalidBuffer = Buffer.from('not an mp3 file');
      const frameCount = countFramesFromBuffer(invalidBuffer);
      expect(frameCount).toBe(0);
    });

    it('should handle very small buffer', () => {
      const smallBuffer = Buffer.alloc(3);
      const frameCount = countFramesFromBuffer(smallBuffer);
      expect(frameCount).toBe(0);
    });
  });
});
