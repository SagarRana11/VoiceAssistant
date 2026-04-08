import mongoose, { Document, Model, Schema } from 'mongoose';

// ─── Embedded Message ────────────────────────────────────────────────────────
export interface IMessage {
  _id?: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─── Conversation ────────────────────────────────────────────────────────────
export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roleId: string;
  roleName: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roleId: {
      type: String,
      enum: ['therapist', 'health', 'career', 'fitness'],
      required: true,
    },
    roleName: {
      type: String,
      required: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast user conversation lookups
conversationSchema.index({ userId: 1, createdAt: -1 });

const Conversation: Model<IConversation> = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);

export default Conversation;
