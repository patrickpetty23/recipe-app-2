# Mise — Complete Feature Map

Full inventory of every feature built, organized by screen. For technical evaluators reviewing the repo.

---

## Screen 1 — Chat (`app/(tabs)/index.jsx`)

| Feature | Description | Technology |
|---|---|---|
| iMessage-style UI | Bubbles, timestamps, smooth keyboard avoid | React Native FlatList, KeyboardAvoidingView |
| Camera recipe capture | Photo → GPT-4o → structured recipe JSON | expo-image-picker, GPT-4o vision |
| URL recipe import | Paste URL → AI strips noise → extracts recipe | GPT-4o, fetch |
| Freeform chat | Conversational cooking assistant | GPT-4o with JSON-mode response routing |
| Recipe save from chat | "Save Recipe" button on AI recipe response | SQLite INSERT |
| Typing indicator | Animated dots while AI responds | Animated.Value |
| Haptic feedback | On send and on receive | expo-haptics |

---

## Screen 2 — Recipe Library (`app/(tabs)/library.jsx`)

| Feature | Description | Technology |
|---|---|---|
| Recipe grid | Cards with AI-generated thumbnail, title, ingredient count | FlatList, Image |
| Full-text search | Live filter across title and cuisine | useState, .filter() |
| Sort options | By date added, A–Z, most ingredients | Array.sort() |
| Swipe to delete | Left-swipe reveals delete button with confirmation | PanResponder |
| Collections row | Horizontal scroll of named collections with emoji | ScrollView |
| Create collection | Modal with name + emoji picker | Modal, TextInput |
| Add to collection | Long-press recipe → pick collection | Alert, addRecipeToCollection() |
| Empty state | Illustrated prompt to add first recipe | EmptyState component |
| Skeleton loaders | Shimmer cards while loading | SkeletonLoader component |

---

## Screen 3 — Recipe Detail (`app/recipe/[id].jsx`)

| Feature | Description | Technology |
|---|---|---|
| Hero image | Full-width top image (AI-generated or camera source) | Image, LinearGradient overlay |
| Gradient overlay | Title readable over any photo | expo-linear-gradient |
| Metadata bar | Prep time, cook time, cuisine, servings sticky on scroll | ScrollView + sticky header |
| Portion scaler | +/− buttons re-scale all ingredient quantities live | scaleIngredients() util |
| Ingredients tab | Checkable ingredient list (local state, not persisted) | useState, animated checkmarks |
| Steps tab | Numbered steps with illustration thumbnails | FlatList |
| Per-step illustration | Tap to generate DALL-E 3 illustration for one step | generateStepIllustration() |
| Nutrition panel | Calorie number + animated macro bars | Animated.Value, MacroBar component |
| Estimate nutrition | "Estimate with AI" button if no nutrition cached | GPT-4o, saveNutrition() |
| Log meal | Tap to log servings to cook_log table with Alert confirm | logCook(), Alert |
| Make it Lighter | AI rewrites recipe with healthier swaps, shows delta | lightenRecipe(), Alert |
| Start Cooking | Navigate to full-screen cooking mode | router.push |
| Share recipe | Native share sheet with formatted text | Share API |
| Edit recipe | Navigate to editor pre-filled | router.push with params |
| Delete recipe | Confirmation alert → cascade delete | deleteRecipe() |
| Add to shopping list | All ingredients added to shopping list | addRecipeToList() |
| Edit inline title | Tap title to edit in place | TextInput, updateRecipe() |

---

## Screen 4 — Cooking Mode (`app/recipe/cooking.jsx`)

| Feature | Description | Technology |
|---|---|---|
| Full-screen dark UI | Immersive mode, screen stays on | expo-keep-awake |
| TTS narration | Reads each step aloud on advance | expo-speech |
| TTS toggle | Volume button mutes/unmutes mid-session | Speech.stop() |
| Swipe to advance | Swipe left = next step, right = previous | PanResponder |
| Tap arrows | Alternative navigation | TouchableOpacity |
| Slide animation | Smooth step transition animation | Animated.timing |
| Progress dots | Visual indicator of position in recipe | steps.map() |
| Step illustrations | Shows DALL-E image if generated | Image |
| Countdown timer | Enter minutes → orange ring countdown | setInterval, CountdownTimer component |
| Timer-done alert | TTS announces "Timer's done!" + haptic | Speech.speak |
| Done screen | Full-screen celebration with checkmark + TTS | Animated.spring, expo-speech |
| Exit | Close button stops TTS and navigates back | Speech.stop(), router.back() |

---

## Screen 5 — Shopping List (`app/(tabs)/list.jsx`)

| Feature | Description | Technology |
|---|---|---|
| Ingredient list | All items added from recipes | SQLite query |
| Animated check-off | Check an item → strikethrough animation | Animated.Value |
| Swipe to delete | Remove individual items | PanResponder |
| Total cost estimate | Sum of Walmart prices for checked items | Walmart API |
| Walmart product cards | Search and view matched products | WalmartProductCard component |
| Add to cart | Send directly to Walmart cart | Walmart API |

---

## Screen 6 — Nutrition Tracker (`app/(tabs)/tracker.jsx`)

| Feature | Description | Technology |
|---|---|---|
| Calorie ring | Circular progress indicator (today vs. goal) | CSS border trick |
| Macro bars | Protein / Carbs / Fat progress vs. personalised goals | MacroBar component |
| Over-goal indicator | Bar turns red when exceeded | conditional style |
| Today's meals | List of logged meals with time, servings, kcal | getCookLogForDate() |
| Delete meal log entry | Swipe / tap to remove from today | deleteCookLogEntry() |
| Recent history | Past meals grouped by date | getRecentCookLog() |
| Goal editor | Modal to set personal calorie and macro targets | Modal, setSetting() |
| Goal persistence | Goals saved across app restarts | getSetting() / setSetting() |
| Focus refresh | Data reloads when tab comes into focus | useFocusEffect |

---

## Background AI Pipeline (fires on every recipe save)

| Task | Model | Timing | Storage |
|---|---|---|---|
| Nutrition estimation | GPT-4o | ~3–8s | recipe_nutrition table |
| Hero thumbnail | DALL-E 3 (1792×1024) | ~15–25s | recipes.image_uri |
| Step illustrations (all parallel) | DALL-E 2 (1024×1024) | ~8–15s | recipe_steps.illustration_url |

All three fire as non-blocking background Promises. Navigation to the recipe detail screen is instant.

---

## Database Schema

| Table | Key columns |
|---|---|
| `recipes` | id, title, source_type, image_uri, servings, prep_time, cook_time, cuisine |
| `ingredients` | id, recipe_id, name, quantity, unit, notes, checked, sort_order |
| `recipe_steps` | id, recipe_id, step_number, instruction, illustration_url |
| `recipe_nutrition` | recipe_id (PK), calories_per_serving, protein_g, carbs_g, fat_g, fiber_g |
| `cook_log` | id, recipe_id, recipe_title, servings, calories, protein_g, carbs_g, fat_g, cooked_at |
| `collections` | id, name, emoji, created_at |
| `recipe_collections` | recipe_id, collection_id (junction) |
| `shopping_list` | (from recipe ingredients + Walmart product data) |
| `chat_messages` | id, role, content, image_uri, created_at, recipe_id |
| `app_settings` | key, value (nutrition goals, etc.) |

---

## Commit History (`feature/android-polish`)

| Commit | Description |
|---|---|
| `511404c` | feat: auto-generate thumbnail + step illustrations on recipe save |
| `c620993` | chore: fix .gitignore to properly exclude .env files |
| `c28f5f3` | fix: resolve 4 bugs (PanResponder stale closure, TTS re-enable, OpenAI null safety) |
| `ba76374` | feat: Milestone 5 — Nutrition tracking, voice cooking & timers |
| `bdeea86` | Update package-lock.json after expo install |
| `11f2bd1` | Milestone 4: Editor redesign, Collections, warm colour theme |
| `12c5bf4` | Milestone 3: Recipe detail redesign + cooking mode |
| `01df33e` | Milestone 2: Replace home tab with iMessage-style chat screen |
| `1937504` | Milestone 1: schema, queries, openai — full recipe extraction + chat + DALL-E |
