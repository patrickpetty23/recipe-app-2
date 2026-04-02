import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SectionList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  getShoppingListIngredients,
  toggleIngredientChecked,
  clearCheckedItems,
  clearShoppingList,
} from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

export default function ShoppingListScreen() {
  const [items, setItems] = useState([]);

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

  const sections = useMemo(() => {
    const grouped = {};
    for (const item of items) {
      const key = item.recipeTitle || 'Unknown Recipe';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [items]);

  function handleToggleChecked(item) {
    try {
      toggleIngredientChecked(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
      );
    } catch (err) {
      logger.error('shoppingList.toggleChecked.error', { id: item.id, error: err.message });
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
    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => handleToggleChecked(item)}
        activeOpacity={0.6}
      >
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, item.checked && styles.itemChecked]} numberOfLines={1}>
            {item.name}
          </Text>
          {qtyUnit ? (
            <Text style={[styles.itemQty, item.checked && styles.itemChecked]}>
              {qtyUnit}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  function renderSectionHeader({ section }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    );
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

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <Text style={styles.headerCount}>
          {checkedCount}/{items.length} checked
        </Text>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />

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
    paddingBottom: 100,
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
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
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
  },
  toolbarButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toolbarButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  toolbarButtonDanger: {
    backgroundColor: '#FFF0F0',
  },
  toolbarButtonTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
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
