import { Router } from 'express';
import { ensureCartId } from '../middleware/cart.js';
import * as cart from '../controllers/cartController.js';

const router = Router();

// Every cart route is scoped to the guest cart cookie.
router.use((req, res, next) => {
  ensureCartId(req, res);
  next();
});

router.get('/', cart.view);
router.post('/add/:pk', cart.add);
router.post('/update', cart.update);
router.post('/remove', cart.remove);
router.post('/clear', cart.clear);
router.post('/buy-now-clear', cart.buyNowClear);

export default router;
