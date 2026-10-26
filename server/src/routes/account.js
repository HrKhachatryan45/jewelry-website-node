import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadPortrait } from '../middleware/upload.js';
import * as account from '../controllers/accountController.js';

const router = Router();

router.use(requireAuth);
router.get('/portrait', account.getPortrait);
router.get('/portrait/image', account.sendPortrait);
router.post('/portrait', uploadPortrait.single('portrait'), account.uploadPortraitImage);
router.delete('/portrait', account.deletePortrait);

export default router;
