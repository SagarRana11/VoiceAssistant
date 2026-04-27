import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  enrollPatient,
  getPatients,
  getSession,
  hospitalChat,
  consentStep,
  dischargeStep,
  followupCheck,
  getFollowupQuestions,
  completeConsent,
  markProcedureDone,
  hospitalChatSync,
} from '../controllers/hospitalController';

const router = Router();
router.use(protect);

router.post('/enroll',           enrollPatient);
router.get('/patients',          getPatients);
router.get('/session/:patientId', getSession);
router.post('/chat',             hospitalChat);
router.post('/chat/sync',        hospitalChatSync);
router.post('/consent',          consentStep);
router.post('/consent/complete', completeConsent);
router.post('/discharge',        dischargeStep);
router.post('/procedure/done',   markProcedureDone);
router.post('/followup',         followupCheck);
router.get('/followup/questions/:day', getFollowupQuestions);

export default router;
