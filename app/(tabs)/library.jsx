import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import {
  getAllRecipes,
  deleteRecipe,
  getCollections,
  createCollection,
  addRecipeToCollection,
  getRecipeCollections,
} from '../../src/db/queries';
import { logger } from '../../src/utils/logger';
import EmptyState from '../../src/components/EmptyState';
import SwipeableRow from '../../src/components/SwipeableRow';
import { RecipeCardSkeleton } from '../../src/components/SkeletonLoader';

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

const ALL_KEY = '__all__';

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent' },
  { key: 'alpha', label: 'A–Z' },
  { key: 'count', label: 'Most Ingredients' },
];

const EMOJI_PRESETS = ['🍳','🥗','🍝','🍜','🍕','🥘','🍱','🍣','🥩','🍰','☕','🌮'];

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [recipes, setRecipes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('recent');
  const [activeCollection, setActiveCollection] = useState(ALL_KEY);

  // New collection modal
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColEmoji, setNewColEmoji] = useState('🍳');

  // Add to collection modal
  const [collectionPickerRecipe, setCollectionPickerRecipe] = useState(null);
  const [recipeCollections, setRecipeCollections] = useState([]);

  // ── Data loading ────────────────────────────────────────────────────────────

  function loadAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const allRecipes = getAllRecipes();
      const allCollections = getCollections();
      setRecipes(allRecipes);
      setCollections(allCollections);
      logger.info('library.loadAll', {
        recipeCount: allRecipes.length,
        collectionCount: allCollections.length,
      });
    } catch (err) {
      logger.error('library.loadAll.error', { error: err.message });
      Alert.alert('Error', 'Could not load your recipes. Please restart the app.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  // ── Filtered + sorted list ──────────────────────────────────────────────────

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
    return list;
  }, [recipes, query, sortKey]);

  // Final displayed list: apply collection filter on top of text/sort filter
  const displayedRecipes = useMemo(() => {
    if (activeCollection === ALL_KEY) return filtered;
    return filtered.filter((r) => {
      try {
        const cols = getRecipeCollections(r.id);
        return cols.some((c) => c.id === activeCollection);
      } catch {
        return false;
      }
    });
  }, [filtered, activeCollection]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  function handleRecipePress(recipe) {
    Haptics.selectionAsync();
    router.push(`/recipe/${recipe.id}`);
  }

  function handleDelete(recipe) {
    Alert.alert('Delete Recipe', `Delete "${recipe.title}"? This cannot be undone.`, [
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
    ]);
  }

  function handleOpenCollectionPicker(recipe) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const cols = getRecipeCollections(recipe.id);
      setRecipeCollections(cols);
    } catch {
      setRecipeCollections([]);
    }
    setCollectionPickerRecipe(recipe);
  }

  function handleAddToCollection(collectionId) {
    if (!collectionPickerRecipe) return;
    try {
      addRecipeToCollection(collectionPickerRecipe.id, collectionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const col = collections.find((c) => c.id === collectionId);
      Alert.alert('Added!', `"${collectionPickerRecipe.title}" added to ${col?.name ?? 'collection'}.`);
      logger.info('library.addToCollection', { recipeId: collectionPickerRecipe.id, collectionId });
      // Refresh collection counts so the pill badges update
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, recipeCount: c.recipeCount + 1 } : c))
      );
    } catch (err) {
      logger.error('library.addToCollection.error', { error: err.message });
    }
    setCollectionPickerRecipe(null);
  }

  // ── Create collection ───────────────────────────────────────────────────────

  function handleCreateCollection() {
    const name = newColName.trim();
    if (!name) return;
    try {
      const now = new Date().toISOString();
      const col = { id: Crypto.randomUUID(), name, emoji: newColEmoji, createdAt: now };
      createCollection(col);
      setCollections((prev) => [col, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logger.info('library.createCollection', { id: col.id, name });
    } catch (err) {
      logger.error('library.createCollection.error', { error: err.message });
      Alert.alert('Error', err.message);
    }
    setShowNewCollection(false);
    setNewColName('');
    setNewColEmoji('🍳');
  }

  // ── Render recipe card ──────────────────────────────────────────────────────

  function renderRecipe({ item }) {
    return (
      <SwipeableRow onDelete={() => handleDelete(item)} deleteLabel="Delete">
        <TouchableOpacity
          style={styles.recipeCard}
          onPress={() => handleRecipePress(item)}
          activeOpacity={0.75}
        >
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="restaurant" size={26} color={C.orange} />
            </View>
          )}

          <View style={styles.cardContent}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.cardMeta}>
              {item.cuisine ? (
                <View style={styles.cuisineTag}>
                  <Text style={styles.cuisineTagText}>{item.cuisine}</Text>
                </View>
              ) : null}
              {item.ingredientCount > 0 ? (
                <Text style={styles.metaText}>
                  {item.ingredientCount} ingredient{item.ingredientCount !== 1 ? 's' : ''}
                </Text>
              ) : null}
              <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => handleOpenCollectionPicker(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.ellipsisBtn}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={C.textFaint} />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={16} color={C.border} />
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  }

  // ── Collections scroll ──────────────────────────────────────────────────────

  const collectionItems = [
    { id: ALL_KEY, emoji: '📚', name: 'All', recipeCount: recipes.length },
    ...collections,
    { id: '__new__', emoji: '+', name: 'New', recipeCount: -1 },
  ];

  function renderCollectionCard(col) {
    const isAll = col.id === ALL_KEY;
    const isNew = col.id === '__new__';
    const isActive = col.id === activeCollection;

    return (
      <TouchableOpacity
        key={col.id}
        style={[styles.collectionCard, isActive && styles.collectionCardActive, isNew && styles.collectionCardNew]}
        onPress={() => {
          if (isNew) {
            setShowNewCollection(true);
          } else {
            setActiveCollection(col.id);
            Haptics.selectionAsync();
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.collectionEmoji, isNew && styles.collectionEmojiNew]}>
          {col.emoji}
        </Text>
        <Text style={[styles.collectionName, isActive && styles.collectionNameActive, isNew && styles.collectionNameNew]} numberOfLines={1}>
          {col.name}
        </Text>
        {!isNew && col.recipeCount >= 0 && (
          <Text style={[styles.collectionCount, isActive && styles.collectionCountActive]}>
            {col.recipeCount}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Recipes</Text>
        {!loading && (
          <Text style={styles.headerCount}>
            {displayedRecipes.length} recipe{displayedRecipes.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Collections horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.collectionsScroll}
        contentContainerStyle={styles.collectionsContent}
      >
        {collectionItems.map(renderCollectionCard)}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={C.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes…"
            placeholderTextColor={C.textFaint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={C.textFaint} />
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

      {/* List */}
      {loading ? (
        <View>{[...Array(6)].map((_, i) => <RecipeCardSkeleton key={i} />)}</View>
      ) : displayedRecipes.length === 0 && query ? (
        <EmptyState
          iconName="search-outline"
          title="No Results"
          subtitle={`No recipes match "${query}"`}
          ctaLabel="Clear Search"
          onCta={() => setQuery('')}
        />
      ) : displayedRecipes.length === 0 && activeCollection !== ALL_KEY ? (
        <EmptyState
          iconName="folder-open-outline"
          title="Collection is Empty"
          subtitle="Add recipes to this collection using the ··· menu on any recipe."
          ctaLabel="View All Recipes"
          onCta={() => setActiveCollection(ALL_KEY)}
        />
      ) : displayedRecipes.length === 0 ? (
        <EmptyState
          iconName="book-outline"
          title="No Recipes Yet"
          subtitle="Scan a cookbook, snap a photo, paste a URL, or upload a file."
          ctaLabel="Add a Recipe"
          onCta={() => router.push('/(tabs)')}
        />
      ) : (
        <FlatList
          data={displayedRecipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAll(true)}
              tintColor={C.orange}
              colors={[C.orange]}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      {/* ── New Collection Modal ── */}
      <Modal
        visible={showNewCollection}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowNewCollection(false); setNewColName(''); }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => { setShowNewCollection(false); setNewColName(''); }}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Collection</Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newColName}
              onChangeText={setNewColName}
              placeholder="e.g. Weeknight Dinners"
              placeholderTextColor={C.textFaint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateCollection}
            />

            <Text style={styles.modalLabel}>Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
              <View style={styles.emojiRow}>
                {EMOJI_PRESETS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiChip, newColEmoji === e && styles.emojiChipActive]}
                    onPress={() => setNewColEmoji(e)}
                  >
                    <Text style={styles.emojiChipText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowNewCollection(false); setNewColName(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateBtn, !newColName.trim() && styles.modalCreateBtnDisabled]}
                onPress={handleCreateCollection}
                disabled={!newColName.trim()}
              >
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add to Collection Modal ── */}
      <Modal
        visible={!!collectionPickerRecipe}
        transparent
        animationType="slide"
        onRequestClose={() => setCollectionPickerRecipe(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add to Collection</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {collectionPickerRecipe?.title}
            </Text>

            {collections.length === 0 ? (
              <View style={styles.noCollectionsBox}>
                <Text style={styles.noCollectionsText}>
                  You don't have any collections yet.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setCollectionPickerRecipe(null);
                    setShowNewCollection(true);
                  }}
                >
                  <Text style={styles.noCollectionsLink}>Create one →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              collections.map((col) => {
                const alreadyIn = recipeCollections.some((rc) => rc.id === col.id);
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={[styles.collectionPickerRow, alreadyIn && styles.collectionPickerRowDone]}
                    onPress={() => !alreadyIn && handleAddToCollection(col.id)}
                    disabled={alreadyIn}
                  >
                    <Text style={styles.collectionPickerEmoji}>{col.emoji}</Text>
                    <View style={styles.collectionPickerInfo}>
                      <Text style={styles.collectionPickerName}>{col.name}</Text>
                      <Text style={styles.collectionPickerCount}>
                        {col.recipeCount} recipe{col.recipeCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {alreadyIn && (
                      <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: 16 }]}
              onPress={() => setCollectionPickerRecipe(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.textDark,
  },
  headerCount: {
    fontSize: 13,
    color: C.textFaint,
    marginTop: 2,
  },

  // ── Collections ───────────────────────────────────────────────────────────────
  collectionsScroll: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    maxHeight: 100,
  },
  collectionsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  collectionCard: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 2,
  },
  collectionCardActive: {
    backgroundColor: C.orangeLight,
    borderColor: C.orange,
  },
  collectionCardNew: {
    borderStyle: 'dashed',
    borderColor: C.textFaint,
  },
  collectionEmoji: {
    fontSize: 22,
  },
  collectionEmojiNew: {
    fontSize: 22,
    color: C.textFaint,
  },
  collectionName: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMed,
    marginTop: 2,
  },
  collectionNameActive: {
    color: C.orange,
  },
  collectionNameNew: {
    color: C.textFaint,
  },
  collectionCount: {
    fontSize: 10,
    color: C.textFaint,
  },
  collectionCountActive: {
    color: C.orange,
  },

  // ── Search ────────────────────────────────────────────────────────────────────
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.surface,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.textDark,
    paddingVertical: 0,
  },

  // ── Sort pills ────────────────────────────────────────────────────────────────
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  sortPillActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMed,
  },
  sortPillTextActive: {
    color: '#fff',
  },

  // ── Recipe cards ──────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 40,
    paddingTop: 4,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: C.bg,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: C.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textDark,
    marginBottom: 6,
    lineHeight: 21,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cuisineTag: {
    backgroundColor: C.orangeLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cuisineTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
  },
  metaText: {
    fontSize: 12,
    color: C.textFaint,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ellipsisBtn: {
    padding: 4,
  },

  // ── Modals ────────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(45,27,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textDark,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: C.textFaint,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.textDark,
    backgroundColor: C.bg,
  },
  emojiScroll: {
    marginBottom: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  emojiChipActive: {
    borderColor: C.orange,
    backgroundColor: C.orangeLight,
  },
  emojiChipText: {
    fontSize: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textMed,
  },
  modalCreateBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: C.orange,
    borderRadius: 14,
  },
  modalCreateBtnDisabled: {
    opacity: 0.4,
  },
  modalCreateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  noCollectionsBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noCollectionsText: {
    fontSize: 15,
    color: C.textMed,
  },
  noCollectionsLink: {
    fontSize: 15,
    color: C.orange,
    fontWeight: '700',
  },
  collectionPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 12,
  },
  collectionPickerRowDone: {
    opacity: 0.6,
  },
  collectionPickerEmoji: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  collectionPickerInfo: {
    flex: 1,
  },
  collectionPickerName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textDark,
  },
  collectionPickerCount: {
    fontSize: 13,
    color: C.textFaint,
    marginTop: 1,
  },
});
