import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadHero, uploadMenu } from '../middleware/upload.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

// Every admin route requires an authenticated admin (JWT cookie).
router.use(requireAdmin);

// Guard :id params so a non-numeric id returns 404 instead of hitting Prisma.
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Not found' });
  next();
});

// Dashboard
router.get('/dashboard', admin.dashboard);

// Hero
router.get('/hero', admin.heroList);
router.post('/hero/slides', uploadHero.single('image'), admin.heroSlideCreate);
router.put('/hero/slides/:id', uploadHero.single('image'), admin.heroSlideUpdate);
router.delete('/hero/slides/:id', admin.heroSlideDelete);
router.put('/hero/settings', admin.heroSettingsUpdate);

// Products
router.get('/products', admin.productsList);

const PRODUCT_UPLOAD_FIELDS = [
  { name: 'image', maxCount: 1 },
  { name: 'additional_images', maxCount: 10 },
  { name: 'try_on_asset', maxCount: 1 },
];

router.post('/products', uploadMenu.fields(PRODUCT_UPLOAD_FIELDS), admin.productCreate);
router.get('/products/:id', admin.productGet);
router.put('/products/:id', uploadMenu.fields(PRODUCT_UPLOAD_FIELDS), admin.productUpdate);
router.delete('/products/:id', admin.productDelete);

// Reviews
router.get('/reviews', admin.reviewsList);
router.post('/reviews', admin.reviewCreate);
router.post('/reviews/sync', admin.reviewsSync);
router.put('/reviews/:id', admin.reviewUpdate);
router.delete('/reviews/:id', admin.reviewDelete);

// Messages
router.get('/messages', admin.messagesList);
router.delete('/messages/:id', admin.messageDelete);

// Orders
router.get('/orders', admin.ordersList);
router.get('/orders/:id', admin.orderGet);
router.put('/orders/:id', admin.orderUpdate);
router.delete('/orders/:id', admin.orderDelete);

// Bespoke
router.get('/bespoke', admin.bespokeList);
router.get('/bespoke/:id', admin.bespokeGet);
router.put('/bespoke/:id', admin.bespokeUpdate);

// Users
router.get('/users', admin.usersList);
router.post('/users', [body('username').trim().notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 })], validate, admin.userCreate);
router.put('/users/:id', admin.userUpdate);
router.delete('/users/:id', admin.userDelete);

export default router;
