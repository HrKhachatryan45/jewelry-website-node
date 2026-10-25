import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import * as review from '../controllers/reviewController.js';

const router = Router();

router.get('/', review.list);
router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Անունը պարտադիր է'), body('text').trim().notEmpty().withMessage('Կարծիքը պարտադիր է')],
  validate,
  review.create
);

export default router;
