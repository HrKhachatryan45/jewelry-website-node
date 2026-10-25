import { Router } from 'express';
import * as product from '../controllers/productController.js';

const router = Router();

router.get('/', product.list);
router.get('/:slug', product.detail);

export default router;
