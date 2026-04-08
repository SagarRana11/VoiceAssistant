import UserProfile, { IUserProfile } from '../models/UserProfile';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: string): Promise<IUserProfile> {
  let profile = await UserProfile.findOne({ userId });
  if (!profile) {
    profile = new UserProfile({ userId });
    await profile.save();
  }
  return profile;
}

export async function updateProfileFields(
  userId: string,
  updates: Partial<Record<string, unknown>>
): Promise<IUserProfile> {
  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    { $set: updates },
    { upsert: true, new: true, runValidators: true }
  );
  // Re-save to trigger completeness pre-save hook
  await profile!.save();
  return profile!;
}

// ─── Context summary (injected into AI system prompts) ───────────────────────

export function summarizeProfileForContext(profile: IUserProfile | null): string {
  if (!profile) return '[User Health Profile: no data yet — profile is empty]';

  const parts: string[] = [];
  if (profile.age)           parts.push(`${profile.age}yo`);
  if (profile.gender)        parts.push(profile.gender);
  if (profile.height)        parts.push(`${profile.height}cm`);
  if (profile.weight)        parts.push(`${profile.weight}kg`);
  if (profile.activityLevel) parts.push(`activity: ${profile.activityLevel}`);
  if (profile.fitnessGoal)   parts.push(`goal: ${profile.fitnessGoal.replace(/_/g, ' ')}`);
  if (profile.dietPreference) parts.push(`diet: ${profile.dietPreference}`);
  if (profile.sleepHours)    parts.push(`sleep: ${profile.sleepHours}h/night`);
  if (profile.stressLevel)   parts.push(`stress: ${profile.stressLevel}/5`);
  if (profile.diseases?.length)  parts.push(`conditions: ${profile.diseases.join(', ')}`);
  if (profile.injuries?.length)  parts.push(`injuries: ${profile.injuries.join(', ')}`);
  if (profile.availableTimePerDay) parts.push(`available: ${profile.availableTimePerDay}min/day`);

  if (parts.length === 0) return '[User Health Profile: incomplete — no data saved yet]';

  return `[User Health Profile: ${parts.join(', ')} | ${profile.completeness ?? 0}% complete]`;
}

// ─── Missing field detection ──────────────────────────────────────────────────

export function getMissingFields(
  profile: IUserProfile | null,
  requiredFields: string[]
): string[] {
  if (!profile) return requiredFields;
  return requiredFields.filter(f => {
    const val = (profile as unknown as Record<string, unknown>)[f];
    if (val == null || val === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });
}
