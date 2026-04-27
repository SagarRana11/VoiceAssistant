import mongoose, { Document, Schema } from 'mongoose';

export interface IDischargeLog extends Document {
  patientId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  completedSteps: number[];
  completedAt?: Date;
  createdAt: Date;
}

const DischargeLogSchema = new Schema<IDischargeLog>(
  {
    patientId:      { type: Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
    sessionId:      { type: Schema.Types.ObjectId, ref: 'HospitalSession', required: true },
    completedSteps: { type: [Number], default: [] },
    completedAt:    { type: Date },
  },
  { timestamps: true },
);

export const DischargeLog = mongoose.model<IDischargeLog>('DischargeLog', DischargeLogSchema);
