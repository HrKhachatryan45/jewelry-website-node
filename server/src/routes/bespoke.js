import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { uploadBespoke } from '../middleware/upload.js';
import * as bespoke from '../controllers/bespokeController.js';

const router = Router();

router.post(
  '/',
  uploadBespoke.array('sketch', 3),
  [
    body('full_name').trim().notEmpty().withMessage('Անուն Ազգանունը պարտադիր է'),
    body('email').isEmail().withMessage('Անվավեր էլ. փոստ'),
    body('phone').trim().notEmpty().withMessage('Հեռախոսահամարը պարտադիր է'),
    body('description').trim().notEmpty().withMessage('Նկարագրությունը պարտադիր է'),
  ],
  validate,
  bespoke.create
);

export default router;
