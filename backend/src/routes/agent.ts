import { Router } from 'express';
import { protect } from '../middleware/auth';
import { handleAgentMessage } from '../agent/agentController';

const router = Router();
router.use(protect);

router.post('/message', handleAgentMessage);

export default router;
