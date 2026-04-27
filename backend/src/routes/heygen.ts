import { Router } from 'express';
import { protect } from '../middleware/auth';
import { getToken } from '../controllers/heygenController';

const router = Router();

// Single endpoint: returns a one-time session token for the frontend SDK
router.post('/token', protect, getToken);

export default router;
