import { Router } from 'express';
import express from 'express';
import { protect } from '../middleware/auth';
import { health, lipsync } from '../controllers/musetalkController';

const router = Router();

// Accept raw audio bytes on the lipsync route (bypasses the small global JSON limit).
const rawAudio = express.raw({
  type: ['audio/wav', 'audio/mpeg', 'application/octet-stream'],
  limit: '25mb',
});

router.get('/health', protect, health);
router.post('/lipsync', protect, rawAudio, lipsync);

export default router;
