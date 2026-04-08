/**
 * assessment.ts — Express router for Well-Being Assessment API
 *
 * POST /api/assessment/score-domain   — Score one domain (AI-powered)
 * POST /api/assessment/report         — Generate final report + save to DB
 * GET  /api/assessment/reports        — List user's assessment history
 * GET  /api/assessment/reports/:id    — Get a specific assessment
 */

import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  scoreDomain,
  generateReport,
  listReports,
  getReport,
} from '../controllers/assessmentApiController';

const router = Router();

// All assessment routes require authentication
router.use(protect);

router.post('/score-domain', scoreDomain);
router.post('/report',       generateReport);
router.get('/reports',       listReports);
router.get('/reports/:id',   getReport);

export default router;
