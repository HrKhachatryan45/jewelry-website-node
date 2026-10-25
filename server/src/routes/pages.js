import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import env from '../config/env.js';
import { MATERIAL_LABELS, CATEGORY_LABELS, DELIVERY_LABELS, PAYMENT_LABELS } from '../services/serializers.js';
import * as page from '../controllers/pageController.js';

const router = Router();

router.get('/home', page.home);
router.get('/about', page.about);
router.get('/categories', page.categories);
router.get('/config', (_req, res) =>
  res.json({
    contact: env.contact,
    labels: { materials: MATERIAL_LABELS, categories: CATEGORY_LABELS, delivery: DELIVERY_LABELS, payments: PAYMENT_LABELS },
  })
);
router.post(
  '/contact',
  [body('name').trim().notEmpty().withMessage('Անունը պարտադիր է'), body('email').isEmail().withMessage('Անվավեր էլ. փոստ'), body('message').trim().notEmpty().withMessage('Հաղորդագրությունը պարտադիր է')],
  validate,
  page.contact
);
router.get('/policies/privacy', page.privacyPolicy);
router.get('/policies/return', page.returnPolicy);
router.get('/policies/terms', page.termsConditions);

export default router;
