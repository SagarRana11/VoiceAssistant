import mongoose, { Document, Schema } from 'mongoose';

export interface IKnowledgeEmbedding extends Document {
  docId: string;
  domain: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  embedding: number[];
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeEmbeddingSchema = new Schema<IKnowledgeEmbedding>(
  {
    docId: { type: String, required: true },
    domain: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    embedding: { type: [Number], required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: true },
);

// Unique per doc within a domain
KnowledgeEmbeddingSchema.index({ docId: 1, domain: 1 }, { unique: true });

export const KnowledgeEmbedding = mongoose.model<IKnowledgeEmbedding>(
  'KnowledgeEmbedding',
  KnowledgeEmbeddingSchema,
);
