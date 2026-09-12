import { Router, Request, Response } from 'express'
import busboy from 'busboy'
import { createFrameCounter, FrameCounter } from '../utils/mp3Parser'

const router = Router()

const MP3_CONTENT_TYPE = 'audio/mpeg'
const MULTIPART_CONTENT_TYPE = 'multipart/form-data'
const MP3_FILE_EXTENSION = '.mp3'

enum UploadRejection {
  NotMp3 = 'Only MP3 files are allowed',
  MalformedMultipart = 'Malformed multipart body',
  UnsupportedContentType = `Expected Content-Type ${MULTIPART_CONTENT_TYPE} or ${MP3_CONTENT_TYPE}`
}

type OnUploadDone = (rejection?: UploadRejection) => void

function isMp3File(info: busboy.FileInfo): boolean {
  return info.mimeType === MP3_CONTENT_TYPE || info.filename.endsWith(MP3_FILE_EXTENSION)
}

function countRawBody(req: Request, counter: FrameCounter, done: OnUploadDone): void {
  req.on('data', counter.push)
  req.on('end', done)
}

function countMultipartFiles(req: Request, counter: FrameCounter, done: OnUploadDone): void {
  const parser = busboy({ headers: req.headers })
  let rejection: UploadRejection | undefined
  parser.on('file', (_field, stream, info) => {
    if (!isMp3File(info)) {
      rejection = UploadRejection.NotMp3
      stream.resume()
      return
    }
    stream.on('data', counter.push)
  })
  parser.on('error', () => done(UploadRejection.MalformedMultipart))
  parser.on('close', () => done(rejection))
  req.pipe(parser)
}

router.post('/file-upload', (req: Request, res: Response) => {
  const counter = createFrameCounter(req.log)

  const respond: OnUploadDone = (rejection) => {
    if (res.headersSent) return
    if (rejection) {
      req.log.warn({ rejection }, 'File upload rejected')
      res.status(400).json({ error: rejection })
      return
    }
    const frameCount = counter.finish()
    req.log.info({ frameCount }, 'MP3 processing completed')
    res.json({ frameCount })
  }

  if (req.is(MULTIPART_CONTENT_TYPE)) {
    countMultipartFiles(req, counter, respond)
    return
  }
  if (req.is(MP3_CONTENT_TYPE)) {
    countRawBody(req, counter, respond)
    return
  }
  respond(UploadRejection.UnsupportedContentType)
})

export default router
