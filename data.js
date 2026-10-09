// Activity types for the Phase 2 exercise log. `met` = metabolic equivalent, used to estimate
// calories burned: kcal = met * 3.5 * weightKg / 200 * minutes (standard MET formula).
const ACTIVITIES = [
  { n: 'Walk', met: 3.5 },
  { n: 'Gym', met: 5 },
  { n: 'Run', met: 9.8 },
  { n: 'Bike', met: 7.5 },
  { n: 'Custom', met: 4 }, // fallback for anything typed in manually without a calorie override
];

// Phase 6: diet type & allergy filtering.
// ALLERGENS drives both the Profile checkboxes and the matching logic:
//   - `keywords` are matched (best-effort, case-insensitive substring) against meal ingredient
//     names and plain food names, since most of our food data has no structured allergen info.
//   - `off` are the real Open Food Facts allergen tag suffixes (e.g. "en:milk"), used instead of
//     keyword-guessing whenever an Open Food Facts result actually has `allergens_tags`.
const ALLERGENS = {
  dairy: { label: 'Dairy', keywords: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'whey', 'casein'], off: ['en:milk'] },
  eggs: { label: 'Eggs', keywords: ['egg'], off: ['en:eggs'] },
  gluten: { label: 'Gluten/Wheat', keywords: ['wheat', 'bread', 'pasta', 'tortilla', 'barley', 'rye', 'flour', 'bun', 'cracker', 'noodle'], off: ['en:gluten'] },
  nuts: { label: 'Nuts/Peanuts', keywords: ['almond', 'peanut', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut'], off: ['en:nuts', 'en:peanuts'] },
  soy: { label: 'Soy', keywords: ['soy', 'tofu', 'edamame'], off: ['en:soybeans'] },
  shellfish: { label: 'Shellfish/Fish', keywords: ['shrimp', 'crab', 'lobster', 'fish', 'salmon', 'tuna', 'clam', 'scallop'], off: ['en:fish', 'en:crustaceans', 'en:molluscs'] },
};
// Best-effort keyword lists for diet-type warnings on plain food names (built-in foods have no
// structured data). Meals use their `tags` (Vegetarian/Vegan) instead — much more reliable.
const NONVEG_KEYWORDS = ['chicken', 'turkey', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'steak', 'lamb', 'shrimp', 'salmon', 'tuna', 'fish', 'meatball', 'burger', 'pepperoni'];
const NONVEGAN_EXTRA_KEYWORDS = ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg', 'honey', 'whey'];

// Approximate nutrition values (USDA-style averages). Fields: n=name, s=serving, cal, p/c/f = grams.
const FOODS = [
  // Proteins
  {n:'Chicken breast, grilled',s:'4 oz',cal:187,p:35,c:0,f:4},
  {n:'Turkey breast, sliced',s:'3 oz',cal:90,p:18,c:2,f:1},
  {n:'Salmon, baked',s:'4 oz',cal:233,p:25,c:0,f:14},
  {n:'Tuna, canned in water',s:'1 can',cal:120,p:26,c:0,f:1},
  {n:'Shrimp, cooked',s:'4 oz',cal:112,p:24,c:1,f:1},
  {n:'Lean ground beef (93%)',s:'4 oz',cal:200,p:23,c:0,f:11},
  {n:'Egg, whole',s:'1 large',cal:72,p:6,c:0,f:5},
  {n:'Egg whites',s:'3 large',cal:51,p:11,c:1,f:0},
  {n:'Tofu, firm',s:'4 oz',cal:90,p:10,c:2,f:5},
  {n:'Black beans',s:'1/2 cup',cal:114,p:8,c:20,f:0.5},
  {n:'Lentils, cooked',s:'1/2 cup',cal:115,p:9,c:20,f:0.4},
  {n:'Chickpeas',s:'1/2 cup',cal:135,p:7,c:22,f:2},
  // Dairy
  {n:'Greek yogurt, nonfat plain',s:'3/4 cup',cal:100,p:17,c:6,f:0},
  {n:'Cottage cheese, low-fat',s:'1/2 cup',cal:90,p:12,c:5,f:2.5},
  {n:'Milk, 2%',s:'1 cup',cal:122,p:8,c:12,f:5},
  {n:'Almond milk, unsweetened',s:'1 cup',cal:30,p:1,c:1,f:2.5},
  {n:'Cheddar cheese',s:'1 oz',cal:113,p:7,c:0,f:9},
  {n:'Mozzarella, part-skim',s:'1 oz',cal:72,p:7,c:1,f:4.5},
  // Grains & starches
  {n:'Oatmeal, cooked',s:'1 cup',cal:154,p:6,c:27,f:3},
  {n:'Brown rice, cooked',s:'1 cup',cal:216,p:5,c:45,f:2},
  {n:'White rice, cooked',s:'1 cup',cal:205,p:4,c:45,f:0.4},
  {n:'Quinoa, cooked',s:'1 cup',cal:222,p:8,c:39,f:4},
  {n:'Whole wheat bread',s:'1 slice',cal:81,p:4,c:14,f:1},
  {n:'Whole wheat pasta, cooked',s:'1 cup',cal:174,p:7.5,c:37,f:1},
  {n:'Sweet potato, baked',s:'1 medium',cal:112,p:2,c:26,f:0},
  {n:'Potato, baked',s:'1 medium',cal:161,p:4,c:37,f:0.2},
  {n:'Tortilla, whole wheat',s:'1 medium',cal:130,p:4,c:22,f:3},
  {n:'Granola',s:'1/4 cup',cal:130,p:3,c:20,f:5},
  // Fruit
  {n:'Apple',s:'1 medium',cal:95,p:0.5,c:25,f:0.3},
  {n:'Banana',s:'1 medium',cal:105,p:1.3,c:27,f:0.4},
  {n:'Orange',s:'1 medium',cal:62,p:1.2,c:15,f:0.2},
  {n:'Strawberries',s:'1 cup',cal:49,p:1,c:12,f:0.5},
  {n:'Blueberries',s:'1 cup',cal:84,p:1,c:21,f:0.5},
  {n:'Grapes',s:'1 cup',cal:104,p:1,c:27,f:0.2},
  {n:'Avocado',s:'1/2 medium',cal:120,p:1.5,c:6,f:11},
  // Vegetables
  {n:'Broccoli, steamed',s:'1 cup',cal:55,p:3.7,c:11,f:0.6},
  {n:'Spinach, raw',s:'2 cups',cal:14,p:1.7,c:2,f:0.2},
  {n:'Mixed salad greens',s:'2 cups',cal:20,p:2,c:4,f:0.3},
  {n:'Carrots',s:'1 medium',cal:25,p:0.6,c:6,f:0.1},
  {n:'Bell pepper',s:'1 medium',cal:31,p:1,c:7,f:0.3},
  {n:'Cucumber',s:'1 cup',cal:16,p:0.7,c:4,f:0.1},
  {n:'Green beans',s:'1 cup',cal:44,p:2.4,c:10,f:0.4},
  {n:'Roasted vegetables',s:'1 cup',cal:90,p:2,c:14,f:3.5},
  // Fats, nuts, extras
  {n:'Almonds',s:'1 oz (23)',cal:164,p:6,c:6,f:14},
  {n:'Peanut butter',s:'1 tbsp',cal:94,p:4,c:3,f:8},
  {n:'Olive oil',s:'1 tsp',cal:40,p:0,c:0,f:4.5},
  {n:'Hummus',s:'2 tbsp',cal:70,p:2,c:4,f:5},
  {n:'Honey',s:'1 tsp',cal:21,p:0,c:6,f:0},
  {n:'Dark chocolate (70%)',s:'1 square',cal:60,p:0.8,c:5,f:4.5},
  {n:'Protein shake',s:'1 scoop + water',cal:120,p:24,c:3,f:1.5},
  {n:'Protein bar',s:'1 bar',cal:200,p:20,c:22,f:6},
  // Common meals & treats
  {n:'Pizza, cheese',s:'1 slice',cal:285,p:12,c:36,f:10},
  {n:'Cheeseburger',s:'1 regular',cal:303,p:15,c:33,f:13},
  {n:'French fries',s:'medium',cal:365,p:4,c:48,f:17},
  {n:'Ice cream, vanilla',s:'1/2 cup',cal:137,p:2,c:16,f:7},
  {n:'Soda, regular',s:'12 oz',cal:140,p:0,c:39,f:0},
  {n:'Coffee, black',s:'1 cup',cal:2,p:0.3,c:0,f:0},
  {n:'Beer',s:'12 oz',cal:153,p:1.6,c:13,f:0},
  {n:'Red wine',s:'5 oz',cal:125,p:0.1,c:4,f:0},
];

// Healthy meal ideas. type: Breakfast/Lunch/Dinner/Snack.
// `ing` (ingredients) drives the Phase 4 shopping list: [{n: name, cat: shopping category}, ...].
// Categories are intentionally few and broad (Produce, Protein, Dairy & Eggs, Grains & Bakery,
// Pantry & Condiments, Frozen & Other) so the generated list stays readable grouped by aisle.
const MEALS = [
  {n:'Veggie egg-white scramble',type:'Breakfast',cal:260,p:24,c:14,f:11,tags:['High protein','Quick'],d:'3 egg whites + 1 egg, spinach, peppers, 1 slice whole wheat toast.',
    ing:[{n:'Eggs',cat:'Dairy & Eggs'},{n:'Spinach',cat:'Produce'},{n:'Bell pepper',cat:'Produce'},{n:'Whole wheat bread',cat:'Grains & Bakery'}]},
  {n:'Berry Greek yogurt bowl',type:'Breakfast',cal:280,p:22,c:38,f:5,tags:['High protein','Vegetarian','Quick'],d:'3/4 cup nonfat Greek yogurt, 1 cup blueberries, 2 tbsp granola.',
    ing:[{n:'Greek yogurt',cat:'Dairy & Eggs'},{n:'Blueberries',cat:'Produce'},{n:'Granola',cat:'Pantry & Condiments'}]},
  {n:'Overnight oats',type:'Breakfast',cal:340,p:14,c:52,f:8,tags:['Vegetarian','Meal prep'],d:'1/2 cup oats, 1/2 cup almond milk, chia seeds, sliced banana.',
    ing:[{n:'Oats',cat:'Pantry & Condiments'},{n:'Almond milk',cat:'Dairy & Eggs'},{n:'Chia seeds',cat:'Pantry & Condiments'},{n:'Banana',cat:'Produce'}]},
  {n:'Avocado egg toast',type:'Breakfast',cal:320,p:15,c:26,f:18,tags:['Vegetarian','Quick'],d:'1 slice whole wheat toast, 1/2 avocado, 1 poached egg.',
    ing:[{n:'Whole wheat bread',cat:'Grains & Bakery'},{n:'Avocado',cat:'Produce'},{n:'Eggs',cat:'Dairy & Eggs'}]},
  {n:'Cottage cheese & fruit',type:'Breakfast',cal:200,p:14,c:28,f:3,tags:['Vegetarian','Quick','High protein'],d:'1/2 cup low-fat cottage cheese with strawberries.',
    ing:[{n:'Cottage cheese',cat:'Dairy & Eggs'},{n:'Strawberries',cat:'Produce'}]},
  {n:'Chicken & quinoa salad bowl',type:'Lunch',cal:430,p:40,c:38,f:13,tags:['High protein','Meal prep'],d:'4 oz grilled chicken, 1/2 cup quinoa, greens, cucumber, 1 tsp olive oil + lemon.',
    ing:[{n:'Chicken breast',cat:'Protein'},{n:'Quinoa',cat:'Pantry & Condiments'},{n:'Mixed salad greens',cat:'Produce'},{n:'Cucumber',cat:'Produce'},{n:'Olive oil',cat:'Pantry & Condiments'},{n:'Lemon',cat:'Produce'}]},
  {n:'Tuna lettuce wraps',type:'Lunch',cal:230,p:28,c:8,f:9,tags:['High protein','Low carb','Quick'],d:'Canned tuna with Greek yogurt, celery and mustard in romaine leaves.',
    ing:[{n:'Canned tuna',cat:'Pantry & Condiments'},{n:'Greek yogurt',cat:'Dairy & Eggs'},{n:'Celery',cat:'Produce'},{n:'Mustard',cat:'Pantry & Condiments'},{n:'Romaine lettuce',cat:'Produce'}]},
  {n:'Turkey & veggie wrap',type:'Lunch',cal:340,p:26,c:36,f:10,tags:['Quick'],d:'Whole wheat tortilla, 3 oz turkey, spinach, peppers, mustard.',
    ing:[{n:'Whole wheat tortillas',cat:'Grains & Bakery'},{n:'Turkey breast',cat:'Protein'},{n:'Spinach',cat:'Produce'},{n:'Bell pepper',cat:'Produce'},{n:'Mustard',cat:'Pantry & Condiments'}]},
  {n:'Lentil vegetable soup',type:'Lunch',cal:310,p:18,c:50,f:4,tags:['Vegetarian','Meal prep','Vegan'],d:'Lentils, carrots, celery, tomatoes, and spices. Makes great leftovers.',
    ing:[{n:'Lentils',cat:'Pantry & Condiments'},{n:'Carrots',cat:'Produce'},{n:'Celery',cat:'Produce'},{n:'Tomatoes',cat:'Produce'}]},
  {n:'Black bean burrito bowl',type:'Lunch',cal:420,p:20,c:66,f:8,tags:['Vegetarian','Vegan','Meal prep'],d:'Brown rice, black beans, salsa, peppers, romaine, squeeze of lime.',
    ing:[{n:'Brown rice',cat:'Pantry & Condiments'},{n:'Black beans',cat:'Pantry & Condiments'},{n:'Salsa',cat:'Pantry & Condiments'},{n:'Bell pepper',cat:'Produce'},{n:'Romaine lettuce',cat:'Produce'},{n:'Lime',cat:'Produce'}]},
  {n:'Chickpea salad',type:'Lunch',cal:360,p:15,c:46,f:14,tags:['Vegan','Vegetarian','Quick'],d:'Chickpeas, cucumber, tomato, red onion, olive oil, lemon.',
    ing:[{n:'Chickpeas',cat:'Pantry & Condiments'},{n:'Cucumber',cat:'Produce'},{n:'Tomatoes',cat:'Produce'},{n:'Red onion',cat:'Produce'},{n:'Olive oil',cat:'Pantry & Condiments'},{n:'Lemon',cat:'Produce'}]},
  {n:'Baked salmon, broccoli & sweet potato',type:'Dinner',cal:520,p:40,c:42,f:20,tags:['High protein'],d:'4 oz salmon, 1 cup steamed broccoli, 1 medium baked sweet potato.',
    ing:[{n:'Salmon',cat:'Protein'},{n:'Broccoli',cat:'Produce'},{n:'Sweet potato',cat:'Produce'}]},
  {n:'Chicken stir-fry',type:'Dinner',cal:410,p:38,c:36,f:12,tags:['High protein','Quick'],d:'4 oz chicken, mixed veggies, low-sodium soy sauce, 1/2 cup brown rice.',
    ing:[{n:'Chicken breast',cat:'Protein'},{n:'Mixed stir-fry vegetables',cat:'Produce'},{n:'Soy sauce',cat:'Pantry & Condiments'},{n:'Brown rice',cat:'Pantry & Condiments'}]},
  {n:'Turkey chili',type:'Dinner',cal:380,p:34,c:38,f:9,tags:['High protein','Meal prep'],d:'Lean ground turkey, beans, tomatoes, peppers. Freezes well.',
    ing:[{n:'Ground turkey',cat:'Protein'},{n:'Kidney or black beans',cat:'Pantry & Condiments'},{n:'Tomatoes',cat:'Produce'},{n:'Bell pepper',cat:'Produce'}]},
  {n:'Shrimp & veggie skewers',type:'Dinner',cal:290,p:30,c:20,f:9,tags:['High protein','Low carb'],d:'Shrimp with zucchini, peppers and onion, grilled. Add lemon.',
    ing:[{n:'Shrimp',cat:'Protein'},{n:'Zucchini',cat:'Produce'},{n:'Bell pepper',cat:'Produce'},{n:'Onion',cat:'Produce'},{n:'Lemon',cat:'Produce'}]},
  {n:'Tofu veggie stir-fry',type:'Dinner',cal:350,p:20,c:38,f:14,tags:['Vegan','Vegetarian','Quick'],d:'Firm tofu, broccoli, carrots, garlic, ginger, 1/2 cup rice.',
    ing:[{n:'Tofu',cat:'Protein'},{n:'Broccoli',cat:'Produce'},{n:'Carrots',cat:'Produce'},{n:'Garlic',cat:'Produce'},{n:'Ginger',cat:'Produce'},{n:'Rice',cat:'Pantry & Condiments'}]},
  {n:'Zucchini noodles with turkey meatballs',type:'Dinner',cal:340,p:32,c:20,f:15,tags:['Low carb','High protein'],d:'Spiralized zucchini, lean turkey meatballs, marinara.',
    ing:[{n:'Zucchini',cat:'Produce'},{n:'Ground turkey',cat:'Protein'},{n:'Marinara sauce',cat:'Pantry & Condiments'}]},
  {n:'Lean burger, side salad',type:'Dinner',cal:430,p:34,c:26,f:22,tags:['High protein'],d:'4 oz 93% lean patty on a whole wheat bun-half, large salad.',
    ing:[{n:'Lean ground beef',cat:'Protein'},{n:'Whole wheat buns',cat:'Grains & Bakery'},{n:'Mixed salad greens',cat:'Produce'}]},
  {n:'Apple & peanut butter',type:'Snack',cal:190,p:4,c:28,f:8,tags:['Vegetarian','Quick'],d:'1 medium apple with 1 tbsp peanut butter.',
    ing:[{n:'Apple',cat:'Produce'},{n:'Peanut butter',cat:'Pantry & Condiments'}]},
  {n:'Hummus & veggies',type:'Snack',cal:120,p:4,c:14,f:6,tags:['Vegan','Vegetarian','Quick'],d:'2 tbsp hummus with carrots, cucumber and peppers.',
    ing:[{n:'Hummus',cat:'Pantry & Condiments'},{n:'Carrots',cat:'Produce'},{n:'Cucumber',cat:'Produce'},{n:'Bell pepper',cat:'Produce'}]},
  {n:'Hard-boiled eggs',type:'Snack',cal:144,p:12,c:1,f:10,tags:['High protein','Low carb','Quick'],d:'Two eggs with salt and pepper.',
    ing:[{n:'Eggs',cat:'Dairy & Eggs'}]},
  {n:'Greek yogurt & almonds',type:'Snack',cal:230,p:24,c:10,f:11,tags:['High protein','Vegetarian'],d:'3/4 cup nonfat Greek yogurt with 10 almonds.',
    ing:[{n:'Greek yogurt',cat:'Dairy & Eggs'},{n:'Almonds',cat:'Pantry & Condiments'}]},
  {n:'Protein shake & banana',type:'Snack',cal:225,p:25,c:30,f:2,tags:['High protein','Quick'],d:'1 scoop protein with water plus a medium banana.',
    ing:[{n:'Protein powder',cat:'Pantry & Condiments'},{n:'Banana',cat:'Produce'}]},
  {n:'Edamame',type:'Snack',cal:120,p:11,c:9,f:5,tags:['Vegan','Vegetarian','High protein'],d:'1 cup steamed edamame with sea salt.',
    ing:[{n:'Edamame',cat:'Frozen & Other'}]},
];
