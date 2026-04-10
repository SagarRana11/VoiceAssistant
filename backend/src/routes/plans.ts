/**
 * plans.ts — Express router for plan history API
 *
 * GET /api/plans/exercise          — List exercise plans
 * GET /api/plans/exercise/:id      — Get specific exercise plan
 * GET /api/plans/diet              — List diet plans
 * GET /api/plans/diet/:id          — Get specific diet plan
 * GET /api/plans/meditation        — List meditation plans
 * GET /api/plans/meditation/:id    — Get specific meditation plan
 */

import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  listExercisePlans,
  getExercisePlan,
  listDietPlans,
  getDietPlan,
  listMeditationPlans,
  getMeditationPlan,
} from '../controllers/planController';

const router = Router();

router.use(protect);

router.get('/exercise',      listExercisePlans);
router.get('/exercise/:id',  getExercisePlan);
router.get('/diet',          listDietPlans);
router.get('/diet/:id',      getDietPlan);
router.get('/meditation',        listMeditationPlans);
router.get('/meditation/:id',    getMeditationPlan);

export default router;
