import { Router } from 'express';
import { protect } from '../middleware/auth';
import { getProfile, updateProfile } from '../controllers/profileController';

const router = Router();
router.use(protect);

router.get('/',   getProfile);
router.patch('/', updateProfile);

export default router;
