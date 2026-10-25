import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { ensureCartId } from '../middleware/cart.js';
import * as order from '../controllers/orderController.js';

const router = Router();

router.use((req, res, next) => {
  ensureCartId(req, res);
  next();
});

router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Not found' });
  next();
});

router.get('/checkout', order.checkoutContext);
router.post(
  '/checkout',
  [
    body('full_name').trim().notEmpty().withMessage('Անուն Ազգանունը պարտադիր է'),
    body('email').isEmail().withMessage('Անվավեր էլ. փոստ'),
    body('phone').trim().notEmpty().withMessage('Հեռախոսահամարը պարտադիր է'),
  ],
  validate,
  order.placeOrder
);
router.get('/orders/:id', order.orderStatus);

export default router;
