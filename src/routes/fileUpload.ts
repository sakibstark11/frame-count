import { Router, Request, Response } from 'express';
import multer from 'multer';
import { processMP3File } from '../services/frameCountService';
import { FILE_SIZE_MAX_LIMIT } from '../utils/constants';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_MAX_LIMIT
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed'));
    }
  },
});

router.post('/file-upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      req.log.warn('File upload attempt with no file');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const frameCount = processMP3File(req.file.buffer);
    res.json({ frameCount });
  } catch (error) {
    req.log.error({ error }, 'Error processing MP3 file');
    res.status(500).json({ error: 'Failed to process MP3 file' });
  }
});

export default router;
