import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SectionList,
  FlatList,
  Modal,
  ActivityIndicator,
  Linking,
  Animated,
  Platform,
  SafeAreaView,
  Image,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import {
  getShoppingListIngredients,
  toggleIngredientChecked,
  removeIngredientFromList,
  deleteIngredient,
  clearCheckedItems,
  clearShoppingList,
  addIngredientsToList,
  getAllRecipes,
  getRecipeById,
} from '../../src/db/queries';
import { searchProduct, buildCartLink, isWalmartConfigured } from '../../src/services/walmart';
import { logger } from '../../src/utils/logger';
import { parseFraction, toFractionString } from '../../src/utils/scaler';
import EmptyState from '../../src/components/EmptyState';
import SwipeableRow from '../../src/components/SwipeableRow';
import WalmartProductCard from '../../src/components/WalmartProductCard';

// Keeps animated values across renders without re-creating them
const checkAnimations = {};

function getCheckAnim(id) {
  if (!checkAnimations[id]) {
    checkAnimations[id] = new Animated.Value(0);
  }
  return checkAnimations[id];
}

export default function ShoppingListScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [walmartResults, setWalmartResults] = useState({});
  const [searchingIds, setSearchingIds] = useState({});
  const [bulkSearching, setBulkSearching] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addStep, setAddStep] = useState('recipes');
  const [allRecipes, setAllRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState({});

  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [])
  );

  function loadList() {
    try {
      const all = getShoppingListIngredients();
      setItems(all);
      // Initialise animation values for newly loaded items
      for (const item of all) {
        const anim = getCheckAnim(item.id);
        anim.setValue(item.checked ? 1 : 0);
      }
      logger.info('shoppingList.load', { count: all.length });
    } catch (err) {
      logger.error('shoppingList.load.error', { error: err.message });
    }
  }

  const mergedItems = useMemo(() => {
    const groups = {};
    for (const item of items) {
      const nameKey = (item.name || '').toLowerCase().trim();
      const unitKey = (item.unit || '').toLowerCase().trim();
      const key = `${nameKey}||${unitKey}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: item.name,
          unit: item.unit,
          quantity: null,
          checked: true,
          sourceIds: [],
          recipeNames: [],
        };
      }
      const group = groups[key];
      group.sourceIds.push(item.id);
      if (!item.checked) group.checked = false;
      const recipeName = item.recipeTitle || 'Unknown';
      if (!group.recipeNames.includes(recipeName)) group.recipeNames.push(recipeName);

      const existingQty = parseFraction(group.quantity);
      const newQty = parseFraction(item.quantity);
      if (existingQty != null && newQty != null) {
        group.quantity = toFractionString(existingQty + newQty);
      } else if (newQty != null) {
        group.quantity = toFractionString(newQty);
      }
    }
    return Object.values(groups);
  }, [items]);

  const totalEstimated = useMemo(() => {
    return Object.values(walmartResults)
      .filter((r) => r && r.price != null)
      .reduce((sum, r) => sum + r.price, 0);
  }, [walmartResults]);

  function handleToggleChecked(item) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const anim = getCheckAnim(item.id);
    const nowChecked = !item.checked;
    Animated.spring(anim, {
      toValue: nowChecked ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 8,
    }).start();
    try {
      const newChecked = !item.checked;
      for (const sourceId of item.sourceIds) {
        const original = items.find((i) => i.id === sourceId);
        if (original && original.checked !== newChecked) {
          toggleIngredientChecked(sourceId);
        }
      }
      setItems((prev) =>
        prev.map((i) => item.sourceIds.includes(i.id) ? { ...i, checked: newChecked } : i)
      );
    } catch (err) {
      logger.error('shoppingList.toggleChecked.error', { ids: item.sourceIds, error: err.message });
    }
  }

  function handleRemoveItem(item) {
    try {
      removeIngredientFromList(item.id);
      delete checkAnimations[item.id];
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setWalmartResults((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      logger.info('shoppingList.removeItem', { id: item.id });
    } catch (err) {
      logger.error('shoppingList.removeItem.error', { id: item.id, error: err.message });
    }
  }

  function showNotConfiguredAlert() {
    Alert.alert(
      'Walmart API Not Set Up',
      'Add your WALMART_CLIENT_ID and WALMART_PRIVATE_KEY to .testEnvVars and restart.',
      [{ text: 'OK' }]
    );
  }

  async function handleWalmartSearch(item) {
    if (searchingIds[item.id]) return;
    setSearchingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      const searchQuery = [item.quantity, item.unit, item.name].filter(Boolean).join(' ');
      const product = await searchProduct(searchQuery);
      setWalmartResults((prev) => ({
        ...prev,
        [item.id]: product || { noMatch: true },
      }));
    } catch (err) {
      if (err.code === 'WALMART_NOT_CONFIGURED') {
        showNotConfiguredAlert();
      } else {
        logger.error('shoppingList.walmartSearch.error', { id: item.id, error: err.message });
        Alert.alert('Walmart Search Failed', err.message);
      }
    } finally {
      setSearchingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleBulkWalmartSearch() {
    if (bulkSearching) return;
    if (!isWalmartConfigured()) {
      showNotConfiguredAlert();
      return;
    }
    setBulkSearching(true);
    const unsearched = mergedItems.filter((i) => !walmartResults[i.id]);
    logger.info('shoppingList.bulkSearch', { count: unsearched.length });
    setSearchingIds((prev) => {
      const next = { ...prev };
      unsearched.forEach((i) => { next[i.id] = true; });
      return next;
    });
    await Promise.allSettled(
      unsearched.map(async (item) => {
        try {
          const product = await searchProduct(item.name);
          setWalmartResults((prev) => ({
            ...prev,
            [item.id]: product || { noMatch: true },
          }));
        } catch (err) {
          if (err.code === 'WALMART_NOT_CONFIGURED') {
            showNotConfiguredAlert();
            return;
          }
          logger.error('shoppingList.bulkSearch.error', { id: item.id, error: err.message });
          setWalmartResults((prev) => ({ ...prev, [item.id]: { noMatch: true } }));
        } finally {
          setSearchingIds((prev) => ({ ...prev, [item.id]: false }));
        }
      })
    );
    setBulkSearching(false);
  }

  function handleSendToWalmart() {
    if (!isWalmartConfigured()) {
      showNotConfiguredAlert();
      return;
    }
    const matchedIds = Object.values(walmartResults)
      .filter((r) => r && r.itemId)
      .map((r) => r.itemId);
    if (matchedIds.length === 0) {
      Alert.alert('No Matches Yet', 'Search for items on Walmart first.');
      return;
    }
    const total = totalEstimated > 0 ? `\n\nEstimated total: $${totalEstimated.toFixed(2)}` : '';
    Alert.alert(
      'Open Walmart Cart',
      `Add ${matchedIds.length} item${matchedIds.length !== 1 ? 's' : ''} to your Walmart cart?${total}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Walmart',
          onPress: () => {
            try {
              const url = buildCartLink(matchedIds);
              Linking.openURL(url);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              logger.error('shoppingList.sendToWalmart.error', { error: err.message });
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  function handleDeleteItem(mergedItem) {
    try {
      for (const sourceId of mergedItem.sourceIds) {
        deleteIngredient(sourceId);
      }
      setItems((prev) => prev.filter((i) => !mergedItem.sourceIds.includes(i.id)));
      setWalmartResults((prev) => {
        const next = { ...prev };
        delete next[mergedItem.id];
        return next;
      });
      logger.info('shoppingList.deleteItem', { ids: mergedItem.sourceIds });
    } catch (err) {
      logger.error('shoppingList.deleteItem.error', { ids: mergedItem.sourceIds, error: err.message });
    }
  }

  function handleClearChecked() {
    try {
      clearCheckedItems();
      const clearedIds = items.filter((i) => i.checked).map((i) => i.id);
      for (const id of clearedIds) {
        getCheckAnim(id).setValue(0);
      }
      setItems((prev) => prev.map((i) => ({ ...i, checked: false })));
      logger.info('shoppingList.clearChecked', {});
    } catch (err) {
      logger.error('shoppingList.clearChecked.error', { error: err.message });
    }
  }

  function handleClearList() {
    Alert.alert(
      'Clear Shopping List',
      'This will remove all items from your shopping list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            try {
              clearShoppingList();
              for (const item of items) {
                delete checkAnimations[item.id];
              }
              setItems([]);
              setWalmartResults({});
              logger.info('shoppingList.clearList', {});
            } catch (err) {
              logger.error('shoppingList.clearList.error', { error: err.message });
            }
          },
        },
      ]
    );
  }

  function openAddModal() {
    try {
      const recipes = getAllRecipes();
      setAllRecipes(recipes);
      setAddStep('recipes');
      setSelectedRecipe(null);
      setSelectedIngredientIds({});
      setAddModalVisible(true);
    } catch (err) {
      logger.error('shoppingList.openAddModal.error', { error: err.message });
    }
  }

  function handleSelectRecipe(recipe) {
    try {
      const full = getRecipeById(recipe.id);
      setSelectedRecipe(full);
      setSelectedIngredientIds({});
      setAddStep('ingredients');
    } catch (err) {
      logger.error('shoppingList.selectRecipe.error', { error: err.message });
    }
  }

  function handleToggleIngredient(id) {
    setSelectedIngredientIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleConfirmAdd() {
    const ids = Object.entries(selectedIngredientIds)
      .filter(([, selected]) => selected)
      .map(([id]) => id);
    if (ids.length === 0) {
      Alert.alert('No Items Selected', 'Tap ingredients to select them first.');
      return;
    }
    try {
      addIngredientsToList(ids);
      loadList();
      setAddModalVisible(false);
      logger.info('shoppingList.addIngredients', { count: ids.length });
    } catch (err) {
      logger.error('shoppingList.addIngredients.error', { error: err.message });
    }
  }

  function formatQuantity(qty) {
    if (qty == null) return '';
    return String(qty);
  }

  function renderItem({ item }) {
    const qtyUnit = [formatQuantity(item.quantity), item.unit].filter(Boolean).join(' ');
    const wResult = walmartResults[item.id];
    const isSearching = searchingIds[item.id];
    const anim = getCheckAnim(item.id);

    const strikeOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const checkScale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });
    const textColor = anim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#1C1C1E', '#AEAEB2'],
    });

    return (
      <SwipeableRow onDelete={() => handleDeleteItem(item)} deleteLabel="Remove">
        <View style={styles.itemContainer}>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleToggleChecked(item)}
            activeOpacity={0.6}
          >
            <Animated.View
              style={[
                styles.checkbox,
                {
                  backgroundColor: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['transparent', '#34C759'],
                  }),
                  borderColor: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#C7C7CC', '#34C759'],
                  }),
                  transform: [{ scale: checkScale }],
                },
              ]}
            >
              <Animated.Text style={[styles.checkmark, { opacity: strikeOpacity }]}>✓</Animated.Text>
            </Animated.View>

            <View style={styles.itemContent}>
              <View style={styles.itemTextRow}>
                <Animated.Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                  {item.name}
                </Animated.Text>
                <Animated.View
                  style={[
                    styles.strikethrough,
                    { opacity: strikeOpacity, backgroundColor: textColor },
                  ]}
                />
              </View>
              <View style={styles.itemBottom}>
                {qtyUnit ? <Text style={styles.itemQty}>{qtyUnit}</Text> : null}
                {wResult && wResult.price != null && (
                  <Text style={styles.inlinePrice}>${wResult.price.toFixed(2)}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {wResult ? (
            <WalmartProductCard product={wResult} />
          ) : (
            <TouchableOpacity
              style={styles.walmartSearchButton}
              onPress={() => handleWalmartSearch(item)}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#0071DC" />
              ) : (
                <Text style={styles.walmartSearchText}>Find on Walmart</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SwipeableRow>
    );
  }

  function renderSectionHeader({ section }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>
          {section.data.filter((i) => i.checked).length}/{section.data.length}
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Shopping List</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
        <EmptyState
          iconName="cart-outline"
          title="List is Empty"
          subtitle="Add a recipe from your Library to populate your shopping list."
        />
      </View>
    );
  }

  const checkedCount = mergedItems.filter((i) => i.checked).length;
  const matchedCount = Object.values(walmartResults).filter((r) => r && r.itemId).length;
  const unsearchedCount = mergedItems.filter((i) => !walmartResults[i.id]).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Shopping List</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerCount}>
          {checkedCount}/{mergedItems.length} checked
        </Text>
      </View>

      <FlatList
        style={styles.list}
        data={mergedItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      {totalEstimated > 0 && (
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalAmount}>${totalEstimated.toFixed(2)}</Text>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleClearChecked}>
            <Text style={styles.toolbarButtonText}>Clear Checked</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarButton, styles.toolbarButtonDanger]}
            onPress={handleClearList}
          >
            <Text style={styles.toolbarButtonTextDanger}>Clear List</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.walmartSection}>
          <TouchableOpacity
            style={styles.walmartSearchAllButton}
            onPress={handleBulkWalmartSearch}
            disabled={bulkSearching}
          >
            {bulkSearching ? (
              <View style={styles.searchAllRow}>
                <ActivityIndicator size="small" color="#0071DC" />
                <Text style={styles.walmartSearchAllText}>Searching Walmart…</Text>
              </View>
            ) : (
              <Text style={styles.walmartSearchAllText}>
                Search All on Walmart ({unsearchedCount})
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.walmartCartButton, matchedCount === 0 && styles.walmartCartButtonDisabled]}
            onPress={handleSendToWalmart}
          >
            <Text style={[styles.walmartCartText, matchedCount === 0 && styles.walmartCartTextDisabled]}>
              {matchedCount > 0 ? `Send ${matchedCount} Items to Cart` : 'Send to Walmart Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal handle */}
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            {addStep === 'ingredients' ? (
              <TouchableOpacity style={styles.modalBackBtn} onPress={() => setAddStep('recipes')}>
                <Ionicons name="chevron-back" size={18} color="#FF6B35" />
                <Text style={styles.modalBack}>Recipes</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.modalNavPlaceholder} />
            )}
            <Text style={styles.modalTitle} numberOfLines={1}>
              {addStep === 'recipes' ? 'Add to List' : selectedRecipe?.title}
            </Text>
            <TouchableOpacity style={styles.modalNavPlaceholder} onPress={() => setAddModalVisible(false)}>
              <Ionicons name="close" size={22} color="#B38B6D" />
            </TouchableOpacity>
          </View>

          {addStep === 'recipes' ? (
            <FlatList
              data={allRecipes}
              keyExtractor={(r) => r.id}
              contentContainerStyle={styles.modalListContent}
              renderItem={({ item: recipe }) => (
                <TouchableOpacity
                  style={styles.modalRecipeRow}
                  onPress={() => handleSelectRecipe(recipe)}
                  activeOpacity={0.7}
                >
                  {recipe.imageUri ? (
                    <Image source={{ uri: recipe.imageUri }} style={styles.modalRecipeThumb} />
                  ) : (
                    <View style={styles.modalRecipeThumbPlaceholder}>
                      <Ionicons name="restaurant" size={22} color="#FF6B35" />
                    </View>
                  )}
                  <View style={styles.modalRecipeInfo}>
                    <Text style={styles.modalRecipeName} numberOfLines={2}>{recipe.title}</Text>
                    {recipe.ingredientCount > 0 && (
                      <Text style={styles.modalRecipeMeta}>
                        {recipe.ingredientCount} ingredient{recipe.ingredientCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#F0E0D0" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.modalEmptyBox}>
                  <Ionicons name="book-outline" size={36} color="#F0E0D0" />
                  <Text style={styles.modalEmpty}>No recipes saved yet.</Text>
                </View>
              }
            />
          ) : (
            <>
              <FlatList
                data={selectedRecipe?.ingredients ?? []}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.modalListContent}
                ListHeaderComponent={
                  <TouchableOpacity
                    style={styles.modalSelectAll}
                    onPress={() => {
                      const allSelected = (selectedRecipe?.ingredients ?? []).every(
                        (i) => selectedIngredientIds[i.id]
                      );
                      const next = {};
                      (selectedRecipe?.ingredients ?? []).forEach((i) => {
                        next[i.id] = !allSelected;
                      });
                      setSelectedIngredientIds(next);
                    }}
                  >
                    <Text style={styles.modalSelectAllText}>
                      {(selectedRecipe?.ingredients ?? []).every((i) => selectedIngredientIds[i.id])
                        ? 'Deselect All'
                        : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                }
                renderItem={({ item: ing }) => {
                  const selected = !!selectedIngredientIds[ing.id];
                  const qtyUnit = [ing.quantity != null ? String(ing.quantity) : '', ing.unit]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <TouchableOpacity
                      style={[styles.modalIngredientRow, selected && styles.modalIngredientSelected]}
                      onPress={() => handleToggleIngredient(ing.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.modalCheckbox, selected && styles.modalCheckboxChecked]}>
                        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.modalIngredientName, selected && styles.modalIngredientNameSelected]}>
                        {ing.name}
                      </Text>
                      {qtyUnit ? (
                        <Text style={[styles.modalIngredientQty, selected && styles.modalIngredientQtySelected]}>
                          {qtyUnit}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    Object.values(selectedIngredientIds).filter(Boolean).length === 0 && styles.modalConfirmButtonDisabled,
                  ]}
                  onPress={handleConfirmAdd}
                  disabled={Object.values(selectedIngredientIds).filter(Boolean).length === 0}
                >
                  <Ionicons name="cart" size={18} color="#fff" />
                  <Text style={styles.modalConfirmText}>
                    Add {Object.values(selectedIngredientIds).filter(Boolean).length || ''}{' '}
                    {Object.values(selectedIngredientIds).filter(Boolean).length === 1 ? 'Item' : 'Items'} to List
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFF8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D1B00',
  },
  headerCount: {
    fontSize: 14,
    color: '#B38B6D',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B4C2A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    color: '#B38B6D',
    fontWeight: '500',
  },
  itemContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
    backgroundColor: '#FFF8F0',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  itemContent: {
    flex: 1,
  },
  itemTextRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  strikethrough: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    top: '50%',
    borderRadius: 1,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  itemQty: {
    fontSize: 13,
    color: '#B38B6D',
  },
  inlinePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0071DC',
  },
  mergedHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  walmartSearchButton: {
    marginLeft: 54,
    marginRight: 16,
    marginBottom: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EBF4FF',
    alignSelf: 'flex-start',
    minWidth: 120,
    alignItems: 'center',
  },
  walmartSearchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0071DC',
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F7FF',
    borderTopWidth: 1,
    borderTopColor: '#D0E8FF',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0D5FA6',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0071DC',
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#F0E0D0',
    backgroundColor: '#FFF8F0',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbarButton: {
    flex: 1,
    backgroundColor: '#FFF0E8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D1B00',
  },
  toolbarButtonDanger: {
    backgroundColor: '#FFF0F0',
  },
  toolbarButtonTextDanger: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  walmartSection: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0F7FF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0E2F5',
  },
  walmartTopRow: {
    flexDirection: 'row',
    gap: 8,
  },
  walmartSearchAllButton: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1.5,
    borderColor: '#0071DC',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  walmartSearchAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0071DC',
  },
  searchAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addItemsButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F0E0D0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D1B00',
    flex: 1,
    textAlign: 'center',
  },
  modalBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 80,
  },
  modalBack: {
    fontSize: 15,
    color: '#FF6B35',
    fontWeight: '600',
  },
  modalNavPlaceholder: {
    width: 80,
    alignItems: 'flex-end',
  },
  modalListContent: {
    paddingBottom: 16,
  },
  modalRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
    gap: 12,
  },
  modalRecipeThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFF8F0',
    flexShrink: 0,
  },
  modalRecipeThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalRecipeInfo: {
    flex: 1,
    gap: 3,
  },
  modalRecipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D1B00',
    lineHeight: 21,
  },
  modalRecipeMeta: {
    fontSize: 12,
    color: '#B38B6D',
  },
  modalEmptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  modalEmpty: {
    textAlign: 'center',
    color: '#B38B6D',
    fontSize: 15,
  },
  modalSelectAll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF0E8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
  },
  modalSelectAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
  },
  modalIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
    gap: 12,
  },
  modalIngredientSelected: {
    backgroundColor: '#FFF0E8',
  },
  modalCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalCheckboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  modalIngredientName: {
    flex: 1,
    fontSize: 16,
    color: '#2D1B00',
  },
  modalIngredientNameSelected: {
    fontWeight: '600',
    color: '#FF6B35',
  },
  modalIngredientQty: {
    fontSize: 13,
    color: '#B38B6D',
    fontWeight: '500',
  },
  modalIngredientQtySelected: {
    color: '#FF9A3C',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0E0D0',
    backgroundColor: '#FFF8F0',
  },
  modalConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 15,
    elevation: 3,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#F0E0D0',
    elevation: 0,
    shadowOpacity: 0,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  walmartCartButton: {
    backgroundColor: '#0071DC',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#0071DC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  walmartCartButtonDisabled: {
    backgroundColor: '#B0C4DE',
    elevation: 0,
    shadowOpacity: 0,
  },
  walmartCartText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  walmartCartTextDisabled: {
    opacity: 0.7,
  },
});
