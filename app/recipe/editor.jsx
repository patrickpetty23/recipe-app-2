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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import { scaleIngredients } from '../../src/utils/scaler';
import { saveRecipe, saveIngredients } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

export default function EditorScreen() {
  const router = useRouter();
  const { ingredients: ingredientsJson, sourceType, imageUri } = useLocalSearchParams();
  const parsed = useMemo(() => {
    try {
      return JSON.parse(ingredientsJson);
    } catch {
      return [];
    }
  }, [ingredientsJson]);

  const [title, setTitle] = useState('New Recipe');
  const [lastServings, setLastServings] = useState(1);
  const [currentServings, setCurrentServings] = useState('1');
  const [ingredients, setIngredients] = useState(parsed);
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
        imageUri: imageUri || null,
        servings,
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

      logger.info('editor.saveRecipe.success', { recipeId, ingredientCount: ingredientsToSave.length });
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

  function renderIngredient({ item, index }) {
    return (
      <View style={styles.ingredientRow}>
        <TextInput
          style={styles.qtyInput}
          value={item.quantity != null ? String(item.quantity) : ''}
          onChangeText={(val) => {
            const num = parseFloat(val);
            handleUpdateIngredient(index, 'quantity', isNaN(num) ? null : num);
          }}
          keyboardType="decimal-pad"
          placeholder="Qty"
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.unitInput}
          value={item.unit || ''}
          onChangeText={(val) => handleUpdateIngredient(index, 'unit', val || null)}
          placeholder="Unit"
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.nameInput}
          value={item.name}
          onChangeText={(val) => handleUpdateIngredient(index, 'name', val)}
          placeholder="Ingredient"
          placeholderTextColor="#999"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
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
          returnKeyType="done"
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
        <Text style={styles.sourceLabel}>
          Source: {sourceType}{imageUri ? '  ·  Photo saved' : ''}
        </Text>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={ingredients}
        renderItem={renderIngredient}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />
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
    paddingTop: Platform.OS === 'android' ? 40 : 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
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
    color: '#1C1C1E',
  },
  metaSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 8,
    marginBottom: 16,
    color: '#1C1C1E',
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
    color: '#1C1C1E',
  },
  sourceLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636366',
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
    borderBottomColor: '#E5E5EA',
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
    color: '#1C1C1E',
  },
  unitInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    color: '#1C1C1E',
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    color: '#1C1C1E',
  },
});
