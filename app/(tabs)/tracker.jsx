import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getCookLogForDate, getRecentCookLog, deleteCookLogEntry, getSetting, setSetting } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

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

const DEFAULT_GOALS = { calories: 2000, protein: 150, carbs: 250, fat: 65 };

function todayString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Macro progress bar ────────────────────────────────────────────────────────

function MacroBar({ label, consumed, goal, color }) {
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const over = consumed > goal;
  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={[barStyles.value, over && barStyles.valueOver]}>
          {Math.round(consumed)}g <Text style={barStyles.goal}>/ {goal}g</Text>
        </Text>
      </View>
      <View style={barStyles.track}>
        <View
          style={[
            barStyles.fill,
            { width: `${Math.round(pct * 100)}%`, backgroundColor: over ? '#FF3B30' : color },
          ]}
        />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 13, fontWeight: '600', color: C.textMed },
  value: { fontSize: 13, fontWeight: '700', color: C.textDark },
  valueOver: { color: '#FF3B30' },
  goal: { fontWeight: '400', color: C.textFaint },
  track: { height: 9, borderRadius: 5, backgroundColor: C.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TrackerScreen() {
  const router = useRouter();
  const [todayEntries, setTodayEntries] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ ...DEFAULT_GOALS });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  function loadData() {
    try {
      // Load goals from settings
      const savedGoals = getSetting('nutritionGoals');
      if (savedGoals) {
        try { setGoals(JSON.parse(savedGoals)); } catch {}
      }
      const today = getCookLogForDate(todayString());
      setTodayEntries(today);
      const recent = getRecentCookLog(30);
      setRecentEntries(recent);
      logger.info('tracker.loadData', { todayCount: today.length });
    } catch (err) {
      logger.error('tracker.loadData.error', { error: err.message });
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────────

  const todayTotals = todayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein: acc.protein + (e.protein ?? 0),
      carbs: acc.carbs + (e.carbs ?? 0),
      fat: acc.fat + (e.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const calPct = goals.calories > 0 ? Math.min(1, todayTotals.calories / goals.calories) : 0;
  const calOver = todayTotals.calories > goals.calories;
  const calRemaining = Math.max(0, goals.calories - todayTotals.calories);

  // ── Delete log entry ──────────────────────────────────────────────────────────

  function handleDeleteEntry(entry) {
    Alert.alert('Remove Meal', `Remove "${entry.recipeTitle}" from today's log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            deleteCookLogEntry(entry.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
          } catch (err) {
            logger.error('tracker.deleteEntry.error', { error: err.message });
          }
        },
      },
    ]);
  }

  // ── Goal modal ────────────────────────────────────────────────────────────────

  function handleSaveGoals() {
    const parsed = {
      calories: parseInt(goalDraft.calories) || DEFAULT_GOALS.calories,
      protein: parseInt(goalDraft.protein) || DEFAULT_GOALS.protein,
      carbs: parseInt(goalDraft.carbs) || DEFAULT_GOALS.carbs,
      fat: parseInt(goalDraft.fat) || DEFAULT_GOALS.fat,
    };
    setGoals(parsed);
    setSetting('nutritionGoals', JSON.stringify(parsed));
    setShowGoalModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Nutrition</Text>
            <Text style={styles.headerDate}>{todayLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.goalBtn}
            onPress={() => { setGoalDraft({ ...goals }); setShowGoalModal(true); }}
          >
            <Ionicons name="settings-outline" size={16} color={C.orange} />
            <Text style={styles.goalBtnText}>Goals</Text>
          </TouchableOpacity>
        </View>

        {/* Calorie ring card */}
        <View style={styles.calorieCard}>
          <View style={styles.calorieRing}>
            {/* Background ring */}
            <View style={styles.ringBg} />
            {/* Filled arc simulated with border trick */}
            <View style={[styles.ringFill, { borderColor: calOver ? '#FF3B30' : C.orange }]} />
            <View style={styles.ringCenter}>
              <Text style={styles.ringCalories}>{Math.round(todayTotals.calories)}</Text>
              <Text style={styles.ringLabel}>kcal today</Text>
            </View>
          </View>

          <View style={styles.calorieSummary}>
            <View style={styles.calSummaryItem}>
              <Text style={styles.calSummaryValue}>{goals.calories}</Text>
              <Text style={styles.calSummaryLabel}>Goal</Text>
            </View>
            <View style={styles.calDivider} />
            <View style={styles.calSummaryItem}>
              <Text style={[styles.calSummaryValue, calOver && { color: '#FF3B30' }]}>
                {calOver ? `+${Math.round(todayTotals.calories - goals.calories)}` : Math.round(calRemaining)}
              </Text>
              <Text style={styles.calSummaryLabel}>{calOver ? 'Over' : 'Remaining'}</Text>
            </View>
            <View style={styles.calDivider} />
            <View style={styles.calSummaryItem}>
              <Text style={styles.calSummaryValue}>{todayEntries.length}</Text>
              <Text style={styles.calSummaryLabel}>{todayEntries.length === 1 ? 'Meal' : 'Meals'}</Text>
            </View>
          </View>
        </View>

        {/* Macros card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macros</Text>
          <MacroBar label="Protein" consumed={todayTotals.protein} goal={goals.protein} color={C.orange} />
          <MacroBar label="Carbs" consumed={todayTotals.carbs} goal={goals.carbs} color="#F59E0B" />
          <MacroBar label="Fat" consumed={todayTotals.fat} goal={goals.fat} color="#6B4C2A" />
        </View>

        {/* Today's meals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Meals</Text>
          {todayEntries.length === 0 ? (
            <View style={styles.emptyMeals}>
              <Ionicons name="restaurant-outline" size={32} color={C.border} />
              <Text style={styles.emptyMealsText}>No meals logged yet</Text>
              <Text style={styles.emptyMealsSub}>Tap "Log Meal" on any recipe to start tracking</Text>
            </View>
          ) : (
            todayEntries.map((entry) => (
              <View key={entry.id} style={styles.mealRow}>
                <View style={styles.mealIcon}>
                  <Ionicons name="restaurant" size={18} color={C.orange} />
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle} numberOfLines={1}>{entry.recipeTitle}</Text>
                  <Text style={styles.mealMeta}>
                    {entry.servings} serving{entry.servings !== 1 ? 's' : ''}
                    {entry.calories ? ` · ${entry.calories} kcal` : ''}
                    {' · '}{formatTime(entry.cookedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteEntry(entry)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={C.border} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Recent history */}
        {recentEntries.filter((e) => e.cookedAt.slice(0, 10) !== todayString()).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent History</Text>
            {recentEntries
              .filter((e) => e.cookedAt.slice(0, 10) !== todayString())
              .slice(0, 10)
              .map((entry) => {
                const dateStr = new Date(entry.cookedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <View key={entry.id} style={styles.historyRow}>
                    <View style={styles.historyDot} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{entry.recipeTitle}</Text>
                      <Text style={styles.historyMeta}>
                        {dateStr}{entry.calories ? ` · ${entry.calories} kcal` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Goal modal */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Daily Goals</Text>

            {[
              { key: 'calories', label: 'Calories', unit: 'kcal' },
              { key: 'protein', label: 'Protein', unit: 'g' },
              { key: 'carbs', label: 'Carbs', unit: 'g' },
              { key: 'fat', label: 'Fat', unit: 'g' },
            ].map(({ key, label, unit }) => (
              <View key={key} style={styles.goalField}>
                <Text style={styles.goalLabel}>{label}</Text>
                <View style={styles.goalInputRow}>
                  <TextInput
                    style={styles.goalInput}
                    value={String(goalDraft[key])}
                    onChangeText={(v) => setGoalDraft((prev) => ({ ...prev, [key]: v }))}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <Text style={styles.goalUnit}>{unit}</Text>
                </View>
              </View>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowGoalModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveGoals}>
                <Text style={styles.modalSaveText}>Save Goals</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 52 : 60,
    paddingBottom: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.textDark,
  },
  headerDate: {
    fontSize: 13,
    color: C.textFaint,
    marginTop: 2,
  },
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.orangeLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  goalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
  },

  // ── Calorie card ──────────────────────────────────────────────────────────────
  calorieCard: {
    backgroundColor: C.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#2D1B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  calorieRing: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ringBg: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
    borderColor: C.border,
  },
  ringFill: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
    borderColor: C.orange,
    // The ring is always full — we use opacity to dim it at low fill.
    // A true arc needs SVG; this gives a "strong ring" indicator.
  },
  ringCenter: {
    alignItems: 'center',
  },
  ringCalories: {
    fontSize: 34,
    fontWeight: '800',
    color: C.textDark,
  },
  ringLabel: {
    fontSize: 12,
    color: C.textFaint,
    marginTop: 2,
  },
  calorieSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
  },
  calSummaryItem: { alignItems: 'center' },
  calSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textDark,
  },
  calSummaryLabel: {
    fontSize: 11,
    color: C.textFaint,
    marginTop: 2,
  },
  calDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.border,
  },

  // ── Card ──────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2D1B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textDark,
    marginBottom: 16,
  },

  // ── Empty meals ───────────────────────────────────────────────────────────────
  emptyMeals: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyMealsText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textMed,
  },
  emptyMealsSub: {
    fontSize: 13,
    color: C.textFaint,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Meal rows ─────────────────────────────────────────────────────────────────
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 12,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mealInfo: { flex: 1 },
  mealTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textDark,
  },
  mealMeta: {
    fontSize: 12,
    color: C.textFaint,
    marginTop: 2,
  },

  // ── History rows ──────────────────────────────────────────────────────────────
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
    flexShrink: 0,
  },
  historyInfo: { flex: 1 },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textMed,
  },
  historyMeta: {
    fontSize: 12,
    color: C.textFaint,
    marginTop: 1,
  },

  // ── Goal modal ────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(45,27,0,0.4)',
    justifyContent: 'flex-end',
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
    marginBottom: 20,
  },
  goalField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textDark,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalInput: {
    width: 80,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 16,
    fontWeight: '700',
    color: C.textDark,
    textAlign: 'center',
    backgroundColor: C.bg,
  },
  goalUnit: {
    fontSize: 14,
    color: C.textFaint,
    width: 28,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: C.orange,
    borderRadius: 14,
    elevation: 2,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
