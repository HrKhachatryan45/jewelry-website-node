import { Router } from 'express';
import { ensureCartId } from '../middleware/cart.js';
import * as order from '../controllers/orderController.js';

const router = Router();

router.use((req, res, next) => {
  ensureCartId(req, res);
  next();
});

router.post('/initiate/:orderId', order.initiatePayment);
router.post('/idram/result', order.idramResult);
router.get('/idram/success', order.idramSuccess);
router.get('/idram/fail', order.idramFail);
router.get('/arca/callback', order.cardSuccess);
router.get('/arca/fail', order.cardFail);

export default router;
