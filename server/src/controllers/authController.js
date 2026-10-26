import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    passwordSetupRequired: false,
  };
}

export async function register(req, res) {
  const { username, email, password, firstName = '', lastName = '' } = req.body;
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (exists) {
    return res.status(409).json({ error: 'User with this username or email already exists' });
  }
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, password: hash, firstName, lastName, role: 'customer' },
  });
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user: publicUser(user), token });
}

export async function login(req, res) {
  const { username, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user), token });
}

export async function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ success: true });
}

export async function me(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    user: {
      ...publicUser(req.user),
      passwordSetupRequired: req.passwordSetupRequired === true,
    },
  });
}

export async function setPassword(req, res) {
  const { password, currentPassword } = req.body;
  if (!req.passwordSetupRequired) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, req.user.password))) {
      return res.status(400).json({ error: 'Enter your current password to change it.' });
    }
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hash },
  });
  setAuthCookie(res, signToken(user));
  res.json({ success: true, user: publicUser(user) });
}
