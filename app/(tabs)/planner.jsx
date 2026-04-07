import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import {
  getMealPlanForWeek,
  addMealPlan,
  removeMealPlan,
  getAllRecipes,
  getNutrition,
  getSetting,
  setSetting,
} from '../../src/db/queries';
import { chatMealPlanner } from '../../src/services/openai';
import { logger } from '../../src/utils/logger';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  orange: '#FF6B35',
  orangeLight: '#FFF0E8',
  bg: '#FFF8F0',
  surface: '#FFFFFF',
  textDark: '#2D1B00',
  textMed: '#6B4C2A',
  textFaint: '#B38B6D',
  border: '#F0E0D0',
  green: '#4CAF50',
  blue: '#5C6BC0',
  pink: '#EC407A',
  amber: '#FF9F40',
};

// ── Meal type config ──────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', color: C.amber },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️',  color: C.green },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙',  color: C.blue },
  { key: 'snack',     label: 'Snack',     emoji: '🍎',  color: C.pink },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Date helpers ──────────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function todayStr() {
  return toDateStr(new Date());
}

function formatWeekLabel(monday) {
  const sunday = addDays(monday, 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}`;
}

function formatDayHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DayBubble({ date, dayName, isToday, isSelected, mealCount, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        bs.dayBubble,
        isSelected && bs.dayBubbleSelected,
        isToday && !isSelected && bs.dayBubbleToday,
      ]}
    >
      <Text style={[bs.dayName, isSelected && bs.dayNameSelected]}>{dayName}</Text>
      <Text style={[bs.dayNum, isSelected && bs.dayNumSelected]}>{date.getDate()}</Text>
      <View style={bs.dotRow}>
        {Array.from({ length: Math.min(mealCount, 4) }).map((_, i) => (
          <View
            key={i}
            style={[bs.dot, isSelected && bs.dotSelected]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

const bs = StyleSheet.create({
  dayBubble: {
    width: 44,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 3,
    backgroundColor: 'transparent',
  },
  dayBubbleSelected: {
    backgroundColor: C.orange,
  },
  dayBubbleToday: {
    backgroundColor: C.orangeLight,
  },
  dayName: { fontSize: 11, fontWeight: '600', color: C.textFaint, marginBottom: 4 },
  dayNameSelected: { color: '#FFF' },
  dayNum: { fontSize: 17, fontWeight: '700', color: C.textDark, marginBottom: 5 },
  dayNumSelected: { color: '#FFF' },
  dotRow: { flexDirection: 'row', gap: 2, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.orange, opacity: 0.6 },
  dotSelected: { backgroundColor: '#FFF', opacity: 0.9 },
});

function DailyNutritionBar({ plans }) {
  const totals = useMemo(() => {
    return plans.reduce(
      (acc, p) => {
        const s = p.servings ?? 1;
        if (p.calories) acc.cal += p.calories * s;
        if (p.protein)  acc.pro += p.protein * s;
        if (p.carbs)    acc.carb += p.carbs * s;
        if (p.fat)      acc.fat  += p.fat * s;
        return acc;
      },
      { cal: 0, pro: 0, carb: 0, fat: 0 }
    );
  }, [plans]);

  if (plans.length === 0) return null;

  return (
    <View style={nb.card}>
      <Text style={nb.title}>Today's Nutrition</Text>
      <View style={nb.row}>
        <NutriBadge label="Calories" value={Math.round(totals.cal)} unit="kcal" color={C.orange} />
        <NutriBadge label="Protein"  value={Math.round(totals.pro)} unit="g"    color={C.blue} />
        <NutriBadge label="Carbs"    value={Math.round(totals.carb)} unit="g"   color={C.green} />
        <NutriBadge label="Fat"      value={Math.round(totals.fat)} unit="g"    color={C.pink} />
      </View>
    </View>
  );
}

function NutriBadge({ label, value, unit, color }) {
  return (
    <View style={nb.badge}>
      <Text style={[nb.val, { color }]}>{value}</Text>
      <Text style={nb.unit}>{unit}</Text>
      <Text style={nb.lbl}>{label}</Text>
    </View>
  );
}

const nb = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { fontSize: 13, fontWeight: '700', color: C.textMed, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  badge: { alignItems: 'center' },
  val: { fontSize: 20, fontWeight: '800' },
  unit: { fontSize: 11, fontWeight: '600', color: C.textFaint, marginTop: -1 },
  lbl: { fontSize: 11, color: C.textMed, marginTop: 2 },
});

function MealCard({ plan, onRemove, onPress }) {
  return (
    <TouchableOpacity
      style={mc.card}
      onPress={() => plan.recipeId && onPress(plan.recipeId)}
      activeOpacity={plan.recipeId ? 0.7 : 1}
    >
      {plan.recipeImageUri ? (
        <Image source={{ uri: plan.recipeImageUri }} style={mc.img} />
      ) : (
        <View style={mc.imgPlaceholder}>
          <Ionicons name="restaurant-outline" size={22} color={C.textFaint} />
        </View>
      )}
      <View style={mc.info}>
        <Text style={mc.title} numberOfLines={1}>{plan.recipeTitle}</Text>
        <View style={mc.meta}>
          {plan.calories != null && (
            <Text style={mc.cal}>{Math.round(plan.calories * (plan.servings ?? 1))} kcal</Text>
          )}
          <Text style={mc.servings}>· {plan.servings ?? 1} serving{(plan.servings ?? 1) !== 1 ? 's' : ''}</Text>
          {plan.notes ? <Text style={mc.note} numberOfLines={1}>· {plan.notes}</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onRemove(plan.id)}
        style={mc.removeBtn}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Ionicons name="close-circle" size={20} color={C.textFaint} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const mc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    marginBottom: 8,
  },
  img: { width: 52, height: 52, borderRadius: 10, backgroundColor: C.border },
  imgPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: C.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 10 },
  title: { fontSize: 15, fontWeight: '700', color: C.textDark, marginBottom: 3 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cal: { fontSize: 12, fontWeight: '700', color: C.orange },
  servings: { fontSize: 12, color: C.textFaint },
  note: { fontSize: 12, color: C.textFaint, flex: 1 },
  removeBtn: { padding: 4 },
});

function MealSection({ mealType, plans, onAdd, onRemove, onPressRecipe }) {
  return (
    <View style={ms.section}>
      <View style={ms.header}>
        <Text style={ms.emoji}>{mealType.emoji}</Text>
        <Text style={ms.label}>{mealType.label}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onAdd} style={ms.addBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color={C.orange} />
        </TouchableOpacity>
      </View>
      {plans.length === 0 ? (
        <TouchableOpacity onPress={onAdd} style={ms.empty} activeOpacity={0.6}>
          <Text style={ms.emptyText}>Tap + to add a meal</Text>
        </TouchableOpacity>
      ) : (
        plans.map((p) => (
          <MealCard
            key={p.id}
            plan={p}
            onRemove={onRemove}
            onPress={onPressRecipe}
          />
        ))
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  section: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  emoji: { fontSize: 18, marginRight: 8 },
  label: { fontSize: 15, fontWeight: '700', color: C.textDark },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, color: C.textFaint },
});

// ── AI Chat bubble ─────────────────────────────────────────────────────────────

function AIMessage({ message, onApplyPlan }) {
  const isUser = message.role === 'user';
  return (
    <View style={[aim.row, isUser && aim.rowUser]}>
      {!isUser && (
        <View style={aim.avatar}>
          <Ionicons name="sparkles" size={14} color={C.orange} />
        </View>
      )}
      <View style={[aim.bubble, isUser ? aim.bubbleUser : aim.bubbleAI]}>
        <Text style={[aim.text, isUser && aim.textUser]}>{message.content}</Text>
        {message.planItems && message.planItems.length > 0 && (
          <View style={aim.planPreview}>
            <Text style={aim.planCount}>{message.planItems.length} meals suggested</Text>
            <TouchableOpacity onPress={() => onApplyPlan(message.planItems)} style={aim.applyBtn}>
              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              <Text style={aim.applyText}>Apply Plan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const aim = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 6, paddingHorizontal: 16, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    padding: 12,
    paddingHorizontal: 14,
  },
  bubbleAI: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: C.orange, borderBottomRightRadius: 4 },
  text: { fontSize: 14, color: C.textDark, lineHeight: 20 },
  textUser: { color: '#FFF' },
  planPreview: {
    marginTop: 10,
    padding: 10,
    backgroundColor: C.orangeLight,
    borderRadius: 10,
    alignItems: 'center',
    gap: 8,
  },
  planCount: { fontSize: 13, fontWeight: '600', color: C.textMed },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  applyText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Week & day state
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Data
  const [weekPlans, setWeekPlans] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);

  // Recipe picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // { date, mealType }
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState(null);
  const [pickerServings, setPickerServings] = useState(1);
  const [pickerAdding, setPickerAdding] = useState(false);

  // AI chat
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const aiListRef = useRef(null);

  // Preferences
  const [userPrefs, setUserPrefs] = useState({ allergies: '', budget: '', goal: '' });
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefsEdit, setPrefsEdit] = useState({ allergies: '', budget: '', goal: '' });

  // Derived
  const weekEnd = useMemo(() => toDateStr(addDays(weekStart, 6)), [weekStart]);
  const weekStartStr = useMemo(() => toDateStr(weekStart), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const selectedDayPlans = useMemo(
    () => weekPlans.filter((p) => p.plannedDate === selectedDate),
    [weekPlans, selectedDate]
  );

  const weekPlansByDate = useMemo(() => {
    const map = {};
    for (const p of weekPlans) {
      if (!map[p.plannedDate]) map[p.plannedDate] = 0;
      map[p.plannedDate]++;
    }
    return map;
  }, [weekPlans]);

  const filteredRecipes = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    if (!q) return allRecipes;
    return allRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [allRecipes, pickerSearch]);

  // ── Data loading ──────────────────────────────────────────────────────────
  function loadData() {
    try {
      const plans = getMealPlanForWeek(weekStartStr, weekEnd);
      setWeekPlans(plans);
    } catch (err) {
      logger.error('planner.loadData.error', { error: err.message });
    }
  }

  function loadRecipes() {
    try {
      const recipes = getAllRecipes();
      setAllRecipes(recipes);
    } catch (err) {
      logger.error('planner.loadRecipes.error', { error: err.message });
    }
  }

  function loadPrefs() {
    try {
      const raw = getSetting('planner_prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserPrefs(parsed);
      }
    } catch {
      // ignore
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadRecipes();
      loadPrefs();
    }, [weekStartStr, weekEnd])
  );

  // Reload when week changes
  const prevWeek = useCallback(() => {
    const newStart = addDays(weekStart, -7);
    setWeekStart(newStart);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [weekStart]);

  const nextWeek = useCallback(() => {
    const newStart = addDays(weekStart, 7);
    setWeekStart(newStart);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [weekStart]);

  // ── Meal actions ──────────────────────────────────────────────────────────
  function openPicker(date, mealType) {
    setPickerTarget({ date, mealType });
    setPickerSearch('');
    setPickerSelected(null);
    setPickerServings(1);
    setShowPicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function confirmAddMeal() {
    if (!pickerSelected || !pickerTarget) return;
    setPickerAdding(true);
    try {
      const nutrition = getNutrition(pickerSelected.id);
      const entry = {
        id: Crypto.randomUUID(),
        recipeId: pickerSelected.id,
        recipeTitle: pickerSelected.title,
        recipeImageUri: pickerSelected.imageUri ?? null,
        plannedDate: pickerTarget.date,
        mealType: pickerTarget.mealType,
        servings: pickerServings,
        calories: nutrition?.calories ?? null,
        protein: nutrition?.protein ?? null,
        carbs: nutrition?.carbs ?? null,
        fat: nutrition?.fat ?? null,
        createdAt: new Date().toISOString(),
      };
      addMealPlan(entry);
      loadData();
      setShowPicker(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      logger.error('planner.confirmAddMeal.error', { error: err.message });
      Alert.alert('Error', 'Could not add meal. Please try again.');
    } finally {
      setPickerAdding(false);
    }
  }

  function handleRemoveMeal(id) {
    Alert.alert('Remove meal?', 'This will remove it from your plan.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            removeMealPlan(id);
            loadData();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (err) {
            logger.error('planner.removeMeal.error', { error: err.message });
          }
        },
      },
    ]);
  }

  function handlePressRecipe(recipeId) {
    router.push(`/recipe/${recipeId}`);
  }

  // ── Save prefs ────────────────────────────────────────────────────────────
  function savePrefs() {
    try {
      setSetting('planner_prefs', JSON.stringify(prefsEdit));
      setUserPrefs(prefsEdit);
      setShowPrefs(false);
    } catch (err) {
      logger.error('planner.savePrefs.error', { error: err.message });
    }
  }

  // ── AI chat ───────────────────────────────────────────────────────────────
  async function sendAIMessage(text) {
    const msg = (text ?? aiInput).trim();
    if (!msg) return;

    const userMsg = {
      id: Crypto.randomUUID(),
      role: 'user',
      content: msg,
    };
    const next = [...aiMessages, userMsg];
    setAiMessages(next);
    setAiInput('');
    setAiTyping(true);

    setTimeout(() => aiListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const result = await chatMealPlanner({
        messages: next,
        prefs: userPrefs,
        recipeLibrary: allRecipes,
        weekStart: weekStartStr,
        weekEnd,
        currentPlan: weekPlans,
      });

      const assistantMsg = {
        id: Crypto.randomUUID(),
        role: 'assistant',
        content: result.message ?? '',
        planItems: result.type === 'meal_plan' ? result.items : null,
      };
      setAiMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => aiListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const errMsg = {
        id: Crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I ran into an error: ${err.message}`,
        planItems: null,
      };
      setAiMessages((prev) => [...prev, errMsg]);
    } finally {
      setAiTyping(false);
    }
  }

  function applyAIPlan(items) {
    Alert.alert(
      'Apply Meal Plan?',
      `This will add ${items.length} meals to your plan. Existing meals on those days won't be replaced.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            let added = 0;
            for (const item of items) {
              try {
                // Try to match recipe from library
                const match = allRecipes.find(
                  (r) => r.title.toLowerCase() === item.recipe_title?.toLowerCase()
                );
                const nutrition = match ? getNutrition(match.id) : null;
                const entry = {
                  id: Crypto.randomUUID(),
                  recipeId: match?.id ?? null,
                  recipeTitle: item.recipe_title ?? 'Suggested meal',
                  recipeImageUri: match?.imageUri ?? null,
                  plannedDate: item.date,
                  mealType: item.meal_type,
                  servings: item.servings ?? 1,
                  calories: nutrition?.calories ?? null,
                  protein: nutrition?.protein ?? null,
                  carbs: nutrition?.carbs ?? null,
                  fat: nutrition?.fat ?? null,
                  notes: item.notes ?? null,
                  createdAt: new Date().toISOString(),
                };
                addMealPlan(entry);
                added++;
              } catch (err) {
                logger.error('planner.applyAIPlan.item.error', { error: err.message });
              }
            }
            loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowAI(false);
            Alert.alert('Plan Applied! 🎉', `${added} meals added to your plan.`);
          },
        },
      ]
    );
  }

  const QUICK_PROMPTS = [
    'Plan a balanced week for me',
    'High-protein meals this week',
    'Quick meals under 30 min',
    'Budget-friendly week plan',
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  const today = todayStr();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Meal Planner</Text>
        <TouchableOpacity
          onPress={() => {
            setShowAI(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={s.aiButton}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={18} color={C.orange} />
          <Text style={s.aiButtonText}>AI Planner</Text>
        </TouchableOpacity>
      </View>

      {/* ── Week navigation ── */}
      <View style={s.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={s.navArrow} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.textMed} />
        </TouchableOpacity>
        <Text style={s.weekLabel}>{formatWeekLabel(weekStart)}</Text>
        <TouchableOpacity onPress={nextWeek} style={s.navArrow} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={22} color={C.textMed} />
        </TouchableOpacity>
      </View>

      {/* ── Day strip ── */}
      <View style={s.dayStrip}>
        {weekDays.map((d, i) => (
          <DayBubble
            key={i}
            date={d}
            dayName={DAY_NAMES[i]}
            isToday={toDateStr(d) === today}
            isSelected={toDateStr(d) === selectedDate}
            mealCount={weekPlansByDate[toDateStr(d)] ?? 0}
            onPress={() => {
              setSelectedDate(toDateStr(d));
              Haptics.selectionAsync();
            }}
          />
        ))}
      </View>

      {/* ── Day content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.dayTitle}>{formatDayHeader(selectedDate)}</Text>

        <DailyNutritionBar plans={selectedDayPlans} />

        {MEAL_TYPES.map((mt) => (
          <MealSection
            key={mt.key}
            mealType={mt}
            plans={selectedDayPlans.filter((p) => p.mealType === mt.key)}
            onAdd={() => openPicker(selectedDate, mt.key)}
            onRemove={handleRemoveMeal}
            onPressRecipe={handlePressRecipe}
          />
        ))}
      </ScrollView>

      {/* ── Recipe Picker Modal ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowPicker(false)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>
              Add to{' '}
              <Text style={{ color: C.orange }}>
                {MEAL_TYPES.find((m) => m.key === pickerTarget?.mealType)?.label ?? ''}
              </Text>
              {' · '}
              {pickerTarget ? formatDayHeader(pickerTarget.date).split(',')[0] : ''}
            </Text>

            <View style={s.searchRow}>
              <Ionicons name="search" size={18} color={C.textFaint} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search your recipes..."
                placeholderTextColor={C.textFaint}
              />
              {pickerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPickerSearch('')}>
                  <Ionicons name="close-circle" size={18} color={C.textFaint} />
                </TouchableOpacity>
              )}
            </View>

            {filteredRecipes.length === 0 ? (
              <View style={s.pickerEmpty}>
                <Ionicons name="book-outline" size={40} color={C.textFaint} />
                <Text style={s.pickerEmptyText}>
                  {allRecipes.length === 0
                    ? 'No recipes yet. Add some from the Recipes tab!'
                    : 'No recipes match your search.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredRecipes}
                keyExtractor={(r) => r.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 10 }}
                style={{ maxHeight: 300 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      s.recipePickerCard,
                      pickerSelected?.id === item.id && s.recipePickerCardSelected,
                    ]}
                    onPress={() => {
                      setPickerSelected(item);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.75}
                  >
                    {item.imageUri ? (
                      <Image source={{ uri: item.imageUri }} style={s.recipePickerImg} />
                    ) : (
                      <View style={[s.recipePickerImg, s.recipePickerImgPlaceholder]}>
                        <Ionicons name="restaurant-outline" size={24} color={C.textFaint} />
                      </View>
                    )}
                    <Text style={s.recipePickerTitle} numberOfLines={2}>{item.title}</Text>
                    {pickerSelected?.id === item.id && (
                      <View style={s.recipePickerCheck}>
                        <Ionicons name="checkmark-circle" size={20} color={C.orange} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            {pickerSelected && (
              <View style={s.servingsRow}>
                <Text style={s.servingsLabel}>Servings:</Text>
                <TouchableOpacity
                  onPress={() => pickerServings > 0.5 && setPickerServings((v) => Math.max(0.5, v - 0.5))}
                  style={s.servingsBtn}
                >
                  <Ionicons name="remove" size={20} color={C.textDark} />
                </TouchableOpacity>
                <Text style={s.servingsVal}>{pickerServings}</Text>
                <TouchableOpacity
                  onPress={() => setPickerServings((v) => v + 0.5)}
                  style={s.servingsBtn}
                >
                  <Ionicons name="add" size={20} color={C.textDark} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={confirmAddMeal}
                  style={[s.addMealBtn, pickerAdding && { opacity: 0.7 }]}
                  disabled={pickerAdding}
                  activeOpacity={0.8}
                >
                  {pickerAdding ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                      <Text style={s.addMealBtnText}>Add to Plan</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── AI Chat Modal ── */}
      <Modal
        visible={showAI}
        animationType="slide"
        onRequestClose={() => setShowAI(false)}
      >
        <View style={[s.aiModal, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={s.aiHeader}>
            <TouchableOpacity onPress={() => setShowAI(false)} style={s.aiClose}>
              <Ionicons name="chevron-down" size={24} color={C.textMed} />
            </TouchableOpacity>
            <View style={s.aiHeaderCenter}>
              <Ionicons name="sparkles" size={18} color={C.orange} style={{ marginRight: 6 }} />
              <Text style={s.aiTitle}>AI Meal Planner</Text>
            </View>
            <TouchableOpacity onPress={() => { setPrefsEdit({ ...userPrefs }); setShowPrefs(true); }} style={s.aiPrefsBtn}>
              <Ionicons name="options-outline" size={22} color={C.textMed} />
            </TouchableOpacity>
          </View>

          {/* Active prefs chips */}
          {(userPrefs.allergies || userPrefs.budget || userPrefs.goal) ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.prefChips}>
              {userPrefs.allergies ? (
                <View style={s.chip}><Text style={s.chipText}>🚫 {userPrefs.allergies}</Text></View>
              ) : null}
              {userPrefs.budget ? (
                <View style={s.chip}><Text style={s.chipText}>💰 {userPrefs.budget}</Text></View>
              ) : null}
              {userPrefs.goal ? (
                <View style={s.chip}><Text style={s.chipText}>🎯 {userPrefs.goal}</Text></View>
              ) : null}
            </ScrollView>
          ) : null}

          {/* Week context */}
          <View style={s.weekContext}>
            <Ionicons name="calendar-outline" size={14} color={C.textFaint} />
            <Text style={s.weekContextText}>Planning {formatWeekLabel(weekStart)}</Text>
          </View>

          {/* Messages */}
          {aiMessages.length === 0 ? (
            <View style={s.aiWelcome}>
              <View style={s.aiWelcomeIcon}>
                <Ionicons name="sparkles" size={32} color={C.orange} />
              </View>
              <Text style={s.aiWelcomeTitle}>Your AI Nutritionist</Text>
              <Text style={s.aiWelcomeBody}>
                Tell me your goals, allergies, or budget and I'll build a personalized meal plan for the week.
              </Text>
              <View style={s.quickPrompts}>
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={s.quickPrompt}
                    onPress={() => sendAIMessage(p)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.quickPromptText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView
              ref={aiListRef}
              style={s.aiMessages}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {aiMessages.map((m) => (
                <AIMessage key={m.id} message={m} onApplyPlan={applyAIPlan} />
              ))}
              {aiTyping && (
                <View style={[aim.row]}>
                  <View style={aim.avatar}>
                    <Ionicons name="sparkles" size={14} color={C.orange} />
                  </View>
                  <View style={[aim.bubble, aim.bubbleAI, { paddingVertical: 14, paddingHorizontal: 18 }]}>
                    <View style={s.typingDots}>
                      {[0, 1, 2].map((i) => (
                        <View key={i} style={s.typingDot} />
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={[s.aiInputRow, { paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                style={s.aiInput}
                value={aiInput}
                onChangeText={setAiInput}
                placeholder="Ask about meals, nutrition, allergies…"
                placeholderTextColor={C.textFaint}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => sendAIMessage()}
              />
              <TouchableOpacity
                onPress={() => sendAIMessage()}
                style={[s.sendBtn, (!aiInput.trim() || aiTyping) && { opacity: 0.4 }]}
                disabled={!aiInput.trim() || aiTyping}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Preferences Modal ── */}
      <Modal
        visible={showPrefs}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrefs(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowPrefs(false)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Your Preferences</Text>
            <Text style={s.prefsHint}>Help the AI planner personalise your meal suggestions.</Text>

            <Text style={s.prefsLabel}>Allergies / Dietary restrictions</Text>
            <TextInput
              style={s.prefsInput}
              value={prefsEdit.allergies}
              onChangeText={(v) => setPrefsEdit((p) => ({ ...p, allergies: v }))}
              placeholder="e.g. lactose intolerant, no nuts, vegan"
              placeholderTextColor={C.textFaint}
            />

            <Text style={s.prefsLabel}>Budget</Text>
            <TextInput
              style={s.prefsInput}
              value={prefsEdit.budget}
              onChangeText={(v) => setPrefsEdit((p) => ({ ...p, budget: v }))}
              placeholder="e.g. $50/week, budget-friendly"
              placeholderTextColor={C.textFaint}
            />

            <Text style={s.prefsLabel}>Health / Fitness goal</Text>
            <TextInput
              style={s.prefsInput}
              value={prefsEdit.goal}
              onChangeText={(v) => setPrefsEdit((p) => ({ ...p, goal: v }))}
              placeholder="e.g. lose weight, build muscle, balanced diet"
              placeholderTextColor={C.textFaint}
            />

            <TouchableOpacity style={s.savePrefsBtn} onPress={savePrefs} activeOpacity={0.8}>
              <Text style={s.savePrefsText}>Save Preferences</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.textDark },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orangeLight,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: '#FFD6BB',
  },
  aiButtonText: { fontSize: 14, fontWeight: '700', color: C.orange },

  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  navArrow: { padding: 6 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: C.textDark,
  },

  // Day strip
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  dayTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.textDark,
    marginBottom: 14,
  },

  // Bottom sheet overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.textDark,
    marginBottom: 14,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.textDark,
  },
  pickerEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  pickerEmptyText: { fontSize: 14, color: C.textFaint, textAlign: 'center', paddingHorizontal: 20 },

  // Recipe picker cards
  recipePickerCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 2,
  },
  recipePickerCardSelected: { borderColor: C.orange },
  recipePickerImg: { width: '100%', height: 90, backgroundColor: C.border },
  recipePickerImgPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.orangeLight,
  },
  recipePickerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textDark,
    padding: 8,
    paddingTop: 6,
  },
  recipePickerCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },

  // Servings + add
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  servingsLabel: { fontSize: 15, fontWeight: '600', color: C.textMed },
  servingsBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsVal: { fontSize: 18, fontWeight: '800', color: C.textDark, minWidth: 28, textAlign: 'center' },
  addMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  addMealBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // AI modal
  aiModal: { flex: 1, backgroundColor: C.bg },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  aiClose: { padding: 4 },
  aiHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  aiTitle: { fontSize: 17, fontWeight: '800', color: C.textDark },
  aiPrefsBtn: { padding: 4 },
  prefChips: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  chip: {
    backgroundColor: C.orangeLight,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FFD6BB',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: C.textMed },
  weekContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  weekContextText: { fontSize: 12, color: C.textFaint },
  aiWelcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  aiWelcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiWelcomeTitle: { fontSize: 22, fontWeight: '800', color: C.textDark, textAlign: 'center', marginBottom: 8 },
  aiWelcomeBody: { fontSize: 15, color: C.textMed, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  quickPrompts: { gap: 10, width: '100%' },
  quickPrompt: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  quickPromptText: { fontSize: 14, fontWeight: '600', color: C.textDark },
  aiMessages: { flex: 1 },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.textFaint },

  // AI input
  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    gap: 8,
  },
  aiInput: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: C.textDark,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Prefs
  prefsHint: { fontSize: 13, color: C.textFaint, marginBottom: 16 },
  prefsLabel: { fontSize: 13, fontWeight: '700', color: C.textMed, marginBottom: 6, marginTop: 12 },
  prefsInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.textDark,
  },
  savePrefsBtn: {
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  savePrefsText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
