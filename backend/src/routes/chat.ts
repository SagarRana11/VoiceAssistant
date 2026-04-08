import { Router } from 'express';
import {
  createConversation,
  getConversations,
  getConversation,
  deleteConversation,
  sendMessage,
} from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = Router();

// All chat routes require authentication
router.use(protect);

router.post('/conversations', createConversation);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

router.post('/message', sendMessage);

export default router;
