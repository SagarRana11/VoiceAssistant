import mongoose, { Document, Schema } from 'mongoose';

export type SessionStage = 'enrolled' | 'consent' | 'procedure_done' | 'discharge' | 'followup';

export interface IHospitalSession extends Document {
  patientId: mongoose.Types.ObjectId;
  enrolledBy: mongoose.Types.ObjectId;
  stage: SessionStage;
  consentCompleted: boolean;
  dischargeCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSessionSchema = new Schema<IHospitalSession>(
  {
    patientId:          { type: Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
    enrolledBy:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stage:              { type: String, enum: ['enrolled', 'consent', 'procedure_done', 'discharge', 'followup'], default: 'enrolled' },
    consentCompleted:   { type: Boolean, default: false },
    dischargeCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const HospitalSession = mongoose.model<IHospitalSession>(
  'HospitalSession',
  HospitalSessionSchema,
);
