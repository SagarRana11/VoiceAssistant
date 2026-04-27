import mongoose, { Document, Schema } from 'mongoose';

export interface IConsentLog extends Document {
  patientId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  understood: boolean;
  questionsAsked: number;
  completedAt: Date;
  createdAt: Date;
}

const ConsentLogSchema = new Schema<IConsentLog>(
  {
    patientId:      { type: Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
    sessionId:      { type: Schema.Types.ObjectId, ref: 'HospitalSession', required: true },
    understood:     { type: Boolean, default: false },
    questionsAsked: { type: Number, default: 0 },
    completedAt:    { type: Date },
  },
  { timestamps: true },
);

export const ConsentLog = mongoose.model<IConsentLog>('ConsentLog', ConsentLogSchema);
