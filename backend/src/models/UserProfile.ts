import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProfile extends Document {
  userId: mongoose.Types.ObjectId;
  height?: number;
  weight?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  fitnessGoal?: 'weight_loss' | 'muscle_gain' | 'endurance' | 'flexibility' | 'general_fitness';
  dietPreference?: 'omnivore' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'other';
  allergies?: string[];
  diseases?: string[];
  sleepHours?: number;
  stressLevel?: number;
  availableTimePerDay?: number;
  injuries?: string[];
  completeness?: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    height:              { type: Number, min: 50,  max: 300 },
    weight:              { type: Number, min: 20,  max: 500 },
    age:                 { type: Number, min: 1,   max: 120 },
    gender:              { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    activityLevel:       { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'] },
    fitnessGoal:         { type: String, enum: ['weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'general_fitness'] },
    dietPreference:      { type: String, enum: ['omnivore', 'vegetarian', 'vegan', 'keto', 'paleo', 'other'] },
    allergies:           [{ type: String, trim: true }],
    diseases:            [{ type: String, trim: true }],
    sleepHours:          { type: Number, min: 0, max: 24 },
    stressLevel:         { type: Number, min: 1, max: 5 },
    availableTimePerDay: { type: Number, min: 5, max: 480 },
    injuries:            [{ type: String, trim: true }],
    completeness:        { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

// Auto-calculate completeness before every save
UserProfileSchema.pre('save', function (next) {
  const coreFields = [
    'height', 'weight', 'age', 'gender', 'activityLevel',
    'fitnessGoal', 'dietPreference', 'sleepHours', 'stressLevel',
  ];
  const filled = coreFields.filter(f => {
    const val = (this as unknown as Record<string, unknown>)[f];
    return val != null && val !== '';
  }).length;
  this.completeness = Math.round((filled / coreFields.length) * 100);
  next();
});

export default mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
