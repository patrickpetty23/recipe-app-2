import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getAllRecipes, deleteRecipe } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';
import EmptyState from '../../src/components/EmptyState';
import SwipeableRow from '../../src/components/SwipeableRow';
import { RecipeCardSkeleton } from '../../src/components/SkeletonLoader';

const SOURCE_LABELS = {
  camera: 'Camera',
  photo: 'Photo',
  url: 'URL',
  file: 'File',
};

const SOURCE_COLORS = {
  camera: { bg: '#EBF3FF', text: '#007AFF' },
  photo: { bg: '#F0EBFF', text: '#7C3AED' },
  url: { bg: '#EBFFF0', text: '#16A34A' },
  file: { bg: '#FFF5EB', text: '#EA580C' },
};

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent' },
  { key: 'alpha', label: 'A–Z' },
  { key: 'count', label: 'Most Ingredients' },
];

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LibraryScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('recent');

  function loadRecipes(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const all = getAllRecipes();
      setRecipes(all);
      logger.info('library.loadRecipes', { count: all.length });
    } catch (err) {
      logger.error('library.loadRecipes.error', { error: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [])
  );

  const filtered = useMemo(() => {
    let list = recipes;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (sortKey === 'alpha') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortKey === 'count') {
      list = [...list].sort((a, b) => (b.ingredientCount ?? 0) - (a.ingredientCount ?? 0));
    }
    // 'recent' is already sorted by created_at DESC from the DB
    return list;
  }, [recipes, query, sortKey]);

  function handleRecipePress(recipe) {
    Haptics.selectionAsync();
    router.push(`/recipe/${recipe.id}`);
  }

  function handleDelete(recipe) {
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
              deleteRecipe(recipe.id);
              setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              logger.info('library.deleteRecipe', { id: recipe.id });
            } catch (err) {
              logger.error('library.deleteRecipe.error', { id: recipe.id, error: err.message });
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  function renderRecipe({ item, index }) {
    const colors = SOURCE_COLORS[item.sourceType] ?? { bg: '#F2F2F7', text: '#636366' };

    return (
      <SwipeableRow onDelete={() => handleDelete(item)} deleteLabel="Delete">
        <TouchableOpacity
          style={styles.recipeCard}
          onPress={() => handleRecipePress(item)}
          activeOpacity={0.7}
          // Android ripple via background
          android_ripple={{ color: '#F0F0F0' }}
        >
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.bg }]}>
              <Ionicons name="restaurant-outline" size={22} color={colors.text} />
            </View>
          )}

          <View style={styles.cardContent}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.cardMeta}>
              <View style={[styles.sourceTag, { backgroundColor: colors.bg }]}>
                <Text style={[styles.sourceTagText, { color: colors.text }]}>
                  {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                </Text>
              </View>
              {item.ingredientCount > 0 ? (
                <Text style={styles.metaText}>
                  {item.ingredientCount} ingredient{item.ingredientCount !== 1 ? 's' : ''}
                </Text>
              ) : null}
              <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </TouchableOpacity>
      </SwipeableRow>
    );
  }

  function renderSkeletons() {
    return Array.from({ length: 6 }).map((_, i) => <RecipeCardSkeleton key={i} />);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipes</Text>
        {!loading && (
          <Text style={styles.headerCount}>
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes…"
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sort pills */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.sortPill, sortKey === opt.key && styles.sortPillActive]}
            onPress={() => setSortKey(opt.key)}
          >
            <Text style={[styles.sortPillText, sortKey === opt.key && styles.sortPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View>{renderSkeletons()}</View>
      ) : filtered.length === 0 && query ? (
        <EmptyState
          iconName="search-outline"
          title="No Results"
          subtitle={`No recipes match "${query}"`}
          ctaLabel="Clear Search"
          onCta={() => setQuery('')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          iconName="book-outline"
          title="No Recipes Yet"
          subtitle="Scan a cookbook, snap a photo, paste a URL, or upload a file to get started."
          ctaLabel="Scan Your First Recipe"
          onCta={() => router.push('/(tabs)')}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRecipes(true)}
              tintColor="#007AFF"
              colors={['#007AFF']}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
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
    paddingTop: Platform.OS === 'android' ? 52 : 60,
    paddingBottom: 8,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  headerCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    paddingVertical: 0,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  sortPillActive: {
    backgroundColor: '#007AFF',
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },
  sortPillTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 40,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
