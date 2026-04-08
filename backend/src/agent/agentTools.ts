import { IUserProfile } from '../models/UserProfile';
import {
  getOrCreateProfile,
  updateProfileFields,
  getMissingFields,
  summarizeProfileForContext,
} from '../services/profileService';
import { retrieveExerciseDocs, retrieveDocsByProfile } from '../rag/retriever';

// ─── Re-export helpers consumed by agentController ───────────────────────────
export { getMissingFields, summarizeProfileForContext };

// ─── Tool: getUserProfile ─────────────────────────────────────────────────────
export async function toolGetUserProfile(userId: string): Promise<IUserProfile | null> {
  return getOrCreateProfile(userId);
}

// ─── Tool: saveProfileField ───────────────────────────────────────────────────
export async function toolSaveProfileField(
  userId: string,
  field: string,
  value: unknown
): Promise<IUserProfile> {
  return updateProfileFields(userId, { [field]: value });
}

// ─── Tool: retrieveExerciseDocs ───────────────────────────────────────────────
export async function toolRetrieveExerciseDocs(
  query: string,
  fitnessGoal?: string,
  activityLevel?: string,
  hasInjuries?: boolean
): Promise<string[]> {
  if (fitnessGoal || activityLevel) {
    return retrieveDocsByProfile(fitnessGoal, activityLevel, hasInjuries, 4);
  }
  return retrieveExerciseDocs(query, 3);
}
