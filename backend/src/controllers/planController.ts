/**
 * planController.ts
 * HTTP controllers for plan history endpoints (Exercise, Diet, Meditation)
 *
 * GET /api/plans/exercise          — List user's exercise plans
 * GET /api/plans/exercise/:id      — Get specific exercise plan
 * GET /api/plans/diet              — List user's diet plans
 * GET /api/plans/diet/:id          — Get specific diet plan
 * GET /api/plans/meditation        — List user's meditation plans
 * GET /api/plans/meditation/:id    — Get specific meditation plan
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import ExercisePlan from '../models/ExercisePlan';
import DietPlan from '../models/DietPlan';
import MeditationPlan from '../models/MeditationPlan';

// ─── Exercise Plans ──────────────────────────────────────────────────────────

export async function listExercisePlans(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const plans = await ExercisePlan
      .find({ userId })
      .select('_id planSummary durationWeeks generatedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, plans });
  } catch (err) { next(err); }
}

export async function getExercisePlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const plan = await ExercisePlan.findOne({ _id: req.params.id, userId }).lean();
    if (!plan) { res.status(404).json({ success: false, message: 'Plan not found' }); return; }

    res.json({ success: true, plan });
  } catch (err) { next(err); }
}

// ─── Diet Plans ──────────────────────────────────────────────────────────────

export async function listDietPlans(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const plans = await DietPlan
      .find({ userId })
      .select('_id planSummary calorieTarget bmi planDuration generatedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, plans });
  } catch (err) { next(err); }
}

export async function getDietPlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const plan = await DietPlan.findOne({ _id: req.params.id, userId }).lean();
    if (!plan) { res.status(404).json({ success: false, message: 'Plan not found' }); return; }

    res.json({ success: true, plan });
  } catch (err) { next(err); }
}

// ─── Meditation Plans ────────────────────────────────────────────────────────

export async function listMeditationPlans(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const plans = await MeditationPlan
      .find({ userId })
      .select('_id planSummary level sessionDuration planDuration generatedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, plans });
  } catch (err) { next(err); }
}

export async function getMeditationPlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const plan = await MeditationPlan.findOne({ _id: req.params.id, userId }).lean();
    if (!plan) { res.status(404).json({ success: false, message: 'Plan not found' }); return; }

    res.json({ success: true, plan });
  } catch (err) { next(err); }
}
