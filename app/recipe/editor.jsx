import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';

import { scaleIngredients } from '../../src/utils/scaler';
import { saveRecipe, saveIngredients } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

export default function EditorScreen() {
  const router = useRouter();
  const {
    ingredients: ingredientsJson,
    sourceType,
    title: paramTitle,
    instructions: instructionsJson,
  } = useLocalSearchParams();

  const parsed = useMemo(() => {
    try { return JSON.parse(ingredientsJson); } catch { return []; }
  }, [ingredientsJson]);

  const parsedInstructions = useMemo(() => {
    try { return JSON.parse(instructionsJson); } catch { return []; }
  }, [instructionsJson]);

  const [title, setTitle] = useState(paramTitle || 'New Recipe');
  const [lastServings, setLastServings] = useState(1);
  const [currentServings, setCurrentServings] = useState('1');
  const [ingredients, setIngredients] = useState(parsed);
  const [instructions, setInstructions] = useState(parsedInstructions);
  const [saving, setSaving] = useState(false);

  function handleServingsChange(text) {
    setCurrentServings(text);
    const num = parseFloat(text);
    if (!num || num <= 0) return;
    const multiplier = num / lastServings;
    setIngredients((prev) => scaleIngredients(prev, multiplier));
    setLastServings(num);
  }

  function handleUpdateIngredient(index, field, value) {
    setIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleAddIngredient() {
    setIngredients((prev) => [...prev, { name: '', quantity: null, unit: null, notes: null }]);
  }

  function handleRemoveIngredient(index) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateStep(index, text) {
    setInstructions((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
  }

  function handleAddStep() {
    setInstructions((prev) => [...prev, '']);
  }

  function handleRemoveStep(index) {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const recipeId = Crypto.randomUUID();
      const now = new Date().toISOString();
      const servings = parseFloat(currentServings) || 1;
      const cleanedSteps = instructions.filter((s) => s.trim());

      const recipe = {
        id: recipeId,
        title: title.trim() || 'New Recipe',
        sourceType: sourceType || 'camera',
        sourceUri: null,
        servings,
        instructions: JSON.stringify(cleanedSteps),
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

      saveRecipe(recipe);
      saveIngredients(recipeId, ingredientsToSave);

      logger.info('editor.saveRecipe.success', { recipeId, ingredientCount: ingredientsToSave.length, stepCount: cleanedSteps.length });

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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Recipe</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.headerButtonSave}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.metaSection}>
        <Text style={styles.label}>Recipe Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Recipe name"
          placeholderTextColor="#999"
        />
        <View style={styles.servingsRow}>
          <Text style={styles.label}>Servings</Text>
          <TextInput
            style={styles.servingsInput}
            value={currentServings}
            onChangeText={handleServingsChange}
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.sourceLabel}>Source: {sourceType}</Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.listContent}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {ingredients.map((item, index) => (
          <View key={index} style={styles.ingredientRow}>
            <TextInput
              style={styles.qtyInput}
              value={item.quantity != null ? String(item.quantity) : ''}
              onChangeText={(val) => handleUpdateIngredient(index, 'quantity', val || null)}
              keyboardType="numbers-and-punctuation"
              placeholder="Qty"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.unitInput}
              value={item.unit || ''}
              onChangeText={(val) => handleUpdateIngredient(index, 'unit', val || null)}
              placeholder="Unit"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.nameInput}
              value={item.name}
              onChangeText={(val) => handleUpdateIngredient(index, 'name', val)}
              placeholder="Ingredient"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.removeStepButton}
              onPress={() => handleRemoveIngredient(index)}
            >
              <Text style={styles.removeStepText}>x</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addStepButton} onPress={handleAddIngredient}>
          <Text style={styles.addStepText}>+ Add Ingredient</Text>
        </TouchableOpacity>

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            {instructions.length} step{instructions.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {instructions.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>
            <TextInput
              style={styles.stepInput}
              value={step}
              onChangeText={(val) => handleUpdateStep(index, val)}
              placeholder="Describe this step..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity
              style={styles.removeStepButton}
              onPress={() => handleRemoveStep(index)}
            >
              <Text style={styles.removeStepText}>x</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addStepButton} onPress={handleAddStep}>
          <Text style={styles.addStepText}>+ Add Step</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  headerButton: {
    color: '#007AFF',
    fontSize: 17,
  },
  headerButtonSave: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  metaSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    paddingVertical: 8,
    marginBottom: 16,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  servingsInput: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  sourceLabel: {
    fontSize: 13,
    color: '#999',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  scrollArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    gap: 8,
  },
  qtyInput: {
    width: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    textAlign: 'center',
  },
  unitInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    gap: 8,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
    marginTop: 8,
    width: 24,
  },
  stepInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    minHeight: 40,
  },
  removeStepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  removeStepText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  addStepButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addStepText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
