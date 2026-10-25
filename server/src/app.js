import 'express-async-errors'; // must precede express/routes: catches async handler rejections (Express 4)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import seoRoutes from './routes/seo.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_ROOT } from './middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(__dirname, '../../client');

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true })); // Idram POSTs form-encoded
  app.use(cookieParser());

  // SEO (before static so it isn't shadowed by client files)
  app.use('/', seoRoutes);

  // Uploaded media (menu/, hero/, bespoke/) — replaces Django MEDIA_ROOT
  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d' }));

  // REST API
  app.use('/api', apiRoutes);

  // Static client (vanilla HTML/CSS/JS) — replaces Django templates.
  // `extensions` serves /about -> about.html, /cart -> cart.html, etc.
  app.use(express.static(CLIENT_DIR, { extensions: ['html'] }));

  // Extensionless aliases for client subfolders and Django-style order paths.
  app.get('/product/:slug', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'product.html')));
  app.get(['/idram-payment', '/payment/idram-payment'], (_req, res) =>
    res.sendFile(path.join(CLIENT_DIR, 'idram-payment.html')),
  );
  app.get(['/idram-success', '/payment/idram-success'], (_req, res) =>
    res.sendFile(path.join(CLIENT_DIR, 'idram-success.html')),
  );
  app.get(['/idram-fail', '/payment/idram-fail'], (_req, res) =>
    res.sendFile(path.join(CLIENT_DIR, 'idram-fail.html')),
  );
  app.get(['/card-success', '/payment/card-success'], (_req, res) =>
    res.sendFile(path.join(CLIENT_DIR, 'card-success.html')),
  );
  app.get(['/card-fail', '/payment/card-fail'], (_req, res) =>
    res.sendFile(path.join(CLIENT_DIR, 'card-fail.html')),
  );
  app.get('/admin', (_req, res) => res.redirect(301, '/admin/'));
  // SPA-style fallback: HTML 404 for the site, JSON 404 (notFound) for the API.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.status(404).sendFile(path.join(CLIENT_DIR, '404.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
