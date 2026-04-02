import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { getAllRecipes } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

const SOURCE_LABELS = {
  camera: 'Camera Scan',
  photo: 'Photo Import',
  url: 'URL Import',
  file: 'File Import',
};

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LibraryScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState([]);

  useFocusEffect(
    useCallback(() => {
      try {
        const all = getAllRecipes();
        setRecipes(all);
        logger.info('library.loadRecipes', { count: all.length });
      } catch (err) {
        logger.error('library.loadRecipes.error', { error: err.message });
      }
    }, [])
  );

  function handleRecipePress(recipe) {
    router.push(`/recipe/${recipe.id}`);
  }

  function renderRecipe({ item }) {
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => handleRecipePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.sourceTag}>
              {SOURCE_LABELS[item.sourceType] || item.sourceType}
            </Text>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Recipes Yet</Text>
        <Text style={styles.emptySubtitle}>
          Scan a recipe, import a photo, paste a URL, or upload a file to get started.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerCount}>
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <FlatList
        data={recipes}
        renderItem={renderRecipe}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  cardContent: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#EBF3FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 13,
    color: '#999',
  },
  chevron: {
    fontSize: 24,
    color: '#CCC',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
});
