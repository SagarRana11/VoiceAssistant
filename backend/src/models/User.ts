import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Interface ───────────────────────────────────────────────────────────────
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries by default
    },
  },
  {
    timestamps: true,
  }
);

// ─── Pre-save Hook: Hash password ─────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance Method: Compare password ───────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// ─── Model ───────────────────────────────────────────────────────────────────
const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
