import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load server/.env regardless of process cwd (e.g. `npm --prefix server run dev`).
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
dotenv.config();

const bool = (v, d = false) => (v == null ? d : String(v).toLowerCase() === 'true');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '4000', 10),
  hostUrl: process.env.HOST_URL || 'http://localhost:4000',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:4000',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'luxe_token',
  cartCookieName: 'luxe_cart',

  contact: {
    phone: process.env.CONTACT_PHONE || '+374 10 123 456',
    email: process.env.CONTACT_EMAIL || 'info@example.com',
    city: process.env.CONTACT_CITY || 'Երևան, Հայաստան',
    address: process.env.CONTACT_ADDRESS || 'Ամիրյան փողոց',
    addressFull: process.env.CONTACT_ADDRESS_FULL || 'Մաշտոցի պողոտա, Երևան',
    founded: process.env.CONTACT_FOUNDED || '1924',
  },

  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_HOST_USER || '',
    password: process.env.EMAIL_HOST_PASSWORD || '',
    from: process.env.EMAIL_HOST_USER || 'no-reply@example.com',
    ownerEmails: (process.env.OWNER_HOST_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    systemEmail: process.env.SYSTEM_EMAIL || '',
  },

  idram: {
    merchantId: process.env.IDRAM_MERCHANT_ID || '',
    secretKey: process.env.IDRAM_SECRET_KEY || '',
    account: process.env.IDRAM_ACCOUNT || '110001099',
  },

  arca: {
    username: process.env.ARCA_USERNAME || '',
    password: process.env.ARCA_PASSWORD || '',
    returnUrl: process.env.ARCA_RETURN_URL || 'http://localhost:4000/api/payments/arca/callback',
    registerUrl: 'https://ipayproxy.idp.am/payment/rest/register.do',
    statusUrl: 'https://ipayproxy.idp.am/payment/rest/getOrderStatusExtended.do',
  },

  debug: bool(process.env.NODE_ENV !== 'production', true),
};

export default env;
