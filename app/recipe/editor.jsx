import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { scaleIngredients } from '../../src/utils/scaler';
import {
  saveRecipe, saveIngredients, saveRecipeSteps, saveNutrition, updateRecipeImageUri,
  updateStepIllustration,
} from '../../src/db/queries';
import {
  estimateNutrition,
  generateRecipeThumbnail,
} from '../../src/services/openai';
import { logger } from '../../src/utils/logger';

// ── Warm theme ────────────────────────────────────────────────────────────────
const C = {
  orange: '#FF6B35',
  orangeLight: '#FFF0E8',
  bg: '#FFF8F0',
  surface: '#FFFFFF',
  textDark: '#2D1B00',
  textMed: '#6B4C2A',
  textFaint: '#B38B6D',
  border: '#F0E0D0',
};

export default function EditorScreen() {
  const router = useRouter();
  const { recipeData: recipeDataJson, sourceType, imageUri } = useLocalSearchParams();

  const parsed = useMemo(() => {
    try {
      return JSON.parse(recipeDataJson) ?? {};
    } catch {
      return {};
    }
  }, [recipeDataJson]);

  const [title, setTitle] = useState(parsed.title || 'New Recipe');
  const [lastServings, setLastServings] = useState(parsed.servings || 1);
  const [currentServings, setCurrentServings] = useState(String(parsed.servings || 1));
  const [prepTime, setPrepTime] = useState(parsed.prepTime || '');
  const [cookTime, setCookTime] = useState(parsed.cookTime || '');
  const [cuisine, setCuisine] = useState(parsed.cuisine || '');
  const [ingredients, setIngredients] = useState(parsed.ingredients || []);
  const [steps, setSteps] = useState(
    (parsed.steps || []).map((s) => ({ ...s, localId: Crypto.randomUUID() }))
  );
  const [saving, setSaving] = useState(false);
  const [illustrating, setIllustrating] = useState(false);
  const [illustrateProgress, setIllustrateProgress] = useState({ done: 0, total: 0 });

  // ── Servings ──────────────────────────────────────────────────────────────────

  function handleServingsChange(text) {
    setCurrentServings(text);
    const num = parseFloat(text);
    if (!num || num <= 0) return;
    const multiplier = num / lastServings;
    setIngredients((prev) => scaleIngredients(prev, multiplier));
    setLastServings(num);
  }

  // ── Ingredients ───────────────────────────────────────────────────────────────

  function handleUpdateIngredient(index, field, value) {
    setIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  // ── Steps ─────────────────────────────────────────────────────────────────────

  function handleUpdateStep(localId, instruction) {
    setSteps((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, instruction } : s))
    );
  }

  function handleAddStep() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSteps((prev) => [
      ...prev,
      {
        localId: Crypto.randomUUID(),
        stepNumber: prev.length + 1,
        instruction: '',
        illustrationUrl: null,
      },
    ]);
  }

  function handleRemoveStep(localId) {
    setSteps((prev) => {
      const filtered = prev.filter((s) => s.localId !== localId);
      return filtered.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  }

  // ── Generate illustrations ────────────────────────────────────────────────────

  async function handleGenerateIllustrations() {
    const stepsToIllustrate = steps.filter(
      (s) => !s.illustrationUrl && s.instruction.trim().length > 0
    );
    if (stepsToIllustrate.length === 0) {
      Alert.alert('Nothing to generate', 'All steps already have illustrations or have no instruction text.');
      return;
    }

    const recipeTitleForAI = title.trim() || 'Recipe';
    setIllustrating(true);
    setIllustrateProgress({ done: 0, total: stepsToIllustrate.length });

    for (let i = 0; i < stepsToIllustrate.length; i++) {
      const step = stepsToIllustrate[i];
      try {
        const url = await generateStepIllustration(step.instruction, recipeTitleForAI);
        setSteps((prev) =>
          prev.map((s) => (s.localId === step.localId ? { ...s, illustrationUrl: url } : s))
        );
        logger.info('editor.generateIllustration.success', { stepNumber: step.stepNumber });
      } catch (err) {
        logger.error('editor.generateIllustration.error', { stepNumber: step.stepNumber, error: err.message });
      }
      setIllustrateProgress({ done: i + 1, total: stepsToIllustrate.length });
    }

    setIllustrating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const recipeId = Crypto.randomUUID();
      const now = new Date().toISOString();
      const servings = parseFloat(currentServings) || 1;

      const recipe = {
        id: recipeId,
        title: title.trim() || 'New Recipe',
        sourceType: sourceType || 'camera',
        sourceUri: null,
        sourceUrl: parsed.sourceUrl ?? null,
        imageUri: imageUri || null,
        servings,
        instructions: null,
        prepTime: prepTime.trim() || null,
        cookTime: cookTime.trim() || null,
        cuisine: cuisine.trim() || null,
        createdAt: now,
        updatedAt: now,
      };

      const ingredientsToSave = ingredients.map((ing, i) => ({
        id: Crypto.randomUUID(),
        recipeId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit || null,
        notes: ing.notes || null,
        checked: false,
        sortOrder: i,
      }));

      const stepsToSave = steps
        .filter((s) => s.instruction.trim().length > 0)
        .map((s, i) => ({
          id: Crypto.randomUUID(),
          recipeId,
          stepNumber: i + 1,
          instruction: s.instruction,
          illustrationUrl: s.illustrationUrl ?? null,
        }));

      saveRecipe(recipe);
      saveIngredients(recipeId, ingredientsToSave);
      if (stepsToSave.length > 0) saveRecipeSteps(recipeId, stepsToSave);

      logger.info('editor.saveRecipe.success', {
        recipeId,
        ingredientCount: ingredientsToSave.length,
        stepCount: stepsToSave.length,
      });

      // ── Background AI tasks (non-blocking — navigate immediately) ────────────

      // 1. Estimate nutrition
      if (ingredientsToSave.length > 0) {
        estimateNutrition(ingredientsToSave, servings)
          .then((ntr) => {
            saveNutrition(recipeId, ntr);
            logger.info('editor.nutritionEstimated', { recipeId, calories: ntr.calories });
          })
          .catch((err) => {
            logger.error('editor.nutritionEstimation.error', { recipeId, error: err.message });
          });
      }

      // 2. Generate hero thumbnail (DALL-E 3 landscape) — always generate so every
      //    recipe card has a beautiful food photo, even for text/URL imports
      generateRecipeThumbnail(recipe.title, recipe.cuisine, ingredientsToSave)
        .then((url) => {
          updateRecipeImageUri(recipeId, url);
          logger.info('editor.thumbnailGenerated', { recipeId });
        })
        .catch((err) => {
          logger.error('editor.thumbnailGeneration.error', { recipeId, error: err.message });
        });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/recipe/${recipeId}`);
    } catch (err) {
      logger.error('editor.saveRecipe.error', { error: err.message });
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    Alert.alert('Discard Recipe?', 'Your changes will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard}>
          <Text style={styles.headerCancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Recipe</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={C.orange} />
          ) : (
            <Text style={styles.headerSave}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Source image */}
        {imageUri ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.sourceImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recipe Title</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Recipe name"
            placeholderTextColor={C.textFaint}
            returnKeyType="done"
          />
        </View>

        {/* Meta row: prep / cook / servings */}
        <View style={styles.section}>
          <View style={styles.metaRow}>
            <View style={styles.metaField}>
              <Text style={styles.sectionLabel}>Prep Time</Text>
              <TextInput
                style={styles.metaInput}
                value={prepTime}
                onChangeText={setPrepTime}
                placeholder="e.g. 15 min"
                placeholderTextColor={C.textFaint}
                returnKeyType="done"
              />
            </View>
            <View style={styles.metaField}>
              <Text style={styles.sectionLabel}>Cook Time</Text>
              <TextInput
                style={styles.metaInput}
                value={cookTime}
                onChangeText={setCookTime}
                placeholder="e.g. 30 min"
                placeholderTextColor={C.textFaint}
                returnKeyType="done"
              />
            </View>
            <View style={styles.metaField}>
              <Text style={styles.sectionLabel}>Servings</Text>
              <TextInput
                style={[styles.metaInput, styles.metaInputCenter]}
                value={currentServings}
                onChangeText={handleServingsChange}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={C.textFaint}
              />
            </View>
          </View>

          {/* Cuisine chip */}
          <View style={styles.cuisineRow}>
            <Text style={styles.sectionLabel}>Cuisine</Text>
            {cuisine ? (
              <TouchableOpacity
                style={styles.cuisineChip}
                onPress={() => setCuisine('')}
              >
                <Text style={styles.cuisineChipText}>{cuisine}</Text>
                <Ionicons name="close-circle" size={14} color={C.orange} />
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.cuisineInput}
                value={cuisine}
                onChangeText={setCuisine}
                placeholder="e.g. Italian"
                placeholderTextColor={C.textFaint}
                returnKeyType="done"
              />
            )}
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>
              Ingredients ({ingredients.length})
            </Text>
          </View>
          {ingredients.map((item, index) => (
            <View key={index} style={styles.ingredientRow}>
              <TextInput
                style={styles.qtyInput}
                value={item.quantity != null ? String(item.quantity) : ''}
                onChangeText={(val) => {
                  const num = parseFloat(val);
                  handleUpdateIngredient(index, 'quantity', isNaN(num) ? null : num);
                }}
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={C.textFaint}
              />
              <TextInput
                style={styles.unitInput}
                value={item.unit || ''}
                onChangeText={(val) => handleUpdateIngredient(index, 'unit', val || null)}
                placeholder="Unit"
                placeholderTextColor={C.textFaint}
              />
              <TextInput
                style={styles.nameInput}
                value={item.name}
                onChangeText={(val) => handleUpdateIngredient(index, 'name', val)}
                placeholder="Ingredient"
                placeholderTextColor={C.textFaint}
              />
            </View>
          ))}
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Steps ({steps.length})</Text>
            {steps.length > 0 && (
              <TouchableOpacity
                style={[styles.illustrateBtn, illustrating && styles.illustrateBtnBusy]}
                onPress={handleGenerateIllustrations}
                disabled={illustrating}
              >
                {illustrating ? (
                  <>
                    <ActivityIndicator size="small" color={C.orange} />
                    <Text style={styles.illustrateBtnText}>
                      {illustrateProgress.done}/{illustrateProgress.total}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={14} color={C.orange} />
                    <Text style={styles.illustrateBtnText}>Generate Illustrations</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {steps.map((step) => (
            <View key={step.localId} style={styles.stepRow}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>{step.stepNumber}</Text>
              </View>
              <TextInput
                style={styles.stepInput}
                value={step.instruction}
                onChangeText={(val) => handleUpdateStep(step.localId, val)}
                placeholder="Describe this step…"
                placeholderTextColor={C.textFaint}
                multiline
              />
              {step.illustrationUrl ? (
                <Ionicons name="image" size={20} color="#34C759" />
              ) : null}
              <TouchableOpacity
                onPress={() => handleRemoveStep(step.localId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={20} color={C.textFaint} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addStepBtn} onPress={handleAddStep}>
            <Ionicons name="add-circle-outline" size={18} color={C.orange} />
            <Text style={styles.addStepText}>Add Step</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom save button */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonBusy]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save Recipe</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerCancel: {
    color: C.textMed,
    fontSize: 17,
  },
  headerSave: {
    color: C.orange,
    fontSize: 17,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.textDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Image ─────────────────────────────────────────────────────────────────────
  imageContainer: {
    padding: 16,
    paddingBottom: 0,
    alignItems: 'center',
  },
  sourceImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: C.border,
  },

  // ── Sections ──────────────────────────────────────────────────────────────────
  section: {
    backgroundColor: C.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#2D1B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textDark,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 8,
  },

  // ── Meta row ──────────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metaField: {
    flex: 1,
  },
  metaInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: C.textDark,
    backgroundColor: C.bg,
  },
  metaInputCenter: {
    textAlign: 'center',
  },
  cuisineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cuisineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orangeLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  cuisineChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.orange,
  },
  cuisineInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: C.textDark,
    backgroundColor: C.bg,
  },

  // ── Ingredients ───────────────────────────────────────────────────────────────
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 8,
  },
  qtyInput: {
    width: 52,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center',
    color: C.textDark,
    backgroundColor: C.bg,
  },
  unitInput: {
    width: 62,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    color: C.textDark,
    backgroundColor: C.bg,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: C.textDark,
    backgroundColor: C.bg,
  },

  // ── Steps ─────────────────────────────────────────────────────────────────────
  illustrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.orangeLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  illustrateBtnBusy: {
    opacity: 0.7,
  },
  illustrateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.orange,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 10,
  },
  stepNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  stepInput: {
    flex: 1,
    fontSize: 15,
    color: C.textDark,
    lineHeight: 22,
    paddingVertical: 2,
    minHeight: 44,
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  addStepText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.orange,
  },

  // ── Save ──────────────────────────────────────────────────────────────────────
  saveSection: {
    padding: 16,
    paddingTop: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.orange,
    borderRadius: 16,
    paddingVertical: 16,
    elevation: 3,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  saveButtonBusy: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
