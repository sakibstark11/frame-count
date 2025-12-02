import express from 'express';
import pinoHttp from 'pino-http';
import fileUploadRoutes from './routes/fileUpload';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3000;

app.use(pinoHttp({ logger }));

app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.use(fileUploadRoutes);

app.get('/health', (req, res) => {
  req.log.info('Health check requested');
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
