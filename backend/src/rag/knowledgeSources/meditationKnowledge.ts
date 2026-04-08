import { KnowledgeDoc } from './exerciseKnowledge';

export const MEDITATION_KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: 'med_breathing_001',
    category: 'breathing',
    title: 'Foundational Breathing Techniques for Meditation',
    content: `Controlled breathing is the gateway to meditation. Three core techniques:
1. Box Breathing (4-4-4-4): Inhale 4 counts, hold 4, exhale 4, hold empty 4. Activates parasympathetic nervous system. Used by Navy SEALs for acute stress management.
2. 4-7-8 Breathing: Inhale 4 counts, hold 7, exhale 8. Triggers relaxation response in under 2 minutes. Particularly effective before sleep meditation.
3. Diaphragmatic Breathing: Belly rises on inhale, falls on exhale. Corrects shallow chest breathing. Foundation for all advanced meditation practices. Practice 5-10 minutes daily for chronic stress reduction.
Note for beginners: start with natural breath awareness before attempting count-based techniques.`,
    tags: ['breathing', 'beginner', 'stress', 'relaxation', 'foundation'],
  },
  {
    id: 'med_mindfulness_001',
    category: 'mindfulness',
    title: 'Mindfulness Meditation — Core Practice',
    content: `Mindfulness meditation trains attention and awareness of the present moment without judgment.
Technique: Sit comfortably, close eyes, focus on breath sensation (nostril tip or chest rise). When mind wanders (it will), gently redirect to breath without self-criticism. This redirection is the practice.
Session structure: 2 min settle → 10 min breath focus → 2 min open awareness → 1 min intention setting.
Research: 8 weeks of daily 10-20 min practice reduces cortisol by 14%, improves sleep quality by 40%, reduces anxiety symptoms by 30-60%.
Progression: week 1-2: breath focus, week 3-4: body awareness, week 5-6: emotion labeling, week 7-8: open monitoring.
Best suited for: high stress, anxiety, overthinking, emotional dysregulation.`,
    tags: ['mindfulness', 'beginner', 'intermediate', 'stress', 'anxiety', 'general'],
  },
  {
    id: 'med_bodyscan_001',
    category: 'body_scan',
    title: 'Body Scan Meditation Protocol',
    content: `Body scan systematically moves attention through the body, releasing physical tension stored in muscles.
Protocol (20-30 min version):
1. Lie down, close eyes, 3 deep breaths (3 min)
2. Feet and toes — notice sensation, warmth, tingling (2 min)
3. Calves, shins, knees (2 min)
4. Thighs and hips, notice any tension (3 min)
5. Abdomen — observe natural breathing movement (3 min)
6. Chest and heart area — notice emotional quality (3 min)
7. Hands, arms, shoulders — release tension on exhale (3 min)
8. Neck and throat (2 min)
9. Face: jaw, temples, forehead — classic stress-holding areas (3 min)
10. Whole body awareness (2 min)
Shorter (10 min): move in 3 broad zones: lower body, torso, upper body.
Benefits: reduces muscle tension, improves sleep onset, excellent for chronic pain.`,
    tags: ['body_scan', 'intermediate', 'sleep', 'tension', 'stress', 'relaxation'],
  },
  {
    id: 'med_visualization_001',
    category: 'visualization',
    title: 'Guided Visualization and Imagery Meditation',
    content: `Visualization uses mental imagery to shift psychological state. Brain cannot fully distinguish between vivid imagination and experience.
Two main types:
1. Safe Place Visualization: Create a detailed mental sanctuary (beach, forest, mountain). Engage all senses — sounds, smells, temperature. Useful for anxiety and PTSD recovery.
2. Future Self Visualization: Imagine your ideal self 1 year from now. Feel the emotions of having achieved your goals. 10 minutes before sleep boosts motivation and goal clarity.
Script elements for effective visualization: scene setting (1 min), sensory detail layering (3 min), emotional anchoring (2 min), affirmation integration (2 min), gentle return (1 min).
Best suited for: goal setting, confidence building, performance anxiety, creative blocks.
Advanced: combine with breathing — visualize on inhale, release tension/obstacles on exhale.`,
    tags: ['visualization', 'intermediate', 'advanced', 'anxiety', 'motivation', 'sleep'],
  },
  {
    id: 'med_focus_001',
    category: 'focus',
    title: 'Focus and Concentration Meditation (Trataka)',
    content: `Concentration meditation strengthens single-pointed attention — the foundation of deep meditative states.
Techniques:
1. Object focus: Candle flame, mandala, or a fixed point. Gaze softly without blinking. When attention drifts, return without judgment. Start: 5 min, progress to 20 min over 4 weeks.
2. Sound focus (mantra): Repeat a word or phrase silently (e.g., "peace", "so-hum"). Each time mind wanders, return to mantra sound.
3. Breath counting: Count each exhale from 1 to 10. If you lose count, restart from 1. Simple but extremely effective training.
Cognitive benefits: increased prefrontal cortex thickness, improved working memory, better impulse control.
Best for: high stress executives, students, ADHD tendencies, low focus individuals.
Session: 5-20 minutes once or twice daily.`,
    tags: ['focus', 'concentration', 'intermediate', 'advanced', 'mental_clarity'],
  },
  {
    id: 'med_stress_001',
    category: 'stress_reduction',
    title: 'Stress Reduction and MBSR Protocols',
    content: `Mindfulness-Based Stress Reduction (MBSR) — clinically validated 8-week program.
Core components adapted for daily practice:
1. Formal practice: 20-45 min daily (body scan, mindfulness, gentle movement)
2. Informal practice: mindful eating, mindful walking, mindful conversations
3. Sitting with difficulty: deliberately observe anxious thoughts without reacting
Acute stress protocol (5 minutes): Stop → Breathe (3 deep) → Observe (name 3 sensations) → Proceed.
Chronic stress (high stress level 4-5): 20+ min daily, evening body scan, morning intention setting.
Research: MBSR reduces cortisol levels, improves immune function, reduces depression relapse by 50%.
Signs of progress: noticing reactions before acting on them, longer gap between stimulus and response.`,
    tags: ['stress', 'stress_reduction', 'advanced', 'beginner', 'mbsr', 'anxiety'],
  },
  {
    id: 'med_sleep_001',
    category: 'sleep',
    title: 'Sleep Meditation and Relaxation for Insomnia',
    content: `Sleep meditation addresses the hyperarousal state that prevents sleep onset.
Pre-sleep routine (30 min before bed):
1. Digital sunset: no screens 30 min before bed
2. Progressive muscle relaxation: tense each muscle group 5 sec, release. Start feet, end face. (10 min)
3. 4-7-8 breathing: 4 cycles minimum (3 min)
4. Body scan: lying in bed, top to bottom (10 min)
5. Sleep visualization: imagine floating or sinking into warmth
Sleep-specific techniques:
- Cognitive shuffle: Imagine random unrelated images (a hat, a cloud, a fish) — disrupts overthinking
- Military method: 2 minutes to relax face, drop shoulders, exhale, clear mind with one image
For chronic insomnia: combine with sleep restriction therapy and consistent wake time.
Avoid: stimulating music, problem-solving before bed, clock-watching.`,
    tags: ['sleep', 'relaxation', 'beginner', 'intermediate', 'insomnia', 'body_scan'],
  },
  {
    id: 'med_beginner_001',
    category: 'beginner_guide',
    title: 'Beginner Meditation: First 4 Weeks Guide',
    content: `Week-by-week beginner progression:
Week 1 (Foundation): 5 minutes daily. Natural breath awareness only. No counting, no technique. Just notice you are breathing.
Week 2 (Attention): 7-10 minutes. Introduce breath counting (1-10 on exhale). Notice when mind wanders — return without judgment.
Week 3 (Body): 10-12 minutes. Alternate between breath focus (5 min) and body scan lite — notice any area of tension (5 min).
Week 4 (Expansion): 12-15 minutes. Try guided body scan or beginners mindfulness.
Common mistakes: expecting emptiness (goal is awareness not blank mind), practicing too long too soon, being harsh when distracted (distraction IS the practice).
Environment: quiet space, same time daily, comfortable seated position. Eyes closed or soft gaze down.
Track consistency > duration. 5 minutes every day beats 30 minutes once a week.`,
    tags: ['beginner', 'foundation', 'general', 'guide', 'first_steps'],
  },
  {
    id: 'med_advanced_001',
    category: 'advanced',
    title: 'Advanced Meditation: Deepening Practice',
    content: `For practitioners with 3+ months consistent practice:
1. Open Monitoring: Instead of fixed focus, observe all thoughts, sensations, sounds as they arise and pass — without attaching or rejecting. Pure witnessing.
2. Loving-Kindness (Metta): Systematically cultivate compassion. Phrases: "May I be happy, may I be healthy, may I be safe." Extend to loved ones, neutral people, difficult people, all beings.
3. Non-dual awareness: Recognize the observer itself. Who is watching the breath? Can awareness be aware of itself?
4. Extended sessions: 30-60 min with retreat-style structure — 20 min body scan, 20 min mindfulness, 20 min open monitoring.
5. Walking meditation: Slow walking, full attention to foot sensations (lifting, moving, placing).
Integration: meditation insights must be embodied in daily life — how you eat, listen, respond to conflict.`,
    tags: ['advanced', 'loving_kindness', 'open_monitoring', 'experienced', 'deep_practice'],
  },
  {
    id: 'med_environment_001',
    category: 'environment',
    title: 'Creating Optimal Meditation Environment and Ambiance',
    content: `Environment powerfully conditions meditation quality.
Space setup:
- Dedicated corner or room signals mind: "this is meditation time"
- Temperature: 68-72°F (20-22°C) — slightly cool, prevents drowsiness
- Lighting: natural light or soft warm light (2700K). Avoid bright blue-white lighting
- Sound: nature sounds (rain, forest, ocean waves) at 40-60 dB enhance focus
- Scent: lavender and sandalwood reduce cortisol. Diffuse 15 min before practice
Music recommendations by type:
- Binaural beats (alpha 8-12 Hz): focus enhancement, stress relief
- Tibetan singing bowls: grounding, body awareness practices
- 432 Hz nature music: deep relaxation, sleep meditation
- Brown noise / rain sounds: beginner sessions, high-distraction environments
Clothing: loose, comfortable, non-restrictive. Remove shoes. Light blanket available for body scans.`,
    tags: ['environment', 'ambiance', 'music', 'setup', 'beginner', 'intermediate', 'advanced'],
  },
];
