import mongoose, { Schema, Document } from 'mongoose';

export interface IExercise {
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  restTime?: string;
  notes?: string;
}

export interface IDailyWorkout {
  day: string;
  focus: string;
  isRestDay?: boolean;
  warmup?: string;
  exercises?: IExercise[];
  cooldown?: string;
  estimatedDuration?: number;
}

export interface IExercisePlan extends Document {
  userId: mongoose.Types.ObjectId;
  weeklySchedule: IDailyWorkout[];
  progressionAdvice: string;
  safetyNotes: string;
  planSummary: string;
  durationWeeks: number;
  profileSnapshot: Record<string, unknown>;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseSchema = new Schema<IExercise>(
  {
    name:     { type: String, required: true },
    sets:     { type: Number },
    reps:     { type: String },
    duration: { type: String },
    restTime: { type: String },
    notes:    { type: String },
  },
  { _id: false }
);

const DailyWorkoutSchema = new Schema<IDailyWorkout>(
  {
    day:               { type: String, required: true },
    focus:             { type: String, required: true },
    isRestDay:         { type: Boolean, default: false },
    warmup:            { type: String },
    exercises:         [ExerciseSchema],
    cooldown:          { type: String },
    estimatedDuration: { type: Number },
  },
  { _id: false }
);

const ExercisePlanSchema = new Schema<IExercisePlan>(
  {
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weeklySchedule:   [DailyWorkoutSchema],
    progressionAdvice: { type: String, default: '' },
    safetyNotes:      { type: String, default: '' },
    planSummary:      { type: String, default: '' },
    durationWeeks:    { type: Number, default: 4 },
    profileSnapshot:  { type: Schema.Types.Mixed, default: {} },
    generatedAt:      { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ExercisePlanSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IExercisePlan>('ExercisePlan', ExercisePlanSchema);
