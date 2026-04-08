import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getOrCreateProfile, updateProfileFields } from '../services/profileService';

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const profile = await getOrCreateProfile(req.user!.id);
    res.json({ success: true, profile });
  } catch (err) {
    console.error('[profileController.getProfile]', err);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const updates = req.body as Record<string, unknown>;

    // Strip protected / non-profile fields
    const forbidden = ['userId', '_id', '__v', 'createdAt', 'updatedAt', 'completeness'];
    for (const key of forbidden) delete updates[key];

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No valid fields to update' });
      return;
    }

    const profile = await updateProfileFields(req.user!.id, updates);
    res.json({ success: true, profile });
  } catch (err) {
    console.error('[profileController.updateProfile]', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
}
