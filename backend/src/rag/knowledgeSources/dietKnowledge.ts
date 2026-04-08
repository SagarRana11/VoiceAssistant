import { KnowledgeDoc } from './exerciseKnowledge';

export const DIET_KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: 'diet_calorie_001',
    category: 'calorie_science',
    title: 'Calorie Calculation and Energy Requirements',
    content: `Calorie needs are calculated using Basal Metabolic Rate (BMR) × Activity Multiplier.
Mifflin-St Jeor BMR Formula (most accurate):
  Male:   BMR = 10×weight(kg) + 6.25×height(cm) - 5×age + 5
  Female: BMR = 10×weight(kg) + 6.25×height(cm) - 5×age - 161
Activity multipliers (TDEE = Total Daily Energy Expenditure):
  Sedentary (desk job, no exercise): BMR × 1.2
  Light (1-3 days/week exercise):    BMR × 1.375
  Moderate (3-5 days/week):          BMR × 1.55
  Active (6-7 days/week):            BMR × 1.725
  Very Active (twice daily):          BMR × 1.9
Goal adjustments:
  Fat loss:     TDEE - 300 to 500 kcal/day (max 20% deficit to preserve muscle)
  Maintenance:  TDEE exactly
  Muscle gain:  TDEE + 200 to 300 kcal/day (lean bulk) or +500 (aggressive bulk)
1 pound of fat = 3,500 kcal deficit. Healthy loss rate: 0.5-1 kg/week.`,
    tags: ['calorie', 'bmr', 'tdee', 'fat_loss', 'weight_loss', 'muscle_gain', 'calculation'],
  },
  {
    id: 'diet_macro_001',
    category: 'macronutrients',
    title: 'Macronutrient Balance and Protein Targets',
    content: `Macronutrient splits by goal:
Fat Loss:       Protein 35%, Carbs 35%, Fat 30% — high protein preserves muscle during deficit
Muscle Gain:    Protein 30%, Carbs 45%, Fat 25% — carbs fuel training, protein builds muscle
Maintenance:    Protein 25%, Carbs 45%, Fat 30% — balanced, sustainable long-term
Endurance:      Protein 20%, Carbs 55%, Fat 25% — glycogen stores fuel cardio
Protein targets (evidence-based):
  General health: 0.8g/kg bodyweight
  Active individuals: 1.6-2.0g/kg bodyweight
  Muscle gain: 1.6-2.2g/kg bodyweight
  Fat loss: 2.0-2.4g/kg bodyweight (higher to prevent muscle loss)
Caloric density: Protein 4 kcal/g, Carbs 4 kcal/g, Fat 9 kcal/g
Fiber target: 25-35g/day (improves satiety, gut health, blood sugar control).`,
    tags: ['macros', 'protein', 'carbs', 'fat', 'fat_loss', 'muscle_gain', 'nutrition'],
  },
  {
    id: 'diet_vegan_001',
    category: 'vegan_nutrition',
    title: 'Vegan and Plant-Based Protein Sources',
    content: `Complete plant protein sources (contain all essential amino acids):
  Soy products: tofu (8g/100g), tempeh (19g/100g), edamame (11g/100g), soy milk (3g/100ml)
  Quinoa: 8g/100g cooked — one of few plant complete proteins
  Hemp seeds: 31g/100g — excellent omega-3 ratio
  Buckwheat: 13g/100g dry
Incomplete proteins (combine for completeness):
  Legumes: lentils (9g/100g), chickpeas (8g/100g), black beans (8g/100g)
  Grains: oats (17g/100g dry), brown rice (3g/100g cooked)
  Nuts: almonds (21g/100g), peanut butter (25g/100g)
  Seeds: pumpkin seeds (19g/100g), chia seeds (17g/100g)
Combining for complete protein: rice + beans, hummus + pita, oats + nuts.
Critical vegan micronutrients requiring supplementation or focus:
  B12: supplement 250-500mcg/day (no reliable plant source)
  Vitamin D3: supplement in winter or low sun
  Iron: pair with vitamin C for absorption, avoid tea/coffee with iron-rich meals
  Omega-3: algae oil supplement (ALA from flax poorly converts to EPA/DHA)
  Calcium: fortified plant milks, tofu made with calcium sulfate, leafy greens`,
    tags: ['vegan', 'vegetarian', 'plant_based', 'protein', 'nutrition', 'supplements'],
  },
  {
    id: 'diet_fatloss_001',
    category: 'fat_loss_diet',
    title: 'Fat Loss Diet Principles and Meal Strategies',
    content: `Evidence-based fat loss diet approach:
Core principles:
  1. Calorie deficit is non-negotiable — no diet works without it
  2. High protein (2-2.4g/kg) preserves lean mass during deficit
  3. High fiber (30-35g/day) increases satiety on fewer calories
  4. Minimize ultra-processed food — lower satiety per calorie
Meal timing for fat loss:
  Breakfast: high protein (30-40g) reduces appetite all day
  Lunch: largest meal — complex carbs + protein + vegetables
  Dinner: lighter, earlier (3 hrs before bed) — reduces late-night snacking
  Snacks: strategic — Greek yogurt, cottage cheese, boiled eggs, apple + nut butter
Top fat loss foods: eggs, chicken breast, fish, Greek yogurt, lentils, oats, leafy greens, berries.
Foods to minimize: refined sugar, white bread/rice, alcohol (7 kcal/g, zero nutrition), fried foods.
Mindful eating: eat slowly, no screens while eating, hunger/fullness awareness.
Plateau management: diet break week at maintenance calories every 8-10 weeks resets leptin.`,
    tags: ['fat_loss', 'weight_loss', 'calorie_deficit', 'meal_planning', 'satiety'],
  },
  {
    id: 'diet_muscle_001',
    category: 'muscle_gain_diet',
    title: 'Muscle Gain and Bulking Nutrition Strategy',
    content: `Muscle growth requires both training stimulus AND nutritional surplus.
Calorie approach:
  Lean bulk: TDEE + 200-300 kcal. Slow but minimal fat gain (0.25-0.5 kg/week)
  Aggressive bulk: TDEE + 500 kcal. Faster muscle gain but more fat accumulation
Protein timing for hypertrophy:
  Pre-workout: 20-40g protein 1-2 hours before. Whey or chicken.
  Post-workout: 30-40g within 2 hours (anabolic window is real but wider than previously thought)
  Before sleep: 40g casein protein. Sustained amino acid release during overnight fasting.
Carbohydrates for muscle gain:
  Complex carbs 2-3 hrs pre-workout: oats, sweet potato, brown rice — fuel glycogen stores
  Fast carbs + protein immediately post-workout: banana + protein shake
High calorie whole foods: whole eggs, salmon, avocado, nuts, olive oil, whole milk (if non-vegan).
Creatine monohydrate: 3-5g/day — most evidence-supported muscle-building supplement.`,
    tags: ['muscle_gain', 'bulking', 'hypertrophy', 'protein_timing', 'carbs'],
  },
  {
    id: 'diet_disease_001',
    category: 'medical_nutrition',
    title: 'Disease-Specific Dietary Restrictions and Modifications',
    content: `Key medical nutrition considerations:
Diabetes (Type 2):
  - Reduce refined carbs and sugars; focus on low-glycemic index foods (GI < 55)
  - Prioritize: leafy greens, legumes, whole grains, non-starchy vegetables
  - Avoid: white bread, white rice, sugary drinks, fruit juice, processed snacks
  - Meal timing: consistent meal times prevent blood sugar spikes; avoid large meals
  - Carb target: 45-60g per meal, spread across 3-4 meals
Thyroid (Hypothyroid):
  - Avoid goitrogenic foods in excess (raw cruciferous — broccoli, cabbage, soy in large amounts)
  - Selenium-rich foods support thyroid: Brazil nuts, tuna, sardines, eggs
  - Iron deficiency impairs thyroid function — ensure adequate iron
  - Take medication 1 hour before eating; calcium and iron supplements block absorption
High Cholesterol / Cardiovascular Risk:
  - Limit saturated fat (< 7% of calories), eliminate trans fats
  - Increase soluble fiber (oats, beans, flaxseed) — binds cholesterol
  - Omega-3 rich foods: fatty fish 2-3x/week, walnuts, flaxseed
Hypertension (High Blood Pressure):
  - DASH diet: fruits, vegetables, whole grains, low-fat dairy, lean protein
  - Reduce sodium < 2300mg/day (ideally < 1500mg)
  - Increase potassium (bananas, potatoes, legumes) — counteracts sodium`,
    tags: ['diabetes', 'thyroid', 'cholesterol', 'disease', 'medical', 'restriction'],
  },
  {
    id: 'diet_hydration_001',
    category: 'hydration',
    title: 'Hydration Guidelines and Recommendations',
    content: `Water is the most critical nutrient — dehydration of just 2% impairs cognitive and physical performance.
Daily hydration targets:
  General: 35ml per kg bodyweight (e.g., 70kg person = 2.45L)
  Active individuals: add 500-750ml per hour of exercise
  Hot climate: add 500ml-1L daily
  General rule: urine should be pale yellow (not clear, not dark)
Timing for health and performance:
  Morning: 500ml upon waking — rehydrates overnight fast, kick-starts metabolism
  Pre-workout: 400-600ml 2 hours before exercise
  During exercise: 150-250ml every 15-20 minutes
  Post-workout: 500-750ml per 0.5kg bodyweight lost
Electrolyte balance:
  Sodium: important after long sweating sessions (> 60 min)
  Potassium: bananas, coconut water, sweet potato
  Magnesium: crucial for muscle function, sleep — nuts, seeds, dark chocolate
Hydrating foods: cucumber (96% water), watermelon (92%), strawberries (91%), spinach (91%).
Limit dehydrating drinks: alcohol (diuretic), caffeine (moderate effect — 1-2 cups OK).`,
    tags: ['hydration', 'water', 'electrolytes', 'performance', 'general'],
  },
  {
    id: 'diet_vegetarian_001',
    category: 'vegetarian_nutrition',
    title: 'Vegetarian Diet Planning and Balanced Nutrition',
    content: `Vegetarian diets (include eggs/dairy) are nutritionally complete with proper planning.
High-quality vegetarian protein sources:
  Eggs: 6g/egg, complete protein, highest bioavailability score (PDCAAS 1.0)
  Greek yogurt: 10-17g/100g, probiotics, calcium
  Cottage cheese / paneer: 11-14g/100g
  Cheese: 20-25g/100g (high calorie, use in moderation)
  Whey protein (from milk): for supplementing protein needs
Sample high-protein vegetarian day (1600 kcal, 120g protein):
  Breakfast: 3 scrambled eggs + oats + berries (40g protein)
  Lunch: lentil dal + brown rice + vegetable curry (35g protein)
  Snack: Greek yogurt + almonds (20g protein)
  Dinner: paneer + vegetable stir-fry + quinoa (30g protein)
Micronutrient watch: iron (non-heme, less bioavailable — pair with vit C), zinc (pumpkin seeds, legumes), iodine (dairy and eggs contain it, seaweed for vegan).
Indian vegetarian diet note: dal + chapati + rice + vegetable sabzi forms a nutritionally complete meal pattern when varied daily.`,
    tags: ['vegetarian', 'eggs', 'dairy', 'protein', 'indian_food', 'balanced'],
  },
  {
    id: 'diet_meal_timing_001',
    category: 'meal_timing',
    title: 'Meal Timing, Frequency, and Intermittent Fasting',
    content: `Meal timing affects energy levels, hunger control, and metabolic health.
Meal frequency:
  3 meals/day: standard, works for most people
  4-5 smaller meals: keeps blood sugar stable, better for active individuals and diabetics
  2 meals (intermittent fasting): reduces hunger cues for some, simpler to follow
Intermittent fasting protocols:
  16:8 (most popular): 16-hour fast, 8-hour eating window (e.g., 12pm-8pm)
  5:2: Normal eating 5 days, 500-600 kcal on 2 non-consecutive days
  Not suitable for: pregnant women, diabetes on medication (hypoglycemia risk), underweight individuals
Breakfast research: high-protein breakfast reduces total daily calorie intake by 135 kcal on average.
Pre-workout nutrition: complex carbs + protein 1-2 hours before training
Post-workout window: protein within 2 hours, carbs within 1 hour of resistance training
Evening meals: lighter and earlier correlates with better sleep quality and lower blood glucose overnight.
Consistency matters more than specific timing — eat at similar times daily for circadian alignment.`,
    tags: ['meal_timing', 'intermittent_fasting', 'frequency', 'general', 'fat_loss'],
  },
  {
    id: 'diet_substitution_001',
    category: 'food_substitutions',
    title: 'Healthy Food Substitutions and Smart Swaps',
    content: `Smart substitutions maintain adherence without sacrificing satisfaction.
Calorie-reducing swaps:
  White rice → Cauliflower rice (saves ~140 kcal/cup) or shirataki rice (near-zero kcal)
  White bread → Whole grain bread or lettuce wraps
  Full-fat cream → Greek yogurt in sauces (saves 300+ kcal/cup)
  Potato chips → Air-popped popcorn or roasted chickpeas
  Vegetable oils for frying → Air fryer + cooking spray (saves 400+ kcal)
  Mayonnaise → Avocado or hummus
Protein upgrades:
  Paneer → Tofu (lower calorie, plant protein)
  Full-fat cheese → Cottage cheese in recipes
  Fried chicken → Baked/air-fried chicken with same crispy coating
Allergy substitutions:
  Gluten-free: rice flour, almond flour, oat flour (certified GF), quinoa
  Dairy-free: oat milk, almond milk, coconut yogurt, cashew cream
  Egg-free: flax egg (1 tbsp ground flax + 3 tbsp water), chia egg, aquafaba
Flavor enhancers without calories: herbs, spices, lemon juice, vinegar — all near-zero calories but dramatically improve palatability.`,
    tags: ['substitution', 'healthy_swaps', 'allergy', 'gluten_free', 'dairy_free', 'fat_loss'],
  },
];
