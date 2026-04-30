import mongoose, { Schema, Document } from 'mongoose';

export interface ICathLabPatient extends Document {
  enrolledBy: string;
  patientName: string;
  dob: string;
  mrn: string;
  procedureDate: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema(
  {
    enrolledBy: { type: String, required: true },
    patientName: { type: String, required: true, trim: true },
    dob: { type: String, default: '' },
    mrn: { type: String, default: '' },
    procedureDate: { type: String, default: '' },
  },
  { timestamps: true },
);

export const CathLabPatient = mongoose.model<ICathLabPatient>('CathLabPatient', schema);
