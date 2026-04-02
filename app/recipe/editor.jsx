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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { scaleIngredients } from '../../src/utils/scaler';

export default function EditorScreen() {
  const router = useRouter();
  const { ingredients: ingredientsJson, sourceType } = useLocalSearchParams();
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

  function handleSave() {
    Alert.alert('Saved!', 'Recipe save will be wired in Phase 5.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Recipe</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerButtonSave}>Save</Text>
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
});
