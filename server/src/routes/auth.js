import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.post(
  '/register',
  [body('username').trim().isLength({ min: 3 }).withMessage('Մուտքանունը պետք է լինի առնվազն 3 նիշ'), body('email').isEmail().withMessage('Անվավեր էլ. փոստ'), body('password').isLength({ min: 6 }).withMessage('Գաղտնաբառը պետք է լինի առնվազն 6 նիշ')],
  validate,
  auth.register
);

router.post(
  '/login',
  loginLimiter,
  [body('username').trim().notEmpty().withMessage('Մուտքանունը պարտադիր է'), body('password').notEmpty().withMessage('Գաղտնաբառը պարտադիր է')],
  validate,
  auth.login
);

router.post('/logout', auth.logout);
router.get('/me', auth.me);
router.get('/admin-check', requireAdmin, (_req, res) => res.json({ ok: true }));

export default router;
