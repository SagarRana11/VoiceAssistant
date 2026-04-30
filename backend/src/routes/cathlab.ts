import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  enrollCathLabPatient,
  getCathLabPatients,
  getCathLabSession,
  cathLabChat,
  getCathLabSummary,
} from '../controllers/cathLabController';

const router = Router();

router.use(protect);

router.post('/enroll',           enrollCathLabPatient);
router.get('/patients',          getCathLabPatients);
router.get('/session/:sessionId', getCathLabSession);
router.post('/chat',             cathLabChat);
router.get('/summary/:sessionId', getCathLabSummary);

export default router;
