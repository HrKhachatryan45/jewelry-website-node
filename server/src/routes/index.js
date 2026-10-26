import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { ensureCartId } from '../middleware/cart.js';
import authRoutes from './auth.js';
import pageRoutes from './pages.js';
import productRoutes from './products.js';
import reviewRoutes from './reviews.js';
import cartRoutes from './cart.js';
import orderRoutes from './orders.js';
import accountRoutes from './account.js';
import paymentRoutes from './payments.js';
import bespokeRoutes from './bespoke.js';
import adminRoutes from './admin.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

router.use(optionalAuth);

// Wishlist (new feature)
router.get('/wishlist', ensureCartId, admin.wishlistList);
router.post('/wishlist/toggle', ensureCartId, admin.wishlistToggle);

router.use('/auth', authRoutes);
router.use('/', pageRoutes);
router.use('/products', productRoutes);
router.use('/reviews', reviewRoutes);
router.use('/cart', cartRoutes);
router.use('/account', accountRoutes);
router.use('/', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/bespoke', bespokeRoutes);
router.use('/admin', adminRoutes);

export default router;
