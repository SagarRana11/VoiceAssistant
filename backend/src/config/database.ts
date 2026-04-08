import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
  });
}
