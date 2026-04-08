import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface IDietPlan extends Document {
  userId: Types.ObjectId;
  planDuration: 'daily' | 'weekly' | 'monthly';
  calorieTarget: number;
  bmi: number;
  macroSplit: IMacroSplit;
  mealStructure: string;
  breakfastOptions: string[];
  lunchOptions: string[];
  dinnerOptions: string[];
  snackOptions: string[];
  hydrationAdvice: string;
  restrictionNotes: string[];
  substitutionSuggestions: string[];
  planSummary: string;
  profileSnapshot: Record<string, unknown>;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MacroSplitSchema = new Schema<IMacroSplit>({
  proteinG:   { type: Number, required: true },
  carbsG:     { type: Number, required: true },
  fatG:       { type: Number, required: true },
  proteinPct: { type: Number, required: true },
  carbsPct:   { type: Number, required: true },
  fatPct:     { type: Number, required: true },
});

const DietPlanSchema = new Schema<IDietPlan>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planDuration: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    calorieTarget:         { type: Number, required: true },
    bmi:                   { type: Number, required: true },
    macroSplit:            { type: MacroSplitSchema, required: true },
    mealStructure:         { type: String, default: '' },
    breakfastOptions:      { type: [String], default: [] },
    lunchOptions:          { type: [String], default: [] },
    dinnerOptions:         { type: [String], default: [] },
    snackOptions:          { type: [String], default: [] },
    hydrationAdvice:       { type: String, default: '' },
    restrictionNotes:      { type: [String], default: [] },
    substitutionSuggestions: { type: [String], default: [] },
    planSummary:           { type: String, default: '' },
    profileSnapshot:       { type: Schema.Types.Mixed, default: {} },
    generatedAt:           { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DietPlanSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IDietPlan>('DietPlan', DietPlanSchema);
