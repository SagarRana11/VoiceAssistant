/**
 * WellBeingAssessment.ts
 * MongoDB model for persisting assessment results
 */

import mongoose, { Document, Schema } from 'mongoose';

// ─── Sub-document interfaces ─────────────────────────────────────────────────

interface IPhysicalResult {
  score: number;
  maxScore: number;
  category: string;
  keyFactors: string[];
  interpretation: string;
  suggestions: string[];
  rawScores: Record<string, number>;
}

interface IMentalResult {
  depressionScore: number;
  anxietyScore: number;
  categorySummary: { depression: string; anxiety: string };
  keySymptoms: string[];
  suggestions: string[];
  riskFlag: boolean;
  rawScores: Record<string, number>;
}

interface IEmotionalResult {
  positiveScore: number;
  negativeScore: number;
  totalScore: number;
  category: string;
  keyFactors: string[];
  interpretation: string;
  suggestions: string[];
  rawScores: Record<string, number>;
}

interface IFinalReport {
  overallCategory: string;
  overallSummary: string;
  strengthAreas: string[];
  concernAreas: string[];
  behaviouralSuggestions: string[];
  lifestyleRecommendations: string[];
  seekProfessionalHelp: string;
  generatedAt: string;
}

// ─── Document interface ──────────────────────────────────────────────────────

export interface IWellBeingAssessment extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId?: string;
  physicalResult: IPhysicalResult;
  mentalResult: IMentalResult;
  emotionalResult: IEmotionalResult;
  overallCategory: string;
  fullReport: IFinalReport;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const RawScoresSchema = new Schema<Record<string, number>>(
  {},
  { strict: false }
);

const PhysicalResultSchema = new Schema<IPhysicalResult>({
  score:          { type: Number, required: true },
  maxScore:       { type: Number, required: true },
  category:       { type: String, required: true },
  keyFactors:     [String],
  interpretation: { type: String },
  suggestions:    [String],
  rawScores:      { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const MentalResultSchema = new Schema<IMentalResult>({
  depressionScore: { type: Number, required: true },
  anxietyScore:    { type: Number, required: true },
  categorySummary: {
    depression: String,
    anxiety:    String,
  },
  keySymptoms: [String],
  suggestions: [String],
  riskFlag:    { type: Boolean, default: false },
  rawScores:   { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const EmotionalResultSchema = new Schema<IEmotionalResult>({
  positiveScore:  { type: Number, required: true },
  negativeScore:  { type: Number, required: true },
  totalScore:     { type: Number, required: true },
  category:       { type: String, required: true },
  keyFactors:     [String],
  interpretation: { type: String },
  suggestions:    [String],
  rawScores:      { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const FinalReportSchema = new Schema<IFinalReport>({
  overallCategory:           { type: String, required: true },
  overallSummary:            { type: String },
  strengthAreas:             [String],
  concernAreas:              [String],
  behaviouralSuggestions:    [String],
  lifestyleRecommendations:  [String],
  seekProfessionalHelp:      { type: String },
  generatedAt:               { type: String },
}, { _id: false });

const WellBeingAssessmentSchema = new Schema<IWellBeingAssessment>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId:       { type: String },
    physicalResult:  { type: PhysicalResultSchema,  required: true },
    mentalResult:    { type: MentalResultSchema,    required: true },
    emotionalResult: { type: EmotionalResultSchema, required: true },
    overallCategory: { type: String,                required: true },
    fullReport:      { type: FinalReportSchema,     required: true },
  },
  { timestamps: true }
);

// Index for user's assessment history
WellBeingAssessmentSchema.index({ userId: 1, createdAt: -1 });

export const WellBeingAssessment = mongoose.model<IWellBeingAssessment>(
  'WellBeingAssessment',
  WellBeingAssessmentSchema
);
