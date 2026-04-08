import { Router } from 'express';
import { synthesizeSpeech } from '../controllers/ttsController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, synthesizeSpeech);

export default router;
