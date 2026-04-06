import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Share,
  Platform,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  getRecipeById,
  updateRecipe,
  updateIngredient,
  deleteRecipe,
  addRecipeToList,
  updateStepIllustration,
  getNutrition,
  saveNutrition,
  logCook,
} from '../../src/db/queries';
import { scaleIngredients } from '../../src/utils/scaler';
import { generateStepIllustration, generateAllStepIllustrations, estimateNutrition, lightenRecipe } from '../../src/services/openai';
import { logger } from '../../src/utils/logger';
import * as Crypto from 'expo-crypto';

const HERO_HEIGHT = 250;

function MacroBar({ label, grams, color, max }) {
  if (grams == null) return null;
  const pct = Math.min(1, grams / max);
  return (
    <View style={macroStyles.row}>
      <Text style={macroStyles.label}>{label}</Text>
      <View style={macroStyles.track}>
        <View style={[macroStyles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={macroStyles.value}>{grams}g</Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { width: 52, fontSize: 12, fontWeight: '600', color: '#6B4C2A' },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#F0E0D0', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 36, fontSize: 12, color: '#B38B6D', textAlign: 'right' },
});

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [lastServings, setLastServings] = useState(1);
  const [currentServings, setCurrentServings] = useState(1);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients' | 'steps'
  const [editMode, setEditMode] = useState(false);
  // local check state (cooking reference only — not persisted)
  const [checked, setChecked] = useState({});
  // per-step illustration loading
  const [generatingStep, setGeneratingStep] = useState(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  // nutrition
  const [nutrition, setNutrition] = useState(null);
  const [estimatingNutrition, setEstimatingNutrition] = useState(false);
  // lightening
  const [lightening, setLightening] = useState(false);

  // Animated values for checked items
  const checkAnims = useRef(new Map()).current;
  useFocusEffect(
    useCallback(() => {
      loadRecipe();
    }, [id])
  );

  function loadRecipe() {
    setLoading(true);
    try {
      const data = getRecipeById(id);
      if (!data) {
        Alert.alert('Not Found', 'This recipe no longer exists.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setRecipe(data);
      setTitle(data.title);
      setIngredients(data.ingredients || []);
      const loadedSteps = data.steps || [];
      setSteps(loadedSteps);
      setLastServings(data.servings || 1);
      setCurrentServings(data.servings || 1);
      setChecked({});
      // Load nutrition
      const ntr = getNutrition(id);
      setNutrition(ntr);
      logger.info('recipeDetail.load', {
        id,
        ingredientCount: (data.ingredients || []).length,
        stepCount: loadedSteps.length,
      });
      // Auto-generate illustrations for any steps that don't have one yet
      const stepsNeedingIllustration = loadedSteps.filter((s) => !s.illustrationUrl);
      if (stepsNeedingIllustration.length > 0) {
        setAutoGenerating(true);
        generateAllStepIllustrations(stepsNeedingIllustration, data.title, data.ingredients)
          .then((fulfilled) => {
            fulfilled.forEach(({ stepId, url }) => updateStepIllustration(stepId, url));
            setSteps((prev) =>
              prev.map((s) => {
                const hit = fulfilled.find((f) => f.stepId === s.id);
                return hit ? { ...s, illustrationUrl: hit.url } : s;
              })
            );
            logger.info('recipeDetail.autoIllustrate.done', { count: fulfilled.length });
          })
          .catch((err) =>
            logger.error('recipeDetail.autoIllustrate.error', { error: err.message })
          )
          .finally(() => setAutoGenerating(false));
      }
    } catch (err) {
      logger.error('recipeDetail.load.error', { id, error: err.message });
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Servings stepper ──────────────────────────────────────────────────────────

  function stepServings(delta) {
    const next = Math.max(1, currentServings + delta);
    if (next === currentServings) return;
    const multiplier = next / currentServings;
    setIngredients((prev) => scaleIngredients(prev, multiplier));
    setCurrentServings(next);
    setLastServings(next);
    if (editMode) {
      try {
        updateRecipe(id, { servings: next });
      } catch (err) {
        logger.error('recipeDetail.updateServings.error', { id, error: err.message });
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // ── Title edit ────────────────────────────────────────────────────────────────

  function handleTitleSave(text) {
    const trimmed = text.trim() || title;
    setTitle(trimmed);
    try {
      updateRecipe(id, { title: trimmed });
    } catch (err) {
      logger.error('recipeDetail.updateTitle.error', { id, error: err.message });
    }
  }

  // ── Ingredient check (local only) ─────────────────────────────────────────────

  function toggleCheck(itemId) {
    if (!checkAnims.has(itemId)) {
      checkAnims.set(itemId, new Animated.Value(checked[itemId] ? 1 : 0));
    }
    const anim = checkAnims.get(itemId);
    const next = !checked[itemId];
    setChecked((prev) => ({ ...prev, [itemId]: next }));
    Animated.spring(anim, {
      toValue: next ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 8,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function getCheckAnim(itemId) {
    if (!checkAnims.has(itemId)) {
      checkAnims.set(itemId, new Animated.Value(checked[itemId] ? 1 : 0));
    }
    return checkAnims.get(itemId);
  }

  // ── Ingredient inline edit ────────────────────────────────────────────────────

  function handleUpdateIngredient(index, field, value) {
    const ing = ingredients[index];
    setIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    try {
      updateIngredient(ing.id, { [field]: value });
    } catch (err) {
      logger.error('recipeDetail.updateIngredient.error', { ingredientId: ing.id, error: err.message });
    }
  }

  // ── Add to shopping list ──────────────────────────────────────────────────────

  function handleAddToList() {
    try {
      addRecipeToList(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Added!', 'All ingredients added to your shopping list.', [
        { text: 'View List', onPress: () => router.push('/(tabs)/list') },
        { text: 'Stay Here', style: 'cancel' },
      ]);
      logger.info('recipeDetail.addToList', { id });
    } catch (err) {
      logger.error('recipeDetail.addToList.error', { id, error: err.message });
      Alert.alert('Error', err.message);
    }
  }

  // ── Generate illustration ─────────────────────────────────────────────────────

  async function handleGenerateIllustration(step) {
    if (generatingStep) return;
    setGeneratingStep(step.id);
    try {
      const url = await generateStepIllustration(step.instruction, recipe.title, steps, ingredients);
      updateStepIllustration(step.id, url);
      setSteps((prev) =>
        prev.map((s) => (s.id === step.id ? { ...s, illustrationUrl: url } : s))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logger.info('recipeDetail.generateIllustration.success', { stepId: step.id });
    } catch (err) {
      logger.error('recipeDetail.generateIllustration.error', { stepId: step.id, error: err.message });
      Alert.alert('Generation Failed', err.message);
    } finally {
      setGeneratingStep(null);
    }
  }

  // ── Nutrition estimation ──────────────────────────────────────────────────────

  async function handleEstimateNutrition() {
    if (estimatingNutrition || ingredients.length === 0) return;
    setEstimatingNutrition(true);
    try {
      const result = await estimateNutrition(ingredients, currentServings);
      saveNutrition(id, result);
      setNutrition({ ...result, recipeId: id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logger.info('recipeDetail.estimateNutrition.success', { id });
    } catch (err) {
      logger.error('recipeDetail.estimateNutrition.error', { id, error: err.message });
      Alert.alert('Estimation Failed', err.message);
    } finally {
      setEstimatingNutrition(false);
    }
  }

  // ── Log meal ──────────────────────────────────────────────────────────────────

  function handleLogMeal() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const scaledCalories = nutrition
      ? Math.round(nutrition.calories * currentServings)
      : null;
    Alert.alert(
      'Log Meal',
      `Log ${currentServings} serving${currentServings !== 1 ? 's' : ''} of ${recipe.title}?${scaledCalories ? `\n${scaledCalories} kcal` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log It',
          onPress: () => {
            try {
              logCook({
                id: Crypto.randomUUID(),
                recipeId: id,
                recipeTitle: recipe.title,
                servings: currentServings,
                calories: nutrition ? Math.round(nutrition.calories * currentServings) : null,
                protein: nutrition ? Math.round(nutrition.protein * currentServings * 10) / 10 : null,
                carbs: nutrition ? Math.round(nutrition.carbs * currentServings * 10) / 10 : null,
                fat: nutrition ? Math.round(nutrition.fat * currentServings * 10) / 10 : null,
                cookedAt: new Date().toISOString(),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Logged!', 'Added to your nutrition tracker.');
              logger.info('recipeDetail.logMeal', { id });
            } catch (err) {
              logger.error('recipeDetail.logMeal.error', { id, error: err.message });
            }
          },
        },
      ]
    );
  }

  // ── Make it lighter ───────────────────────────────────────────────────────────

  async function handleLighten() {
    if (lightening) return;
    setLightening(true);
    try {
      const result = await lightenRecipe({
        title: recipe.title,
        servings: currentServings,
        cuisine: recipe.cuisine,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        ingredients,
        steps,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Show the changes summary then navigate to editor with lightened recipe
      const changesSummary = (result.changes ?? []).slice(0, 3).join('\n');
      const calDelta = (result.originalCalories ?? 0) - (result.lightenedCalories ?? 0);
      Alert.alert(
        `Save ${calDelta > 0 ? `−${calDelta} kcal` : 'lighter'} version?`,
        changesSummary || 'Ingredient substitutions applied.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open in Editor',
            onPress: () =>
              router.push({
                pathname: '/recipe/editor',
                params: {
                  recipeData: JSON.stringify({ ...result.recipe, title: `${result.recipe.title ?? recipe.title} (Lighter)` }),
                  sourceType: recipe.sourceType ?? 'chat',
                  imageUri: recipe.imageUri ?? '',
                },
              }),
          },
        ]
      );
      logger.info('recipeDetail.lighten.success', { id, calDelta });
    } catch (err) {
      logger.error('recipeDetail.lighten.error', { id, error: err.message });
      Alert.alert('Failed', err.message);
    } finally {
      setLightening(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  function handleDelete() {
    Alert.alert(
      'Delete Recipe',
      `Delete "${recipe.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteRecipe(id);
              logger.info('recipeDetail.delete', { id });
              router.replace('/(tabs)/library');
            } catch (err) {
              logger.error('recipeDetail.delete.error', { id, error: err.message });
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  // ── Share ─────────────────────────────────────────────────────────────────────

  async function handleShare() {
    const lines = [`${recipe.title}\n`];
    if (recipe.prepTime || recipe.cookTime) {
      if (recipe.prepTime) lines.push(`Prep: ${recipe.prepTime}`);
      if (recipe.cookTime) lines.push(`Cook: ${recipe.cookTime}`);
      lines.push('');
    }
    lines.push(`Serves: ${currentServings}\n`);
    if (ingredients.length > 0) {
      lines.push('Ingredients:');
      ingredients.forEach((ing) => {
        const qty = ing.quantity != null ? String(Math.round(ing.quantity * 100) / 100) : '';
        const unit = ing.unit ? ` ${ing.unit}` : '';
        lines.push(`• ${qty}${unit} ${ing.name}`.trim());
      });
      lines.push('');
    }
    if (steps.length > 0) {
      lines.push('Steps:');
      steps.forEach((s) => lines.push(`${s.stepNumber}. ${s.instruction}`));
    }
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (err) {
      logger.error('recipeDetail.share.error', { id, error: err.message });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Recipe not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {recipe.imageUri ? (
            <>
              <Image
                source={{ uri: recipe.imageUri }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.72)']}
                style={styles.heroGradient}
              />
            </>
          ) : (
            <LinearGradient
              colors={['#FF9A3C', '#E8622A']}
              style={styles.heroPlaceholder}
            >
              <Ionicons name="restaurant" size={64} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          )}

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.backBtnInner}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Header actions */}
          <View style={[styles.heroActions, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.heroBtnCircle}
              onPress={handleShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroBtnCircle}
              onPress={() => {
                setEditMode((e) => !e);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={editMode ? 'checkmark' : 'pencil'} size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroBtnCircle, styles.heroBtnDelete]}
              onPress={handleDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Title overlay */}
          <View style={styles.heroTitleContainer}>
            {editMode ? (
              <TextInput
                style={styles.heroTitleInput}
                value={title}
                onChangeText={setTitle}
                onBlur={() => handleTitleSave(title)}
                multiline
                returnKeyType="done"
                blurOnSubmit
              />
            ) : (
              <Text style={styles.heroTitle} numberOfLines={3}>
                {title}
              </Text>
            )}
          </View>
        </View>

        {/* ── Metadata row (sticky) ── */}
        <View style={styles.metaBar}>
          {recipe.prepTime ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#636366" />
              <Text style={styles.metaLabel}>Prep</Text>
              <Text style={styles.metaValue}>{recipe.prepTime}</Text>
            </View>
          ) : null}
          {recipe.cookTime ? (
            <View style={styles.metaItem}>
              <Ionicons name="flame-outline" size={14} color="#636366" />
              <Text style={styles.metaLabel}>Cook</Text>
              <Text style={styles.metaValue}>{recipe.cookTime}</Text>
            </View>
          ) : null}

          {/* Servings stepper */}
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color="#636366" />
            <Text style={styles.metaLabel}>Serves</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => stepServings(-1)}
                disabled={currentServings <= 1}
              >
                <Text style={[styles.stepperBtnText, currentServings <= 1 && styles.stepperBtnDisabled]}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{currentServings}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => stepServings(1)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {recipe.cuisine ? (
            <View style={styles.cuisineBadge}>
              <Text style={styles.cuisineBadgeText}>{recipe.cuisine}</Text>
            </View>
          ) : null}
          {recipe.sourceUrl ? (
            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={() => Linking.openURL(recipe.sourceUrl)}
            >
              <Ionicons name="link-outline" size={13} color="#007AFF" />
              <Text style={styles.sourceBtnText}>View Source</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Nutrition panel ── */}
        <View style={styles.nutritionCard}>
          <View style={styles.nutritionHeader}>
            <Text style={styles.nutritionTitle}>Nutrition</Text>
            <Text style={styles.nutritionSub}>per serving · {currentServings} serving{currentServings !== 1 ? 's' : ''}</Text>
          </View>

          {nutrition ? (
            <>
              <Text style={styles.calorieNumber}>{nutrition.calories ?? '—'} <Text style={styles.calorieUnit}>kcal</Text></Text>
              <View style={styles.macroRows}>
                <MacroBar label="Protein" grams={nutrition.protein} color="#FF6B35" max={50} />
                <MacroBar label="Carbs" grams={nutrition.carbs} color="#F59E0B" max={100} />
                <MacroBar label="Fat" grams={nutrition.fat} color="#6B4C2A" max={40} />
                {nutrition.fiber != null && <MacroBar label="Fiber" grams={nutrition.fiber} color="#34C759" max={15} />}
              </View>
              <View style={styles.nutritionActions}>
                <TouchableOpacity style={styles.logMealBtn} onPress={handleLogMeal} activeOpacity={0.85}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <Text style={styles.logMealText}>Log Meal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.lightenBtn, lightening && styles.lightenBtnBusy]}
                  onPress={handleLighten}
                  disabled={lightening}
                  activeOpacity={0.85}
                >
                  {lightening
                    ? <ActivityIndicator size="small" color="#FF6B35" />
                    : <><Ionicons name="leaf-outline" size={16} color="#FF6B35" /><Text style={styles.lightenText}>Make it Lighter</Text></>
                  }
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.nutritionEmpty}>
              {estimatingNutrition ? (
                <>
                  <ActivityIndicator size="small" color="#FF6B35" />
                  <Text style={styles.nutritionEmptyText}>Estimating nutrition…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nutritionEmptyText}>Nutrition not estimated yet</Text>
                  <TouchableOpacity style={styles.estimateBtn} onPress={handleEstimateNutrition}>
                    <Ionicons name="sparkles-outline" size={14} color="#FF6B35" />
                    <Text style={styles.estimateBtnText}>Estimate with AI</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
            onPress={() => setActiveTab('ingredients')}
          >
            <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
              Ingredients ({ingredients.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'steps' && styles.tabActive]}
            onPress={() => setActiveTab('steps')}
          >
            <Text style={[styles.tabText, activeTab === 'steps' && styles.tabTextActive]}>
              Steps ({steps.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Ingredients tab ── */}
        {activeTab === 'ingredients' && (
          <View style={styles.tabContent}>
            {ingredients.map((item, index) => {
              const anim = getCheckAnim(item.id);
              const isChecked = !!checked[item.id];
              const bgColor = anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['#fff', '#E8F5E9'],
              });
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleCheck(item.id)}
                  activeOpacity={0.7}
                >
                  <Animated.View style={[styles.ingredientRow, { backgroundColor: bgColor }]}>
                    {/* Round checkbox */}
                    <Animated.View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['#fff', '#34C759'],
                          }),
                          borderColor: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['#C7C7CC', '#34C759'],
                          }),
                        },
                      ]}
                    >
                      {isChecked && (
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      )}
                    </Animated.View>

                    <View style={styles.ingredientContent}>
                      {editMode ? (
                        <View style={styles.ingredientEditRow}>
                          <TextInput
                            style={styles.editQtyInput}
                            value={item.quantity != null ? String(Math.round(item.quantity * 100) / 100) : ''}
                            onChangeText={(val) => {
                              const num = parseFloat(val);
                              handleUpdateIngredient(index, 'quantity', isNaN(num) ? null : num);
                            }}
                            keyboardType="decimal-pad"
                            placeholder="Qty"
                            placeholderTextColor="#C7C7CC"
                          />
                          <TextInput
                            style={styles.editUnitInput}
                            value={item.unit || ''}
                            onChangeText={(val) => handleUpdateIngredient(index, 'unit', val || null)}
                            placeholder="Unit"
                            placeholderTextColor="#C7C7CC"
                          />
                          <TextInput
                            style={styles.editNameInput}
                            value={item.name}
                            onChangeText={(val) => handleUpdateIngredient(index, 'name', val)}
                            placeholder="Ingredient"
                            placeholderTextColor="#C7C7CC"
                          />
                        </View>
                      ) : (
                        <View style={styles.ingredientViewRow}>
                          <Animated.Text
                            style={[
                              styles.ingredientName,
                              {
                                color: anim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['#2D1B00', '#B38B6D'],
                                }),
                              },
                            ]}
                          >
                            {item.name}
                          </Animated.Text>
                          {(item.quantity != null || item.unit) ? (
                            <Text style={[styles.ingredientQty, isChecked && styles.ingredientQtyChecked]}>
                              {item.quantity != null ? String(Math.round(item.quantity * 100) / 100) : ''}
                              {item.unit ? ` ${item.unit}` : ''}
                            </Text>
                          ) : null}
                        </View>
                      )}
                      {item.notes ? (
                        <Text style={styles.ingredientNotes}>{item.notes}</Text>
                      ) : null}
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}

            {/* Add to Shopping List button */}
            <View style={styles.listButtonContainer}>
              <TouchableOpacity style={styles.listButton} onPress={handleAddToList} activeOpacity={0.85}>
                <Ionicons name="cart-outline" size={20} color="#fff" />
                <Text style={styles.listButtonText}>Add to Shopping List</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Steps tab ── */}
        {activeTab === 'steps' && (
          <View style={styles.tabContent}>
            {autoGenerating && (
              <View style={styles.generatingBanner}>
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text style={styles.generatingBannerText}>
                  Generating illustrations, est. 1 min…
                </Text>
              </View>
            )}
            {steps.length === 0 ? (
              <View style={styles.emptySteps}>
                <Ionicons name="list-outline" size={40} color="#C7C7CC" />
                <Text style={styles.emptyStepsText}>No steps saved for this recipe.</Text>
              </View>
            ) : (
              steps.map((step) => (
                <View key={step.id} style={styles.stepRow}>
                  <View style={styles.stepNumberCircle}>
                    <Text style={styles.stepNumber}>{step.stepNumber}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>

                    {/* Illustration area */}
                    {step.illustrationUrl ? (
                      <Image
                        source={{ uri: step.illustrationUrl }}
                        style={styles.stepIllustration}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.stepIllustrationPlaceholder}>
                        {autoGenerating || generatingStep === step.id ? (
                          <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                          <>
                            <Ionicons name="image-outline" size={28} color="#C7C7CC" />
                            <TouchableOpacity
                              style={styles.generateBtn}
                              onPress={() => handleGenerateIllustration(step)}
                              disabled={!!generatingStep}
                            >
                              <Ionicons name="sparkles-outline" size={14} color="#007AFF" />
                              <Text style={styles.generateBtnText}>Retry</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
            {/* Spacer for FAB */}
            <View style={{ height: 80 }} />
          </View>
        )}
      </ScrollView>

      {/* ── Floating "Start Cooking" button ── */}
      {steps.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({ pathname: '/recipe/cooking', params: { id } });
          }}
          activeOpacity={0.88}
        >
          <Ionicons name="flame" size={22} color="#fff" />
          <Text style={styles.fabText}>Start Cooking</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
  },
  emptyText: {
    fontSize: 16,
    color: '#B38B6D',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: '#2D1B00',
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.65,
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 8,
    left: 16,
  },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    position: 'absolute',
    top: 8,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  heroBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnDelete: {
    backgroundColor: 'rgba(255,59,48,0.5)',
  },
  heroTitleContainer: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTitleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 4,
  },

  // ── Metadata bar ──────────────────────────────────────────────────────────────
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
    // elevation for sticky
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: '#B38B6D',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D1B00',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B35',
    lineHeight: 22,
  },
  stepperBtnDisabled: {
    color: '#C7C7CC',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D1B00',
    minWidth: 24,
    textAlign: 'center',
  },
  cuisineBadge: {
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cuisineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B35',
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  sourceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#FF6B35',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#B38B6D',
  },
  tabTextActive: {
    color: '#FF6B35',
  },

  // ── Tab content ───────────────────────────────────────────────────────────────
  tabContent: {
    backgroundColor: '#fff',
  },

  // ── Ingredients ───────────────────────────────────────────────────────────────
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFF8F0',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientName: {
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
  },
  ingredientQty: {
    fontSize: 14,
    color: '#6B4C2A',
    fontWeight: '500',
    marginLeft: 8,
  },
  ingredientQtyChecked: {
    color: '#C7C7CC',
  },
  ingredientNotes: {
    fontSize: 13,
    color: '#B38B6D',
    marginTop: 2,
  },
  ingredientEditRow: {
    flexDirection: 'row',
    gap: 6,
  },
  editQtyInput: {
    width: 52,
    borderWidth: 1,
    borderColor: '#F0E0D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 14,
    textAlign: 'center',
    color: '#2D1B00',
    backgroundColor: '#FAFAFA',
  },
  editUnitInput: {
    width: 64,
    borderWidth: 1,
    borderColor: '#F0E0D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 14,
    color: '#2D1B00',
    backgroundColor: '#FAFAFA',
  },
  editNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F0E0D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 14,
    color: '#2D1B00',
    backgroundColor: '#FAFAFA',
  },
  listButtonContainer: {
    padding: 16,
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    elevation: 2,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  listButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Steps ─────────────────────────────────────────────────────────────────────
  emptySteps: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStepsText: {
    fontSize: 15,
    color: '#B38B6D',
  },
  stepRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFF8F0',
    gap: 14,
    alignItems: 'flex-start',
  },
  stepNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    gap: 12,
  },
  stepInstruction: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2D1B00',
  },
  stepIllustration: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
  },
  stepIllustrationPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF0E8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  generatingBannerText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
    flexShrink: 1,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  generateBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
  },

  // ── Nutrition card ────────────────────────────────────────────────────────────
  nutritionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  nutritionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D1B00',
  },
  nutritionSub: {
    fontSize: 11,
    color: '#B38B6D',
  },
  calorieNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2D1B00',
    marginBottom: 12,
  },
  calorieUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: '#B38B6D',
  },
  macroRows: {
    marginBottom: 14,
  },
  nutritionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  logMealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 10,
    elevation: 2,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  logMealText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  lightenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF0E8',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F0E0D0',
  },
  lightenBtnBusy: { opacity: 0.6 },
  lightenText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  nutritionEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  nutritionEmptyText: {
    fontSize: 13,
    color: '#B38B6D',
    flex: 1,
  },
  estimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0E0D0',
  },
  estimateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },

  // ── FAB ───────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'android' ? 20 : 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
