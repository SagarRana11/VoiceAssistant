import mongoose, { Document, Schema } from 'mongoose';

export interface IHospitalPatient extends Document {
  enrolledBy: mongoose.Types.ObjectId;
  name: string;
  age: number;
  gender: string;
  preferredLanguage: string;
  diagnosis: string;
  plannedProcedure: string;
  doctorName: string;
  riskFactors: string;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalPatientSchema = new Schema<IHospitalPatient>(
  {
    enrolledBy:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:              { type: String, required: true },
    age:               { type: Number, required: true },
    gender:            { type: String, required: true },
    preferredLanguage: { type: String, default: 'English' },
    diagnosis:         { type: String, required: true },
    plannedProcedure:  { type: String, required: true },
    doctorName:        { type: String, default: '' },
    riskFactors:       { type: String, default: '' },
  },
  { timestamps: true },
);

export const HospitalPatient = mongoose.model<IHospitalPatient>(
  'HospitalPatient',
  HospitalPatientSchema,
);
