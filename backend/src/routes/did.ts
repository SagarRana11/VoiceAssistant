import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  createStream,
  sendSdp,
  sendIce,
  sendTalk,
  deleteStream,
} from '../controllers/didController';

const router = Router();

router.post('/',              protect, createStream);
router.post('/:id/sdp',      protect, sendSdp);
router.post('/:id/ice',      protect, sendIce);
router.post('/:id/talk',     protect, sendTalk);
router.delete('/:id',        protect, deleteStream);

export default router;
