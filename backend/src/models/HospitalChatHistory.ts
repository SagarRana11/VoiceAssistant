import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IHospitalChatHistory extends Document {
  patientId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const HospitalChatHistorySchema = new Schema<IHospitalChatHistory>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'HospitalPatient', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'HospitalSession', required: true },
    messages: [
      {
        role:      { type: String, enum: ['user', 'assistant'], required: true },
        content:   { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export const HospitalChatHistory = mongoose.model<IHospitalChatHistory>(
  'HospitalChatHistory',
  HospitalChatHistorySchema,
);
