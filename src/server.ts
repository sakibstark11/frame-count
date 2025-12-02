import express from 'express'
import pinoHttp from 'pino-http'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import fileUploadRoutes from './routes/fileUpload'
import { logger } from './utils/logger'
import { requestTimingMiddleware } from './middleware/requestLogger'
import { TEMP_FILE_DIR } from './utils/constants'

const app = express()
const port = process.env.PORT ?? 3000

if (!fs.existsSync(TEMP_FILE_DIR)) {
  fs.mkdirSync(TEMP_FILE_DIR, { recursive: true })
  logger.info(`Created upload directory: ${TEMP_FILE_DIR}`)
}

app.use(pinoHttp({
  logger,
  genReqId: () => uuidv4(),
  autoLogging: false,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent']
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
}))

app.use(requestTimingMiddleware)

app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json')
  next()
})

app.use(fileUploadRoutes)

app.get('/health', (req, res) => {
  req.log.info('Health check requested')
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  logger.info(`Server running on port ${port}`)
})
