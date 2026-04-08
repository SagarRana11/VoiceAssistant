import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMeditationStep {
  step: number;
  title: string;
  instruction: string;
  duration: string;
}

export interface IWeeklyMeditationDay {
  day: string;
  sessionType: string;
  duration: number;        // minutes
  isRestDay?: boolean;
  focus?: string;
}

export interface IMeditationPlan extends Document {
  userId: Types.ObjectId;
  level: 'beginner' | 'moderate' | 'advanced';
  planDuration: 'daily' | 'weekly' | 'monthly';
  weeklyStructure: IWeeklyMeditationDay[];
  sessionDuration: number;
  breathingExercises: string[];
  meditationType: string[];
  stepByStepGuide: IMeditationStep[];
  environmentTips: string[];
  progressionAdvice: string;
  calmingMusicSuggestion: string[];
  planSummary: string;
  profileSnapshot: Record<string, unknown>;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MeditationStepSchema = new Schema<IMeditationStep>({
  step:        { type: Number, required: true },
  title:       { type: String, required: true },
  instruction: { type: String, required: true },
  duration:    { type: String, required: true },
});

const WeeklyMeditationDaySchema = new Schema<IWeeklyMeditationDay>({
  day:         { type: String, required: true },
  sessionType: { type: String, required: true },
  duration:    { type: Number, required: true },
  isRestDay:   { type: Boolean, default: false },
  focus:       { type: String },
});

const MeditationPlanSchema = new Schema<IMeditationPlan>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    level:       { type: String, enum: ['beginner', 'moderate', 'advanced'], required: true },
    planDuration:{ type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    weeklyStructure:       { type: [WeeklyMeditationDaySchema], default: [] },
    sessionDuration:       { type: Number, required: true },
    breathingExercises:    { type: [String], default: [] },
    meditationType:        { type: [String], default: [] },
    stepByStepGuide:       { type: [MeditationStepSchema], default: [] },
    environmentTips:       { type: [String], default: [] },
    progressionAdvice:     { type: String, default: '' },
    calmingMusicSuggestion:{ type: [String], default: [] },
    planSummary:           { type: String, default: '' },
    profileSnapshot:       { type: Schema.Types.Mixed, default: {} },
    generatedAt:           { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MeditationPlanSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IMeditationPlan>('MeditationPlan', MeditationPlanSchema);
