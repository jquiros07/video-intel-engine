import express from 'express';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import router from './routes/routes';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { logger } from './logger';
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.set('trust proxy', 1);

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.'
});

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(generalRateLimiter);
app.use('/api', router);

console.log('Starting API server...');

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
