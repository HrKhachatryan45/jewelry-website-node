import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/prisma.js';

export function signToken(user, { passwordSetupRequired = false } = {}) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, passwordSetupRequired },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, { httpOnly: true, sameSite: 'lax', secure: env.isProd });
}

// Attaches req.user if a valid token is present; never blocks.
export async function optionalAuth(req, _res, next) {
  const token = req.cookies?.[env.cookieName];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.isActive) {
      req.user = user;
      req.passwordSetupRequired = payload.passwordSetupRequired === true;
    }
  } catch {
    /* ignore invalid token */
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
