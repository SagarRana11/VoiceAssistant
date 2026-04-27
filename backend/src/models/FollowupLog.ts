import mongoose, { Document, Schema } from 'mongoose';

export interface IFollowupEntry {
  day: number;
  responses: Record<string, string>;
  aiSummary: string;
  completedAt: Date;
}

export interface IFollowupLog extends Document {
  patientId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  entries: IFollowupEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const FollowupLogSchema = new Schema<IFollowupLog>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'HospitalSession', required: true },
    entries: [
      {
        day:         { type: Number, required: true },
        responses:   { type: Map, of: String, default: {} },
        aiSummary:   { type: String, default: '' },
        completedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export const FollowupLog = mongoose.model<IFollowupLog>('FollowupLog', FollowupLogSchema);
