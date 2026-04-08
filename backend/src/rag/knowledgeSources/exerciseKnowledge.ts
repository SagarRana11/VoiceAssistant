export interface KnowledgeDoc {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
}

export const EXERCISE_KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: 'ex_beginner_001',
    category: 'beginner',
    title: 'Beginner Full-Body Workout Principles',
    content: `Beginners should start with 3 full-body sessions per week with at least one rest day between sessions. Focus on compound movements: squats, push-ups, rows, hip hinges, and carries. Use bodyweight or light weights. Aim for 2-3 sets of 10-15 reps per exercise. Priority is learning correct form before adding load. Rest 60-90 seconds between sets. Progress by adding one rep per set each week before increasing weight. Always include a 5-minute warmup and cooldown. Avoid training to failure in the first 4 weeks.`,
    tags: ['beginner', 'full-body', 'compound', 'form', 'general_fitness'],
  },
  {
    id: 'ex_intermediate_001',
    category: 'intermediate',
    title: 'Intermediate Split Training',
    content: `Intermediate trainees (6+ months consistent training) benefit from a 4-day upper/lower or push/pull/legs split. Train each muscle group 2x per week for optimal hypertrophy. Use 3-4 sets of 8-12 reps at 70-80% 1RM. Include both compound and isolation movements. Progressive overload is essential — increase weight by 2.5-5kg when you hit the top of the rep range for all sets. Deload every 6-8 weeks by reducing volume by 40-50%.`,
    tags: ['intermediate', 'split', 'upper_lower', 'push_pull', 'progressive_overload'],
  },
  {
    id: 'ex_strength_001',
    category: 'strength',
    title: 'Strength Training and Muscle Gain Principles',
    content: `For muscle gain (hypertrophy), train each muscle group 2x per week. Use 6-12 rep range at 65-85% 1RM. Progressive overload is the #1 driver of muscle growth — increase weight or reps every session. Core exercises: bench press, rows, squats, deadlifts, overhead press. Rest 60-120 seconds between sets. Prioritize compound movements first, isolation exercises second. Sleep 7-9 hours and consume 1.6-2.2g protein per kg bodyweight daily. Muscle gain is slow: expect 0.5-1kg lean mass per month for natural trainees.`,
    tags: ['strength', 'hypertrophy', 'muscle_gain', 'progressive_overload', 'compound'],
  },
  {
    id: 'ex_fatloss_001',
    category: 'fat_loss',
    title: 'Fat Loss Training Protocol',
    content: `Optimal fat loss combines resistance training (3-4x/week) with cardio (2-3x/week). Resistance training preserves muscle during a calorie deficit, which is critical. Circuit training and supersets elevate EPOC (excess post-exercise oxygen consumption) for additional calorie burn. Cardio options: 20-45 min moderate intensity (65-75% max HR) or 15-20 min HIIT. HIIT protocol: 30 sec work, 30 sec rest, 10-15 rounds — only for intermediate+ trainees. Consistency beats intensity. A sustainable 300-500 calorie daily deficit with high protein intake (2g/kg) preserves muscle while burning fat.`,
    tags: ['fat_loss', 'weight_loss', 'cardio', 'HIIT', 'circuit', 'calorie_deficit'],
  },
  {
    id: 'ex_endurance_001',
    category: 'endurance',
    title: 'Cardiovascular Endurance Training',
    content: `Build aerobic base with Zone 2 training: 60-70% max HR, conversational pace, 30-60 min sessions. Progress running or cycling volume by no more than 10% per week to prevent injury. Long slow distance (LSD) builds mitochondrial density and fat oxidation capacity. Intermediate: add 1 tempo run per week at 80-90% max HR for 20-40 minutes. Cross-training reduces overuse injuries — mix running, cycling, swimming, rowing. For general fitness, 150 minutes of moderate cardio or 75 minutes vigorous cardio per week meets WHO guidelines.`,
    tags: ['endurance', 'cardio', 'zone2', 'running', 'aerobic', 'general_fitness'],
  },
  {
    id: 'ex_recovery_001',
    category: 'recovery',
    title: 'Recovery, Rest, and Deload Guidelines',
    content: `Muscles grow during recovery, not during training. Rest days are mandatory. Include at least 1-2 full rest days per week. Active recovery (walking, yoga, light stretching) is superior to complete inactivity. Sleep is the most important recovery tool — 7-9 hours per night. Signs of overtraining: persistent fatigue, declining performance, mood changes, sleep disruption, elevated resting heart rate. Deload weeks every 4-8 weeks: reduce volume by 40-50% while keeping intensity. Foam rolling and static stretching post-workout reduce soreness. Hydration: 2-3L water per day, more on training days.`,
    tags: ['recovery', 'rest', 'overtraining', 'deload', 'sleep'],
  },
  {
    id: 'ex_warmup_001',
    category: 'warmup',
    title: 'Warmup and Cooldown Protocols',
    content: `Warmup: 5-10 minutes of light cardio plus dynamic stretching targeting muscles used in the workout. Dynamic stretches: leg swings, arm circles, hip rotations, inchworms, jumping jacks, high knees. Never skip warmup — reduces injury risk and improves performance by 10-20%. Specific warmup sets: before heavy lifts, do 1-2 sets at 50-60% working weight. Cooldown: 5-10 minutes of static stretching. Hold each stretch 20-30 seconds without bouncing. Key cooldown stretches: hip flexors, hamstrings, chest opener, lat stretch, shoulder cross-body. Breathing: inhale to expand, exhale to deepen the stretch.`,
    tags: ['warmup', 'cooldown', 'stretching', 'injury_prevention', 'flexibility'],
  },
  {
    id: 'ex_injury_001',
    category: 'safety',
    title: 'Exercise Modifications for Injuries and Conditions',
    content: `Always obtain medical clearance before starting exercise with existing conditions. Lower back pain: avoid heavy spinal loading (deadlifts, heavy squats). Focus on core stability: planks, bird-dogs, glute bridges, dead bugs. Knee issues: avoid deep squats and lunges. Substitute: leg press (limited range), seated leg curl, straight-leg deadlift, swimming. Shoulder impingement: avoid overhead pressing and upright rows. Use landmine press, cable chest flyes, and face pulls instead. Hip issues: avoid high-impact activities. Use cycling, swimming, or elliptical. Diabetes: monitor blood glucose before and after; carry fast-acting sugar. Heart conditions: stay in lower heart rate zones (50-70% max HR); get cardiac clearance first.`,
    tags: ['injury', 'safety', 'modification', 'medical', 'conditions', 'back', 'knee', 'shoulder'],
  },
  {
    id: 'ex_bodyweight_001',
    category: 'bodyweight',
    title: 'Bodyweight Training for Home or Travel',
    content: `Effective bodyweight training requires no equipment and can build significant strength and fitness. Key exercises: push-up variations (standard, wide, diamond, pike), squat variations (air squat, jump squat, pistol progression), hinge (glute bridge, single-leg bridge), pull (inverted row, doorframe pull), core (plank, hollow body, mountain climber). Progress by increasing reps, slowing tempo, adding pauses, or moving to harder variations. Minimum effective dose: 3x20 push-ups, 3x20 squats, 3x30s planks, 3 days per week. For cardio: burpees, jumping jacks, high knees, shadow boxing.`,
    tags: ['bodyweight', 'home', 'no_equipment', 'beginner', 'travel'],
  },
  {
    id: 'ex_flexibility_001',
    category: 'flexibility',
    title: 'Flexibility and Mobility Training',
    content: `Flexibility training improves range of motion, reduces injury risk, and enhances performance. Static stretching is best post-workout when muscles are warm. Dynamic stretching is best pre-workout. Yoga and Pilates combine flexibility, strength, and mindfulness. Key tight areas for sedentary people: hip flexors, hamstrings, thoracic spine, chest, and calves. Mobility work: hip 90-90 stretch, thoracic rotation, ankle circles, shoulder CARs. For significant flexibility gains, stretch daily for 30-60 seconds per muscle group. Results take 4-8 weeks of consistent practice.`,
    tags: ['flexibility', 'mobility', 'yoga', 'stretching', 'range_of_motion'],
  },
];
