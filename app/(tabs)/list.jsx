import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  getShoppingListIngredients,
  toggleIngredientChecked,
  clearCheckedItems,
  clearShoppingList,
} from '../../src/db/queries';
import { searchProduct, buildCartLink, isWalmartConfigured } from '../../src/services/walmart';
import { logger } from '../../src/utils/logger';
import { parseFraction, toFractionString } from '../../src/utils/scaler';

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

  const sections = useMemo(() => {
    return [{ title: 'Shopping List', data: mergedItems }];
  }, [mergedItems]);

  function handleToggleChecked(mergedItem) {
    try {
      const newChecked = !mergedItem.checked;
      for (const sourceId of mergedItem.sourceIds) {
        const original = items.find((i) => i.id === sourceId);
        if (original && original.checked !== newChecked) {
          toggleIngredientChecked(sourceId);
        }
      }
      setItems((prev) =>
        prev.map((i) =>
          mergedItem.sourceIds.includes(i.id) ? { ...i, checked: newChecked } : i
        )
      );
    } catch (err) {
      logger.error('shoppingList.toggleChecked.error', { ids: mergedItem.sourceIds, error: err.message });
    }
  }

  function showNotConfiguredAlert() {
    Alert.alert(
      'Walmart API Not Set Up',
      'To use Walmart features, add your WALMART_CLIENT_ID and WALMART_PRIVATE_KEY to the .testEnvVars file and restart the app.',
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

    for (const item of unsearched) {
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

    try {
      const url = buildCartLink(matchedIds);
      Linking.openURL(url);
    } catch (err) {
      logger.error('shoppingList.sendToWalmart.error', { error: err.message });
      Alert.alert('Error', err.message);
    }
  }

  function handleClearChecked() {
    try {
      clearCheckedItems();
      setItems((prev) => prev.map((i) => ({ ...i, checked: false })));
      logger.info('shoppingList.clearChecked', {});
    } catch (err) {
      logger.error('shoppingList.clearChecked.error', { error: err.message });
    }
  }

  function handleClearList() {
    Alert.alert(
      'Clear Shopping List',
      'Are you sure? This will clear your entire shopping list.',
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
    return String(qty);
  }

  function renderItem({ item }) {
    const qtyUnit = [formatQuantity(item.quantity), item.unit].filter(Boolean).join(' ');
    const wResult = walmartResults[item.id];
    const isSearching = searchingIds[item.id];
    const isMerged = item.sourceIds.length > 1;

    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => handleToggleChecked(item)}
          activeOpacity={0.6}
        >
          <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
            {item.checked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.itemContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, item.checked && styles.itemChecked]} numberOfLines={1}>
                {item.name}
              </Text>
              {isMerged && (
                <Text style={styles.mergedHint}>
                  Combined from: {item.recipeNames.join(', ')}
                </Text>
              )}
            </View>
            {qtyUnit ? (
              <Text style={[styles.itemQty, item.checked && styles.itemChecked]}>
                {qtyUnit}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {wResult && !wResult.noMatch ? (
          <View style={styles.walmartResult}>
            <Text style={styles.walmartName} numberOfLines={1}>{wResult.name}</Text>
            {wResult.price != null && (
              <Text style={styles.walmartPrice}>${wResult.price.toFixed(2)}</Text>
            )}
          </View>
        ) : wResult && wResult.noMatch ? (
          <View style={styles.walmartResult}>
            <Text style={styles.walmartNoMatch}>No match found</Text>
          </View>
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
    );
  }

  function renderSectionHeader() {
    return null;
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Shopping List Empty</Text>
        <Text style={styles.emptySubtitle}>
          Add a recipe from your Library to get started.
        </Text>
      </View>
    );
  }

  const checkedCount = mergedItems.filter((i) => i.checked).length;
  const matchedCount = Object.values(walmartResults).filter((r) => r && r.itemId).length;
  const unsearchedCount = mergedItems.filter((i) => !walmartResults[i.id]).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <Text style={styles.headerCount}>
          {checkedCount}/{mergedItems.length} checked
        </Text>
      </View>

      <SectionList
        style={styles.list}
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
      />

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
                <Text style={styles.walmartSearchAllText}>Searching...</Text>
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
              Send to Walmart Cart{matchedCount > 0 ? ` (${matchedCount})` : ''}
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
  list: {
    flex: 1,
  },
  sectionHeader: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  itemQty: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  itemChecked: {
    textDecorationLine: 'line-through',
    color: '#BBB',
  },
  mergedHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  walmartSearchButton: {
    marginLeft: 52,
    marginRight: 16,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#EBF4FF',
    alignSelf: 'flex-start',
    minWidth: 110,
    alignItems: 'center',
  },
  walmartSearchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0071DC',
  },
  walmartResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 52,
    marginRight: 16,
    marginBottom: 8,
    gap: 8,
  },
  walmartName: {
    fontSize: 12,
    color: '#0071DC',
    flex: 1,
  },
  walmartPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0071DC',
  },
  walmartNoMatch: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbarButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#0071DC',
    borderRadius: 8,
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
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  walmartCartButtonDisabled: {
    backgroundColor: '#B0C4DE',
  },
  walmartCartText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  walmartCartTextDisabled: {
    opacity: 0.7,
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
