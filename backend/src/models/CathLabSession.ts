import mongoose, { Schema, Document } from 'mongoose';

export interface ICathLabSession extends Document {
  patientId: mongoose.Types.ObjectId;
  enrolledBy: string;
  currentModule: number;
  currentStep: string;
  status: 'in_progress' | 'completed';
  verbalConsentGiven: 'yes' | 'no' | 'deferred' | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema(
  {
    patientId:          { type: Schema.Types.ObjectId, ref: 'CathLabPatient', required: true },
    enrolledBy:         { type: String, required: true },
    currentModule:      { type: Number, default: 1 },
    currentStep:        { type: String, default: 'greeting' },
    status:             { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    verbalConsentGiven: { type: String, enum: ['yes', 'no', 'deferred', null], default: null },
  },
  { timestamps: true },
);

export const CathLabSession = mongoose.model<ICathLabSession>('CathLabSession', schema);
