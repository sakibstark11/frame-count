import { Router, Request, Response } from 'express'
import multer from 'multer'
import * as fs from 'fs'
import { processMP3File } from '../services/frameCountService'
import { FILE_SIZE_MAX_LIMIT, TEMP_FILE_DIR } from '../utils/constants'

const router = Router()

const upload = multer({
  storage: multer.diskStorage({
    destination: TEMP_FILE_DIR,
    filename: (req, _file, cb) => {
      cb(null, String(req.id))
    }
  }),
  limits: {
    fileSize: FILE_SIZE_MAX_LIMIT
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3')) {
      cb(null, true)
    } else {
      cb(new Error('Only MP3 files are allowed'))
    }
  }
})

router.post('/file-upload', upload.single('file'), (req: Request, res: Response) => {
  const filePath = `${TEMP_FILE_DIR}/${req.id}`

  try {
    if (!req.file) {
      req.log.warn('File upload attempt with no file')
      return res.status(400).json({ error: 'No file uploaded' })
    }


    req.log.info({
      filename: req.file.originalname,
      fileSize: req.file.size,
      tempPath: filePath
    }, 'Processing MP3 file from disk')

    const frameCount = processMP3File(filePath)

    req.log.info({ frameCount }, 'MP3 processing completed')

    res.json({ frameCount })
  } catch (error) {
    req.log.error({ error }, 'Error processing MP3 file')
    res.status(500).json({ error: 'Failed to process MP3 file' })
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      req.log.debug({ tempPath: filePath }, 'Temporary file cleaned up')
    }
  }
})

export default router
