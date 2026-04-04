import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import {
  getShoppingListIngredients,
  toggleIngredientChecked,
  removeIngredientFromList,
  clearCheckedItems,
  clearShoppingList,
} from '../../src/db/queries';
import { searchProduct, buildCartLink, isWalmartConfigured } from '../../src/services/walmart';
import { logger } from '../../src/utils/logger';
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
  const [items, setItems] = useState([]);
  const [walmartResults, setWalmartResults] = useState({});
  const [searchingIds, setSearchingIds] = useState({});
  const [bulkSearching, setBulkSearching] = useState(false);

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

  const sections = useMemo(() => {
    const grouped = {};
    for (const item of items) {
      const key = item.recipeTitle || 'Unknown Recipe';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
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
      toggleIngredientChecked(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, checked: nowChecked } : i))
      );
    } catch (err) {
      logger.error('shoppingList.toggleChecked.error', { id: item.id, error: err.message });
    }
  }

  function handleRemoveItem(item) {
    try {
      removeIngredientFromList(item.id);
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
      const product = await searchProduct(item.name);
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
    const unsearched = items.filter((i) => !walmartResults[i.id]);
    logger.info('shoppingList.bulkSearch', { count: unsearched.length });
    for (const item of unsearched) {
      setSearchingIds((prev) => ({ ...prev, [item.id]: true }));
      try {
        const product = await searchProduct(item.name);
        setWalmartResults((prev) => ({
          ...prev,
          [item.id]: product || { noMatch: true },
        }));
      } catch (err) {
        if (err.code === 'WALMART_NOT_CONFIGURED') {
          showNotConfiguredAlert();
          break;
        }
        logger.error('shoppingList.bulkSearch.error', { id: item.id, error: err.message });
        setWalmartResults((prev) => ({ ...prev, [item.id]: { noMatch: true } }));
      } finally {
        setSearchingIds((prev) => ({ ...prev, [item.id]: false }));
      }
    }
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

  function formatQuantity(qty) {
    if (qty == null) return '';
    return String(Math.round(qty * 100) / 100);
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
      <SwipeableRow onDelete={() => handleRemoveItem(item)} deleteLabel="Remove">
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shopping List</Text>
        </View>
        <EmptyState
          iconName="cart-outline"
          title="List is Empty"
          subtitle="Add a recipe from your Library to populate your shopping list."
        />
      </View>
    );
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const matchedCount = Object.values(walmartResults).filter((r) => r && r.itemId).length;
  const unsearchedCount = items.filter((i) => !walmartResults[i.id]).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <Text style={styles.headerCount}>
          {checkedCount}/{items.length} checked
        </Text>
      </View>

      <SectionList
        style={styles.list}
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
      />

      {totalEstimated > 0 && (
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalAmount}>${totalEstimated.toFixed(2)}</Text>
        </View>
      )}

      <View style={styles.bottomBar}>
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
    paddingTop: Platform.OS === 'android' ? 52 : 60,
    paddingBottom: 12,
    backgroundColor: '#FFF8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
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
