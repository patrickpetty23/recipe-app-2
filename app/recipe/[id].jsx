import { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';

import { getRecipeById, updateRecipe, updateIngredient, deleteRecipe, addRecipeToList, removeRecipeFromList } from '../../src/db/queries';
import { scaleIngredients } from '../../src/utils/scaler';
import { logger } from '../../src/utils/logger';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [lastServings, setLastServings] = useState(1);
  const [currentServings, setCurrentServings] = useState('1');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [addedToList, setAddedToList] = useState(false);

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
      setLastServings(data.servings || 1);
      setCurrentServings(String(data.servings || 1));
      const onList = (data.ingredients || []).some((ing) => ing.inList);
      setAddedToList(onList);
      logger.info('recipeDetail.load', { id, ingredientCount: (data.ingredients || []).length, onList });
    } catch (err) {
      logger.error('recipeDetail.load.error', { id, error: err.message });
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleTitleChange(text) {
    setTitle(text);
    try {
      updateRecipe(id, { title: text });
    } catch (err) {
      logger.error('recipeDetail.updateTitle.error', { id, error: err.message });
    }
  }

  function handleServingsChange(text) {
    setCurrentServings(text);
    const num = parseFloat(text);
    if (!num || num <= 0) return;
    const multiplier = num / lastServings;
    setIngredients((prev) => scaleIngredients(prev, multiplier));
    setLastServings(num);
  }

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

  function handleDelete() {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.title}"? This cannot be undone.`,
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

  function handleToggleShoppingList() {
    try {
      if (addedToList) {
        removeRecipeFromList(id);
        setAddedToList(false);
        logger.info('recipeDetail.removeFromList', { id });
        Alert.alert('Removed', 'Recipe removed from your shopping list.');
      } else {
        addRecipeToList(id);
        setAddedToList(true);
        logger.info('recipeDetail.addToList', { id });
        router.push('/(tabs)/list');
      }
    } catch (err) {
      logger.error('recipeDetail.toggleShoppingList.error', { id, error: err.message });
      Alert.alert('Error', err.message);
    }
  }

  function renderIngredient({ item, index }) {
    return (
      <View style={styles.ingredientRow}>
        <TextInput
          style={styles.qtyInput}
          value={item.quantity != null ? String(Math.round(item.quantity * 100) / 100) : ''}
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
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.headerButtonDelete}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metaSection}>
        <Text style={styles.label}>Recipe Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={handleTitleChange}
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
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={ingredients}
        renderItem={renderIngredient}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionButton, addedToList && styles.actionButtonDone]}
              onPress={handleToggleShoppingList}
            >
              <Text style={[styles.actionButtonText, addedToList && styles.actionButtonTextDone]}>
                {addedToList ? 'Remove from Shopping List' : 'Add to Shopping List'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete Recipe</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
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
  headerButtonDelete: {
    color: '#FF3B30',
    fontSize: 17,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  metaSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    paddingVertical: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  footer: {
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonDone: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  actionButtonTextDone: {
    color: '#fff',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600',
  },
});
