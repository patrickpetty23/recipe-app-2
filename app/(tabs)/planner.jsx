import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import {
  getMealPlanForWeek,
  addMealPlan,
  removeMealPlan,
  clearMealPlanForWeek,
  getAllRecipes,
  getNutrition,
  getSetting,
  setSetting,
  logCook,
  saveRecipe,
  saveIngredients,
  saveRecipeSteps,
  saveNutrition,
  updateMealPlanRecipeId,
  addRecipeToList,
} from '../../src/db/queries';
import { chatMealPlanner, parseRecipeFromText } from '../../src/services/openai';
import { scheduleMealReminder } from '../../src/utils/notifications';
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
function toDateStr(date) { return date.toISOString().slice(0, 10); }
function todayStr() { return toDateStr(new Date()); }
function formatWeekLabel(monday) {
  const sunday = addDays(monday, 6);
  const o = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', o)} – ${sunday.toLocaleDateString('en-US', o)}`;
}
function formatDayHeader(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DayBubble({ date, dayName, isToday, isSelected, mealCount, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[bs.bubble, isSelected && bs.bubbleSel, isToday && !isSelected && bs.bubbleToday]}
    >
      <Text style={[bs.name, isSelected && bs.nameSel]}>{dayName}</Text>
      <Text style={[bs.num, isSelected && bs.numSel]}>{date.getDate()}</Text>
      <View style={bs.dots}>
        {Array.from({ length: Math.min(mealCount, 4) }).map((_, i) => (
          <View key={i} style={[bs.dot, isSelected && bs.dotSel]} />
        ))}
      </View>
    </TouchableOpacity>
  );
}
const bs = StyleSheet.create({
  bubble: { width: 44, paddingVertical: 10, borderRadius: 14, alignItems: 'center', marginHorizontal: 2 },
  bubbleSel: { backgroundColor: C.orange },
  bubbleToday: { backgroundColor: C.orangeLight },
  name: { fontSize: 11, fontWeight: '600', color: C.textFaint, marginBottom: 4 },
  nameSel: { color: '#fff' },
  num: { fontSize: 17, fontWeight: '700', color: C.textDark, marginBottom: 5 },
  numSel: { color: '#fff' },
  dots: { flexDirection: 'row', gap: 2, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.orange, opacity: 0.6 },
  dotSel: { backgroundColor: '#fff', opacity: 0.9 },
});

function DailyNutrition({ plans }) {
  const t = useMemo(() => plans.reduce((a, p) => {
    const s = p.servings ?? 1;
    return { cal: a.cal + (p.calories ?? 0) * s, pro: a.pro + (p.protein ?? 0) * s, carb: a.carb + (p.carbs ?? 0) * s, fat: a.fat + (p.fat ?? 0) * s };
  }, { cal: 0, pro: 0, carb: 0, fat: 0 }), [plans]);
  if (plans.length === 0 || t.cal === 0) return null;
  return (
    <View style={dn.card}>
      <Text style={dn.label}>Today's Nutrition</Text>
      <View style={dn.row}>
        {[['Calories', Math.round(t.cal), 'kcal', C.orange], ['Protein', Math.round(t.pro), 'g', C.blue], ['Carbs', Math.round(t.carb), 'g', C.green], ['Fat', Math.round(t.fat), 'g', C.pink]].map(([name, val, unit, color]) => (
          <View key={name} style={dn.badge}>
            <Text style={[dn.val, { color }]}>{val}</Text>
            <Text style={dn.unit}>{unit}</Text>
            <Text style={dn.name}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const dn = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 12, fontWeight: '700', color: C.textFaint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  badge: { alignItems: 'center' },
  val: { fontSize: 20, fontWeight: '800' },
  unit: { fontSize: 11, color: C.textFaint, marginTop: -1 },
  name: { fontSize: 11, color: C.textMed, marginTop: 2 },
});

function MealCard({ plan, onRemove, onPress, onLog, onGenerate, generating }) {
  const isLinked = !!plan.recipeId;
  const isCustom = !plan.recipeId && !plan.notes?.startsWith('ai:');
  const isAI = !plan.recipeId && plan.notes?.startsWith('ai:');

  return (
    <View style={[mc.card, isAI && mc.cardAI]}>
      {generating ? (
        <View style={mc.genOverlay}>
          <ActivityIndicator color={C.orange} />
          <Text style={mc.genText}>Generating recipe…</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={mc.inner}
        onPress={() => isLinked && onPress(plan.recipeId)}
        activeOpacity={isLinked ? 0.7 : 1}
      >
        {plan.recipeImageUri ? (
          <Image source={{ uri: plan.recipeImageUri }} style={mc.img} />
        ) : (
          <View style={mc.imgPlaceholder}>
            <Text style={{ fontSize: 22 }}>
              {isCustom ? '✏️' : isAI ? '✨' : '🍽️'}
            </Text>
          </View>
        )}
        <View style={mc.info}>
          <Text style={mc.title} numberOfLines={1}>{plan.recipeTitle}</Text>
          <View style={mc.meta}>
            {plan.calories != null
              ? <Text style={mc.cal}>{Math.round((plan.calories ?? 0) * (plan.servings ?? 1))} kcal</Text>
              : null}
            <Text style={mc.srv}>· {plan.servings ?? 1} serving{(plan.servings ?? 1) !== 1 ? 's' : ''}</Text>
            {isAI && <Text style={mc.aiTag}>AI suggestion</Text>}
            {isCustom && <Text style={mc.customTag}>Custom</Text>}
          </View>
        </View>
      </TouchableOpacity>
      <View style={mc.actions}>
        {isLinked && plan.calories != null && (
          <TouchableOpacity onPress={() => onLog(plan)} style={mc.actionBtn} hitSlop={{ top: 10, right: 6, bottom: 10, left: 6 }}>
            <Ionicons name="checkmark-done-outline" size={18} color={C.green} />
          </TouchableOpacity>
        )}
        {isAI && !generating && (
          <TouchableOpacity onPress={() => onGenerate(plan)} style={mc.actionBtn} hitSlop={{ top: 10, right: 6, bottom: 10, left: 6 }}>
            <Ionicons name="sparkles-outline" size={18} color={C.orange} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => onRemove(plan.id)} style={mc.actionBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 6 }}>
          <Ionicons name="close-circle" size={20} color={C.textFaint} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const mc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 8,
  },
  cardAI: { borderStyle: 'dashed', borderColor: C.orange + '80' },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  img: { width: 52, height: 52, borderRadius: 10, backgroundColor: C.border },
  imgPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: C.orangeLight, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 10 },
  title: { fontSize: 15, fontWeight: '700', color: C.textDark, marginBottom: 3 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  cal: { fontSize: 12, fontWeight: '700', color: C.orange },
  srv: { fontSize: 12, color: C.textFaint },
  aiTag: { fontSize: 11, color: C.orange, fontWeight: '600', backgroundColor: C.orangeLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  customTag: { fontSize: 11, color: C.blue, fontWeight: '600', backgroundColor: '#EEF0FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { padding: 4 },
  genOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8 },
  genText: { fontSize: 13, color: C.textMed, fontWeight: '600' },
});

function MealSection({ mealType, plans, onAdd, onRemove, onPress, onLog, onGenerate, generatingForId }) {
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
          <Text style={ms.emptyText}>Tap + to add</Text>
        </TouchableOpacity>
      ) : (
        plans.map((p) => (
          <MealCard
            key={p.id}
            plan={p}
            onRemove={onRemove}
            onPress={onPress}
            onLog={onLog}
            onGenerate={onGenerate}
            generating={generatingForId === p.id}
          />
        ))
      )}
    </View>
  );
}
const ms = StyleSheet.create({
  section: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  emoji: { fontSize: 18, marginRight: 8 },
  label: { fontSize: 15, fontWeight: '700', color: C.textDark },
  addBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.orangeLight, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  emptyText: { fontSize: 13, color: C.textFaint },
});

function WeekOverview({ weekDays, weekPlans, today, onDayPress }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {weekDays.map((d, i) => {
        const dateStr = toDateStr(d);
        const dayPlans = weekPlans.filter((p) => p.plannedDate === dateStr);
        const totalCal = dayPlans.reduce((s, p) => s + (p.calories ?? 0) * (p.servings ?? 1), 0);
        const isToday = dateStr === today;
        return (
          <TouchableOpacity key={i} onPress={() => onDayPress(dateStr)} activeOpacity={0.7}
            style={[wo.row, isToday && wo.rowToday]}
          >
            <View style={wo.dayCol}>
              <Text style={[wo.dayName, isToday && wo.dayNameToday]}>{DAY_NAMES[i]}</Text>
              <Text style={[wo.dayDate, isToday && wo.dayDateToday]}>{d.getDate()}</Text>
            </View>
            <View style={wo.mealsCol}>
              {dayPlans.length === 0 ? (
                <Text style={wo.empty}>Nothing planned</Text>
              ) : (
                <View style={wo.chips}>
                  {dayPlans.map((p) => {
                    const mt = MEAL_TYPES.find((m) => m.key === p.mealType);
                    return (
                      <View key={p.id} style={[wo.chip, { backgroundColor: (mt?.color ?? C.orange) + '18' }]}>
                        <Text style={wo.chipEmoji}>{mt?.emoji ?? '🍽️'}</Text>
                        <Text style={wo.chipTitle} numberOfLines={1}>{p.recipeTitle}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            <View style={wo.calCol}>
              {totalCal > 0 && <Text style={wo.cal}>{Math.round(totalCal)}</Text>}
              {totalCal > 0 && <Text style={wo.calUnit}>kcal</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
const wo = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, gap: 10,
  },
  rowToday: { borderColor: C.orange, backgroundColor: C.orangeLight },
  dayCol: { width: 40, alignItems: 'center' },
  dayName: { fontSize: 12, fontWeight: '700', color: C.textFaint },
  dayNameToday: { color: C.orange },
  dayDate: { fontSize: 18, fontWeight: '800', color: C.textDark },
  dayDateToday: { color: C.orange },
  mealsCol: { flex: 1 },
  empty: { fontSize: 12, color: C.textFaint, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, gap: 3 },
  chipEmoji: { fontSize: 12 },
  chipTitle: { fontSize: 11, fontWeight: '600', color: C.textMed, maxWidth: 80 },
  calCol: { alignItems: 'flex-end', minWidth: 48 },
  cal: { fontSize: 14, fontWeight: '800', color: C.textDark },
  calUnit: { fontSize: 10, color: C.textFaint },
});

function AIMessage({ message, onApplyPlan }) {
  const isUser = message.role === 'user';
  return (
    <View style={[ai.row, isUser && ai.rowUser]}>
      {!isUser && (
        <View style={ai.avatar}><Ionicons name="sparkles" size={14} color={C.orange} /></View>
      )}
      <View style={[ai.bubble, isUser ? ai.bubbleUser : ai.bubbleAI]}>
        <Text style={[ai.text, isUser && ai.textUser]}>{message.content}</Text>
        {message.planItems?.length > 0 && (
          <View style={ai.planBox}>
            {message.planItems.slice(0, 4).map((item, i) => {
              const mt = MEAL_TYPES.find((m) => m.key === item.meal_type);
              return (
                <View key={i} style={ai.planItem}>
                  <Text style={ai.planItemEmoji}>{mt?.emoji ?? '🍽️'}</Text>
                  <Text style={ai.planItemText} numberOfLines={1}>{item.recipe_title}</Text>
                  <Text style={ai.planItemDate}>{new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                </View>
              );
            })}
            {message.planItems.length > 4 && (
              <Text style={ai.planMore}>+{message.planItems.length - 4} more meals</Text>
            )}
            <TouchableOpacity onPress={() => onApplyPlan(message.planItems)} style={ai.applyBtn}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={ai.applyText}>Apply {message.planItems.length} meals to plan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
const ai = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 5, paddingHorizontal: 16, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.orangeLight, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, paddingHorizontal: 14 },
  bubbleAI: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: C.orange, borderBottomRightRadius: 4 },
  text: { fontSize: 14, color: C.textDark, lineHeight: 20 },
  textUser: { color: '#fff' },
  planBox: { marginTop: 10, backgroundColor: C.orangeLight, borderRadius: 10, padding: 10, gap: 6 },
  planItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planItemEmoji: { fontSize: 14, width: 20 },
  planItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.textDark },
  planItemDate: { fontSize: 11, color: C.textFaint },
  planMore: { fontSize: 12, color: C.textFaint, textAlign: 'center' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.orange, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, gap: 6, marginTop: 4 },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openAI: openAIParam, query: queryParam } = useLocalSearchParams();

  // Week & view
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'

  // Data
  const [weekPlans, setWeekPlans] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);

  // Recipe picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pickerMode, setPickerMode] = useState('recipe'); // 'recipe' | 'custom'
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState(null);
  const [pickerServings, setPickerServings] = useState(1);
  const [pickerAdding, setPickerAdding] = useState(false);

  // Custom item form
  const [customName, setCustomName] = useState('');
  const [customCal, setCustomCal] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [showCustomMacros, setShowCustomMacros] = useState(false);

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

  // Undo
  const [undoIds, setUndoIds] = useState([]);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimerRef = useRef(null);

  // Generate recipe for AI suggestion
  const [generatingForId, setGeneratingForId] = useState(null);

  // Derived
  const weekEnd = useMemo(() => toDateStr(addDays(weekStart, 6)), [weekStart]);
  const weekStartStr = useMemo(() => toDateStr(weekStart), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const selectedDayPlans = useMemo(() => weekPlans.filter((p) => p.plannedDate === selectedDate), [weekPlans, selectedDate]);
  const weekPlansByDate = useMemo(() => {
    const map = {};
    for (const p of weekPlans) { map[p.plannedDate] = (map[p.plannedDate] ?? 0) + 1; }
    return map;
  }, [weekPlans]);
  const filteredRecipes = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    return q ? allRecipes.filter((r) => r.title.toLowerCase().includes(q)) : allRecipes;
  }, [allRecipes, pickerSearch]);

  // ── Auto-open AI from route param ─────────────────────────────────────────
  useEffect(() => {
    if (openAIParam === 'true') {
      setShowAI(true);
      if (queryParam) {
        setAiInput(String(queryParam));
      }
    }
  }, [openAIParam, queryParam]);

  // ── Data loading ──────────────────────────────────────────────────────────
  function loadData() {
    try { setWeekPlans(getMealPlanForWeek(weekStartStr, weekEnd)); }
    catch (err) { logger.error('planner.loadData', { error: err.message }); }
  }
  function loadRecipes() {
    try { setAllRecipes(getAllRecipes()); }
    catch (err) { logger.error('planner.loadRecipes', { error: err.message }); }
  }
  function loadPrefs() {
    try {
      const raw = getSetting('planner_prefs');
      if (raw) setUserPrefs(JSON.parse(raw));
    } catch { /* ignore */ }
  }

  useFocusEffect(useCallback(() => {
    loadData(); loadRecipes(); loadPrefs();
  }, [weekStartStr, weekEnd]));

  const prevWeek = () => { setWeekStart((w) => addDays(w, -7)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const nextWeek = () => { setWeekStart((w) => addDays(w, 7)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  function handleClearWeek() {
    Alert.alert('Clear this week?', 'All planned meals for this week will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        try {
          clearMealPlanForWeek(weekStartStr, weekEnd);
          loadData();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) { logger.error('planner.clearWeek', { error: err.message }); }
      }},
    ]);
  }

  // ── Picker ────────────────────────────────────────────────────────────────
  function openPicker(date, mealType) {
    setPickerTarget({ date, mealType });
    setPickerSearch(''); setPickerSelected(null); setPickerServings(1);
    setPickerMode('recipe');
    setCustomName(''); setCustomCal(''); setCustomProtein(''); setCustomCarbs(''); setCustomFat('');
    setShowCustomMacros(false);
    setShowPicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function confirmAddRecipe() {
    if (!pickerSelected || !pickerTarget) return;
    setPickerAdding(true);
    try {
      const ntr = getNutrition(pickerSelected.id);
      addMealPlan({
        id: Crypto.randomUUID(),
        recipeId: pickerSelected.id,
        recipeTitle: pickerSelected.title,
        recipeImageUri: pickerSelected.imageUri ?? null,
        plannedDate: pickerTarget.date,
        mealType: pickerTarget.mealType,
        servings: pickerServings,
        calories: ntr?.calories ?? null,
        protein: ntr?.protein ?? null,
        carbs: ntr?.carbs ?? null,
        fat: ntr?.fat ?? null,
        createdAt: new Date().toISOString(),
      });
      // Fire-and-forget reminder notification
      scheduleMealReminder({
        recipeTitle: pickerSelected.title,
        plannedDate: pickerTarget.date,
        mealType: pickerTarget.mealType,
      }).catch(() => {});
      loadData(); setShowPicker(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      logger.error('planner.addRecipe', { error: err.message });
      Alert.alert('Error', 'Could not add meal.');
    } finally { setPickerAdding(false); }
  }

  function confirmAddCustom() {
    const name = customName.trim();
    if (!name) { Alert.alert('Name required', 'Please enter a meal name.'); return; }
    if (!pickerTarget) return;
    try {
      addMealPlan({
        id: Crypto.randomUUID(),
        recipeId: null,
        recipeTitle: name,
        recipeImageUri: null,
        plannedDate: pickerTarget.date,
        mealType: pickerTarget.mealType,
        servings: 1,
        calories: customCal ? parseFloat(customCal) || null : null,
        protein: customProtein ? parseFloat(customProtein) || null : null,
        carbs: customCarbs ? parseFloat(customCarbs) || null : null,
        fat: customFat ? parseFloat(customFat) || null : null,
        createdAt: new Date().toISOString(),
      });
      // Fire-and-forget reminder notification
      scheduleMealReminder({
        recipeTitle: name,
        plannedDate: pickerTarget.date,
        mealType: pickerTarget.mealType,
      }).catch(() => {});
      loadData(); setShowPicker(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      logger.error('planner.addCustom', { error: err.message });
      Alert.alert('Error', err.message);
    }
  }

  function handleRemoveMeal(id) {
    Alert.alert('Remove meal?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        try { removeMealPlan(id); loadData(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
        catch (err) { logger.error('planner.removeMeal', { error: err.message }); }
      }},
    ]);
  }

  function handleLogToTracker(plan) {
    const cal = plan.calories != null ? Math.round(plan.calories * (plan.servings ?? 1)) : null;
    Alert.alert(
      'Log to Tracker?',
      `${plan.recipeTitle}${cal ? ` — ${cal} kcal` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log It', onPress: () => {
          try {
            logCook({
              id: Crypto.randomUUID(),
              recipeId: plan.recipeId ?? null,
              recipeTitle: plan.recipeTitle,
              servings: plan.servings ?? 1,
              calories: plan.calories != null ? Math.round(plan.calories * (plan.servings ?? 1)) : null,
              protein: plan.protein != null ? plan.protein * (plan.servings ?? 1) : null,
              carbs: plan.carbs != null ? plan.carbs * (plan.servings ?? 1) : null,
              fat: plan.fat != null ? plan.fat * (plan.servings ?? 1) : null,
              cookedAt: new Date().toISOString(),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) { logger.error('planner.logTracker', { error: err.message }); }
        }},
      ]
    );
  }

  async function handleGenerateRecipe(plan) {
    setGeneratingForId(plan.id);
    try {
      const recipeData = await parseRecipeFromText(`Generate a complete recipe for: ${plan.recipeTitle}`);
      const recipeId = Crypto.randomUUID();
      const now = new Date().toISOString();
      saveRecipe({
        id: recipeId, title: recipeData.title ?? plan.recipeTitle,
        sourceType: 'ai', sourceUri: null, sourceUrl: null, imageUri: null,
        servings: recipeData.servings ?? 2,
        instructions: null, prepTime: recipeData.prepTime ?? null,
        cookTime: recipeData.cookTime ?? null, cuisine: recipeData.cuisine ?? null,
        createdAt: now, updatedAt: now,
      });
      if (recipeData.ingredients?.length) saveIngredients(recipeId, recipeData.ingredients.map((ing, i) => ({ id: Crypto.randomUUID(), recipeId, name: ing.name, quantity: ing.quantity ?? null, unit: ing.unit ?? null, notes: ing.notes ?? null, checked: false, inList: false, sortOrder: i })));
      if (recipeData.steps?.length) saveRecipeSteps(recipeId, recipeData.steps.map((s) => ({ id: Crypto.randomUUID(), recipeId, stepNumber: s.stepNumber, instruction: s.instruction, illustrationUrl: null })));
      updateMealPlanRecipeId(plan.id, recipeId, null);
      loadData(); loadRecipes();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Recipe Generated! 🎉', `"${recipeData.title}" was saved to your library and linked to your plan.`, [
        { text: 'View Recipe', onPress: () => router.push(`/recipe/${recipeId}`) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (err) {
      logger.error('planner.generateRecipe', { error: err.message });
      Alert.alert('Generation Failed', err.message);
    } finally { setGeneratingForId(null); }
  }

  function handleShoppingList() {
    const recipeIds = [...new Set(weekPlans.filter((p) => p.recipeId).map((p) => p.recipeId))];
    if (recipeIds.length === 0) { Alert.alert('No linked recipes', 'Add recipes from your library to the plan first.'); return; }
    try {
      recipeIds.forEach((rid) => addRecipeToList(rid));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(tabs)/list');
    } catch (err) { logger.error('planner.shoppingList', { error: err.message }); }
  }

  // ── Prefs ─────────────────────────────────────────────────────────────────
  function savePrefs() {
    try { setSetting('planner_prefs', JSON.stringify(prefsEdit)); setUserPrefs(prefsEdit); setShowPrefs(false); }
    catch (err) { logger.error('planner.savePrefs', { error: err.message }); }
  }

  // ── AI chat ───────────────────────────────────────────────────────────────
  async function sendAIMessage(text) {
    const msg = (text ?? aiInput).trim();
    if (!msg) return;
    const userMsg = { id: Crypto.randomUUID(), role: 'user', content: msg };
    const next = [...aiMessages, userMsg];
    setAiMessages(next); setAiInput(''); setAiTyping(true);
    setTimeout(() => aiListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const result = await chatMealPlanner({ messages: next, prefs: userPrefs, recipeLibrary: allRecipes, weekStart: weekStartStr, weekEnd, currentPlan: weekPlans });
      setAiMessages((prev) => [...prev, { id: Crypto.randomUUID(), role: 'assistant', content: result.message ?? '', planItems: result.type === 'meal_plan' ? result.items : null }]);
      setTimeout(() => aiListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setAiMessages((prev) => [...prev, { id: Crypto.randomUUID(), role: 'assistant', content: `Sorry, something went wrong: ${err.message}`, planItems: null }]);
    } finally { setAiTyping(false); }
  }

  function applyAIPlan(items) {
    Alert.alert('Apply Meal Plan?', `Add ${items.length} meals to your plan?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: () => {
        const newIds = [];
        for (const item of items) {
          try {
            const match = allRecipes.find((r) => r.title.toLowerCase() === item.recipe_title?.toLowerCase());
            const ntr = match ? getNutrition(match.id) : null;
            const entryId = Crypto.randomUUID();
            addMealPlan({
              id: entryId,
              recipeId: match?.id ?? null,
              recipeTitle: item.recipe_title ?? 'Suggested meal',
              recipeImageUri: match?.imageUri ?? null,
              plannedDate: item.date,
              mealType: item.meal_type,
              servings: item.servings ?? 1,
              calories: ntr?.calories ?? null,
              protein: ntr?.protein ?? null,
              carbs: ntr?.carbs ?? null,
              fat: ntr?.fat ?? null,
              // Mark AI-unlinked entries so we can show the generate button
              notes: match ? null : 'ai:suggested',
              createdAt: new Date().toISOString(),
            });
            newIds.push(entryId);
          } catch (err) { logger.error('planner.applyPlan.item', { error: err.message }); }
        }
        loadData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Schedule reminders for all applied items (non-blocking)
        for (const item of items) {
          scheduleMealReminder({
            recipeTitle: item.recipe_title ?? 'Planned meal',
            plannedDate: item.date,
            mealType: item.meal_type,
          }).catch(() => {});
        }
        setUndoIds(newIds); setShowUndo(true);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => { setShowUndo(false); setUndoIds([]); }, 6000);
        setShowAI(false);
      }},
    ]);
  }

  function handleUndo() {
    clearTimeout(undoTimerRef.current);
    for (const id of undoIds) { try { removeMealPlan(id); } catch { /* ignore */ } }
    loadData(); setShowUndo(false); setUndoIds([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const QUICK_PROMPTS = [
    'Plan a balanced week for me',
    'High-protein meals this week',
    'Quick meals under 30 min',
    'Budget-friendly week',
  ];

  const today = todayStr();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Meal Planner</Text>
        <View style={s.headerActions}>
          {weekPlans.length > 0 && (
            <TouchableOpacity onPress={handleShoppingList} style={s.headerIconBtn} activeOpacity={0.7}>
              <Ionicons name="cart-outline" size={22} color={C.textMed} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { setShowAI(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={s.aiBtn} activeOpacity={0.85}>
            <Ionicons name="sparkles" size={17} color={C.orange} />
            <Text style={s.aiBtnText}>AI Plan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Week nav */}
      <View style={s.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={s.navArrow}>
          <Ionicons name="chevron-back" size={22} color={C.textMed} />
        </TouchableOpacity>
        <Text style={s.weekLabel}>{formatWeekLabel(weekStart)}</Text>
        <TouchableOpacity onPress={nextWeek} style={s.navArrow}>
          <Ionicons name="chevron-forward" size={22} color={C.textMed} />
        </TouchableOpacity>
        <View style={s.viewToggle}>
          {['day', 'week'].map((mode) => (
            <TouchableOpacity key={mode} onPress={() => { setViewMode(mode); if (mode === 'day') Haptics.selectionAsync(); }} style={[s.viewToggleBtn, viewMode === mode && s.viewToggleBtnSel]}>
              <Text style={[s.viewToggleText, viewMode === mode && s.viewToggleTextSel]}>{mode === 'day' ? 'Day' : 'Week'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={handleClearWeek} style={s.clearBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 4 }}>
          <Ionicons name="trash-outline" size={17} color={C.textFaint} />
        </TouchableOpacity>
      </View>

      {viewMode === 'week' ? (
        <WeekOverview
          weekDays={weekDays}
          weekPlans={weekPlans}
          today={today}
          onDayPress={(dateStr) => { setSelectedDate(dateStr); setViewMode('day'); }}
        />
      ) : (
        <>
          {/* Day strip */}
          <View style={s.dayStrip}>
            {weekDays.map((d, i) => (
              <DayBubble key={i} date={d} dayName={DAY_NAMES[i]}
                isToday={toDateStr(d) === today}
                isSelected={toDateStr(d) === selectedDate}
                mealCount={weekPlansByDate[toDateStr(d)] ?? 0}
                onPress={() => { setSelectedDate(toDateStr(d)); Haptics.selectionAsync(); }}
              />
            ))}
          </View>

          {/* Day content */}
          <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
            <Text style={s.dayTitle}>{formatDayHeader(selectedDate)}</Text>
            <DailyNutrition plans={selectedDayPlans} />
            {MEAL_TYPES.map((mt) => (
              <MealSection key={mt.key} mealType={mt}
                plans={selectedDayPlans.filter((p) => p.mealType === mt.key)}
                onAdd={() => openPicker(selectedDate, mt.key)}
                onRemove={handleRemoveMeal}
                onPress={(id) => router.push(`/recipe/${id}`)}
                onLog={handleLogToTracker}
                onGenerate={handleGenerateRecipe}
                generatingForId={generatingForId}
              />
            ))}
          </ScrollView>
        </>
      )}

      {/* Undo toast */}
      {showUndo && (
        <View style={[s.undoToast, { bottom: insets.bottom + 80 }]}>
          <Text style={s.undoText}>Plan applied ✓</Text>
          <TouchableOpacity onPress={handleUndo} style={s.undoBtn}>
            <Text style={s.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recipe Picker Modal ── */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowPicker(false)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={s.handle} />

            {/* Picker header */}
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>
                Add to <Text style={{ color: C.orange }}>{MEAL_TYPES.find((m) => m.key === pickerTarget?.mealType)?.label ?? ''}</Text>
                {pickerTarget ? ` · ${new Date(pickerTarget.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
              </Text>
              {/* Mode toggle */}
              <View style={s.pickerModeToggle}>
                {[['recipe', 'From Library'], ['custom', 'Custom Item']].map(([mode, label]) => (
                  <TouchableOpacity key={mode} onPress={() => setPickerMode(mode)} style={[s.pickerModeBtn, pickerMode === mode && s.pickerModeBtnSel]}>
                    <Text style={[s.pickerModeText, pickerMode === mode && s.pickerModeTextSel]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {pickerMode === 'recipe' ? (
              <>
                <View style={s.searchRow}>
                  <Ionicons name="search" size={18} color={C.textFaint} style={{ marginRight: 8 }} />
                  <TextInput style={s.searchInput} value={pickerSearch} onChangeText={setPickerSearch} placeholder="Search your recipes…" placeholderTextColor={C.textFaint} />
                  {pickerSearch.length > 0 && <TouchableOpacity onPress={() => setPickerSearch('')}><Ionicons name="close-circle" size={18} color={C.textFaint} /></TouchableOpacity>}
                </View>

                {filteredRecipes.length === 0 ? (
                  <View style={s.pickerEmpty}>
                    <Ionicons name="book-outline" size={40} color={C.textFaint} />
                    <Text style={s.pickerEmptyText}>{allRecipes.length === 0 ? 'No saved recipes yet. Add some in the Recipes tab!' : 'No matches. Try Custom Item.'}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredRecipes} keyExtractor={(r) => r.id}
                    numColumns={2} columnWrapperStyle={{ gap: 10 }}
                    style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[s.recipeCard, pickerSelected?.id === item.id && s.recipeCardSel]} onPress={() => { setPickerSelected(item); Haptics.selectionAsync(); }} activeOpacity={0.75}>
                        {item.imageUri
                          ? <Image source={{ uri: item.imageUri }} style={s.recipeCardImg} />
                          : <View style={[s.recipeCardImg, s.recipeCardImgPlaceholder]}><Ionicons name="restaurant-outline" size={24} color={C.textFaint} /></View>}
                        <Text style={s.recipeCardTitle} numberOfLines={2}>{item.title}</Text>
                        {pickerSelected?.id === item.id && <View style={s.recipeCardCheck}><Ionicons name="checkmark-circle" size={20} color={C.orange} /></View>}
                      </TouchableOpacity>
                    )}
                  />
                )}

                {pickerSelected && (
                  <View style={s.servingsRow}>
                    <Text style={s.servingsLabel}>Servings:</Text>
                    <TouchableOpacity onPress={() => setPickerServings((v) => Math.max(0.5, v - 0.5))} style={s.servBtn}><Ionicons name="remove" size={20} color={C.textDark} /></TouchableOpacity>
                    <Text style={s.servVal}>{pickerServings}</Text>
                    <TouchableOpacity onPress={() => setPickerServings((v) => v + 0.5)} style={s.servBtn}><Ionicons name="add" size={20} color={C.textDark} /></TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={confirmAddRecipe} style={[s.addBtn, pickerAdding && { opacity: 0.6 }]} disabled={pickerAdding} activeOpacity={0.85}>
                      {pickerAdding ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="add-circle-outline" size={18} color="#fff" /><Text style={s.addBtnText}>Add to Plan</Text></>}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              /* Custom item form */
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.customLabel}>Meal name *</Text>
                <TextInput
                  style={s.customInput} value={customName} onChangeText={setCustomName}
                  placeholder="e.g. Protein shake, Greek yogurt, Toast…"
                  placeholderTextColor={C.textFaint} autoFocus
                />
                <Text style={s.customLabel}>Calories (optional)</Text>
                <TextInput style={s.customInput} value={customCal} onChangeText={setCustomCal} placeholder="e.g. 320" placeholderTextColor={C.textFaint} keyboardType="numeric" />

                <TouchableOpacity onPress={() => setShowCustomMacros((v) => !v)} style={s.macroToggle}>
                  <Ionicons name={showCustomMacros ? 'chevron-up' : 'chevron-down'} size={16} color={C.orange} />
                  <Text style={s.macroToggleText}>{showCustomMacros ? 'Hide macros' : '+ Add macros (optional)'}</Text>
                </TouchableOpacity>

                {showCustomMacros && (
                  <View style={s.macrosRow}>
                    {[['Protein (g)', customProtein, setCustomProtein], ['Carbs (g)', customCarbs, setCustomCarbs], ['Fat (g)', customFat, setCustomFat]].map(([label, val, set]) => (
                      <View key={label} style={{ flex: 1 }}>
                        <Text style={s.macroLabel}>{label}</Text>
                        <TextInput style={s.macroInput} value={val} onChangeText={set} placeholder="0" placeholderTextColor={C.textFaint} keyboardType="numeric" />
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity onPress={confirmAddCustom} style={[s.addBtn, { marginTop: 20 }]} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={s.addBtnText}>Add to Plan</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── AI Chat Modal ── */}
      <Modal visible={showAI} animationType="slide" onRequestClose={() => setShowAI(false)}>
        <View style={[s.aiModal, { paddingTop: insets.top }]}>
          <View style={s.aiHeader}>
            <TouchableOpacity onPress={() => setShowAI(false)} style={{ padding: 4 }}>
              <Ionicons name="chevron-down" size={24} color={C.textMed} />
            </TouchableOpacity>
            <View style={s.aiHeaderCenter}>
              <Ionicons name="sparkles" size={17} color={C.orange} style={{ marginRight: 6 }} />
              <Text style={s.aiTitle}>AI Meal Planner</Text>
            </View>
            <TouchableOpacity onPress={() => { setPrefsEdit({ ...userPrefs }); setShowPrefs(true); }} style={{ padding: 4 }}>
              <Ionicons name="options-outline" size={22} color={C.textMed} />
            </TouchableOpacity>
          </View>

          {/* Prefs chips */}
          {(userPrefs.allergies || userPrefs.budget || userPrefs.goal) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.prefChips}>
              {userPrefs.allergies && <View style={s.chip}><Text style={s.chipText}>🚫 {userPrefs.allergies}</Text></View>}
              {userPrefs.budget && <View style={s.chip}><Text style={s.chipText}>💰 {userPrefs.budget}</Text></View>}
              {userPrefs.goal && <View style={s.chip}><Text style={s.chipText}>🎯 {userPrefs.goal}</Text></View>}
            </ScrollView>
          )}

          <View style={s.weekCtx}>
            <Ionicons name="calendar-outline" size={13} color={C.textFaint} />
            <Text style={s.weekCtxText}>Planning {formatWeekLabel(weekStart)}</Text>
          </View>

          {aiMessages.length === 0 ? (
            <View style={s.aiWelcome}>
              <View style={s.aiWelcomeIcon}><Ionicons name="sparkles" size={32} color={C.orange} /></View>
              <Text style={s.aiWelcomeTitle}>Your AI Nutritionist</Text>
              <Text style={s.aiWelcomeBody}>Tell me your goals, allergies, or budget and I'll build a personalised meal plan — using your saved recipes or suggesting new ones.</Text>
              <View style={s.quickPrompts}>
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity key={p} onPress={() => sendAIMessage(p)} style={s.quickPrompt} activeOpacity={0.7}>
                    <Text style={s.quickPromptText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView ref={aiListRef} style={s.aiMessages} contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
              {aiMessages.map((m) => <AIMessage key={m.id} message={m} onApplyPlan={applyAIPlan} />)}
              {aiTyping && (
                <View style={[ai.row]}>
                  <View style={ai.avatar}><Ionicons name="sparkles" size={14} color={C.orange} /></View>
                  <View style={[ai.bubble, ai.bubbleAI, { paddingVertical: 14 }]}>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      {[0, 1, 2].map((i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.textFaint }} />)}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.aiInputRow, { paddingBottom: insets.bottom + 8 }]}>
              <TextInput style={s.aiInput} value={aiInput} onChangeText={setAiInput} placeholder="Ask about meals, nutrition, allergies…" placeholderTextColor={C.textFaint} multiline maxLength={500} />
              <TouchableOpacity onPress={() => sendAIMessage()} style={[s.sendBtn, (!aiInput.trim() || aiTyping) && { opacity: 0.4 }]} disabled={!aiInput.trim() || aiTyping} activeOpacity={0.85}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Preferences Modal ── */}
      <Modal visible={showPrefs} transparent animationType="slide" onRequestClose={() => setShowPrefs(false)}>
        <Pressable style={s.overlay} onPress={() => setShowPrefs(false)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.pickerTitle}>Your Preferences</Text>
            <Text style={{ fontSize: 13, color: C.textFaint, marginBottom: 14 }}>Shared with the AI to personalise your meal plan.</Text>
            {[['Allergies / Dietary restrictions', 'allergies', 'e.g. lactose intolerant, nut allergy, vegan'], ['Budget', 'budget', 'e.g. $50/week, budget-friendly'], ['Health / Fitness goal', 'goal', 'e.g. lose weight, build muscle']].map(([label, key, ph]) => (
              <View key={key}>
                <Text style={s.customLabel}>{label}</Text>
                <TextInput style={s.customInput} value={prefsEdit[key]} onChangeText={(v) => setPrefsEdit((p) => ({ ...p, [key]: v }))} placeholder={ph} placeholderTextColor={C.textFaint} />
              </View>
            ))}
            <TouchableOpacity style={[s.addBtn, { marginTop: 20 }]} onPress={savePrefs} activeOpacity={0.85}>
              <Text style={s.addBtnText}>Save Preferences</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 26, fontWeight: '800', color: C.textDark },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.orangeLight, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13, gap: 5, borderWidth: 1, borderColor: '#FFD6BB' },
  aiBtnText: { fontSize: 14, fontWeight: '700', color: C.orange },
  weekNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 6, gap: 2 },
  navArrow: { padding: 6 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: C.textDark },
  viewToggle: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 10, padding: 2, gap: 2 },
  viewToggleBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  viewToggleBtnSel: { backgroundColor: C.surface },
  viewToggleText: { fontSize: 12, fontWeight: '600', color: C.textFaint },
  viewToggleTextSel: { color: C.textDark },
  clearBtn: { padding: 8 },
  dayStrip: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  dayTitle: { fontSize: 18, fontWeight: '800', color: C.textDark, marginBottom: 12 },
  // Undo toast
  undoToast: { position: 'absolute', left: 20, right: 20, backgroundColor: C.textDark, borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 18, gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  undoText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },
  undoBtn: { backgroundColor: C.orange, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  undoBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  // Bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16, maxHeight: '88%' },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  pickerHeader: { marginBottom: 14 },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: C.textDark, marginBottom: 10 },
  pickerModeToggle: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 12, padding: 3, gap: 3 },
  pickerModeBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  pickerModeBtnSel: { backgroundColor: C.surface },
  pickerModeText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
  pickerModeTextSel: { color: C.textDark },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, color: C.textDark },
  pickerEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  pickerEmptyText: { fontSize: 14, color: C.textFaint, textAlign: 'center', paddingHorizontal: 20 },
  recipeCard: { flex: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 2, borderColor: C.border, overflow: 'hidden', marginBottom: 2 },
  recipeCardSel: { borderColor: C.orange },
  recipeCardImg: { width: '100%', height: 90, backgroundColor: C.border },
  recipeCardImgPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: C.orangeLight },
  recipeCardTitle: { fontSize: 12, fontWeight: '600', color: C.textDark, padding: 8, paddingTop: 6 },
  recipeCardCheck: { position: 'absolute', top: 6, right: 6, backgroundColor: '#fff', borderRadius: 10 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 8 },
  servingsLabel: { fontSize: 14, fontWeight: '600', color: C.textMed },
  servBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.orangeLight, justifyContent: 'center', alignItems: 'center' },
  servVal: { fontSize: 18, fontWeight: '800', color: C.textDark, minWidth: 28, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.orange, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Custom form
  customLabel: { fontSize: 13, fontWeight: '700', color: C.textMed, marginBottom: 6, marginTop: 10 },
  customInput: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.textDark },
  macroToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  macroToggleText: { fontSize: 13, fontWeight: '600', color: C.orange },
  macrosRow: { flexDirection: 'row', gap: 10 },
  macroLabel: { fontSize: 11, fontWeight: '700', color: C.textFaint, marginBottom: 4 },
  macroInput: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.textDark, textAlign: 'center' },
  // AI modal
  aiModal: { flex: 1, backgroundColor: C.bg },
  aiHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  aiHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  aiTitle: { fontSize: 17, fontWeight: '800', color: C.textDark },
  prefChips: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  chip: { backgroundColor: C.orangeLight, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, marginRight: 8, borderWidth: 1, borderColor: '#FFD6BB' },
  chipText: { fontSize: 12, fontWeight: '600', color: C.textMed },
  weekCtx: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  weekCtxText: { fontSize: 12, color: C.textFaint },
  aiWelcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  aiWelcomeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.orangeLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  aiWelcomeTitle: { fontSize: 22, fontWeight: '800', color: C.textDark, textAlign: 'center', marginBottom: 8 },
  aiWelcomeBody: { fontSize: 15, color: C.textMed, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  quickPrompts: { gap: 10, width: '100%' },
  quickPrompt: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  quickPromptText: { fontSize: 14, fontWeight: '600', color: C.textDark },
  aiMessages: { flex: 1 },
  aiInputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg, gap: 8 },
  aiInput: { flex: 1, backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: C.textDark, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.orange, justifyContent: 'center', alignItems: 'center' },
});
