import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { setSetting } from '../src/db/queries';
import { logger } from '../src/utils/logger';

const C = {
  orange: '#FF6B35',
  bg: '#FFF8F0',
  surface: '#FFFFFF',
  textDark: '#2D1B00',
  textMed: '#6B4C2A',
  textFaint: '#B38B6D',
  border: '#F0E0D0',
};

const SLIDES = [
  {
    key: 'scan',
    icon: 'camera',
    iconColor: '#FF6B35',
    iconBg: '#EBF3FF',
    title: 'Scan Any Recipe',
    subtitle:
      'Point your camera at a cookbook, snap a photo, paste a URL, or upload a PDF. GPT-4o reads it instantly.',
  },
  {
    key: 'list',
    icon: 'list-circle',
    iconColor: '#34C759',
    iconBg: '#EBFFF1',
    title: 'Smart Ingredient List',
    subtitle:
      'Every ingredient is extracted and organized automatically. Scale servings, edit quantities, and check items off as you shop.',
  },
  {
    key: 'cart',
    icon: 'cart',
    iconColor: '#0071DC',
    iconBg: '#EBF4FF',
    title: 'Shop on Walmart',
    subtitle:
      'Match ingredients to Walmart products, see prices, and send your whole list to a Walmart cart in one tap.',
  },
  {
    key: 'planner',
    icon: 'calendar',
    iconColor: '#9C27B0',
    iconBg: '#F3E5F5',
    title: 'AI Meal Planner',
    subtitle:
      'Ask the AI to plan your whole week. It knows your allergies, budget, and goals — and can generate any recipe it suggests.',
  },
];

const GOALS = [
  { key: 'lose_weight',   label: 'Lose weight',    emoji: '🔥' },
  { key: 'build_muscle',  label: 'Build muscle',   emoji: '💪' },
  { key: 'eat_healthier', label: 'Eat healthier',  emoji: '🥗' },
  { key: 'save_money',    label: 'Save money',     emoji: '💰' },
  { key: 'explore',       label: 'Explore cuisines', emoji: '🌍' },
  { key: 'meal_prep',     label: 'Meal prep',      emoji: '📦' },
];

const COMMON_ALLERGIES = [
  'Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Eggs', 'Soy', 'Shellfish', 'Fish',
];

const BUDGET_OPTIONS = [
  { key: 'low',    label: 'Budget-friendly', sub: 'Under $50/week',  emoji: '💵' },
  { key: 'medium', label: 'Moderate',        sub: '$50–$100/week',   emoji: '💳' },
  { key: 'high',   label: 'No limit',        sub: 'Quality first',   emoji: '⭐' },
];

// The personalization slide is rendered separately (not in the FlatList)
export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Personalization state
  const [showPrefs, setShowPrefs] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [selectedBudget, setSelectedBudget] = useState(null);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      // After last slide → show prefs screen
      setShowPrefs(true);
    }
  }

  function toggleAllergy(item) {
    setSelectedAllergies((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  }

  function addCustomAllergy() {
    const a = customAllergy.trim();
    if (a && !selectedAllergies.includes(a)) {
      setSelectedAllergies((prev) => [...prev, a]);
    }
    setCustomAllergy('');
  }

  function handleFinish() {
    try {
      // Build prefs JSON for the planner AI
      const allAllergies = [...selectedAllergies];
      const prefs = {
        goal: selectedGoal ?? null,
        allergies: allAllergies,
        budget: selectedBudget ?? null,
      };
      setSetting('planner_prefs', JSON.stringify(prefs));
      setSetting('hasSeenOnboarding', 'true');
      logger.info('onboarding.finish', { prefs });
    } catch (err) {
      logger.error('onboarding.finish.error', { error: err.message });
    }
    router.replace('/(tabs)');
  }

  function handleSkip() {
    try {
      setSetting('hasSeenOnboarding', 'true');
    } catch (err) {
      logger.error('onboarding.skip.error', { error: err.message });
    }
    router.replace('/(tabs)');
  }

  if (showPrefs) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.prefsScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.prefsHeader}>
            <View style={[styles.prefsIconWrap, { backgroundColor: '#FFF0E8' }]}>
              <Ionicons name="sparkles" size={40} color={C.orange} />
            </View>
            <Text style={styles.prefsTitle}>Personalise your experience</Text>
            <Text style={styles.prefsSub}>
              Your AI planner uses this to make better suggestions. You can always update it later.
            </Text>
          </View>

          {/* Goal */}
          <Text style={styles.sectionLabel}>What's your main goal?</Text>
          <View style={styles.goalGrid}>
            {GOALS.map((g) => {
              const active = selectedGoal === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.goalChip, active && styles.goalChipActive]}
                  onPress={() => setSelectedGoal(active ? null : g.key)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.goalEmoji}>{g.emoji}</Text>
                  <Text style={[styles.goalLabel, active && styles.goalLabelActive]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Allergies */}
          <Text style={styles.sectionLabel}>Any dietary restrictions?</Text>
          <Text style={styles.sectionSub}>Select all that apply</Text>
          <View style={styles.allergyRow}>
            {COMMON_ALLERGIES.map((a) => {
              const active = selectedAllergies.includes(a);
              return (
                <TouchableOpacity
                  key={a}
                  style={[styles.allergyChip, active && styles.allergyChipActive]}
                  onPress={() => toggleAllergy(a)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.allergyText, active && styles.allergyTextActive]}>{a}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.customAllergyRow}>
            <TextInput
              style={styles.customAllergyInput}
              placeholder="Other (e.g. Sesame)"
              placeholderTextColor={C.textFaint}
              value={customAllergy}
              onChangeText={setCustomAllergy}
              onSubmitEditing={addCustomAllergy}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.customAllergyBtn} onPress={addCustomAllergy}>
              <Ionicons name="add" size={20} color={C.orange} />
            </TouchableOpacity>
          </View>
          {selectedAllergies.filter((a) => !COMMON_ALLERGIES.includes(a)).length > 0 && (
            <View style={styles.allergyRow}>
              {selectedAllergies
                .filter((a) => !COMMON_ALLERGIES.includes(a))
                .map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.allergyChip, styles.allergyChipActive]}
                    onPress={() => toggleAllergy(a)}
                  >
                    <Text style={styles.allergyTextActive}>{a}</Text>
                    <Ionicons name="close" size={12} color={C.orange} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Budget */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Weekly grocery budget?</Text>
          {BUDGET_OPTIONS.map((b) => {
            const active = selectedBudget === b.key;
            return (
              <TouchableOpacity
                key={b.key}
                style={[styles.budgetRow, active && styles.budgetRowActive]}
                onPress={() => setSelectedBudget(active ? null : b.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.budgetEmoji}>{b.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.budgetLabel, active && styles.budgetLabelActive]}>{b.label}</Text>
                  <Text style={styles.budgetSub}>{b.sub}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={22} color={C.orange} />}
              </TouchableOpacity>
            );
          })}

          {/* Finish */}
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.finishBtnText}>All done — let's cook!</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipPrefsBtn} onPress={handleSkip}>
            <Text style={styles.skipPrefsText}>Skip for now</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Slides ───────────────────────────────────────────────────────────────────
  function renderSlide({ item }) {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
          <Ionicons name={item.icon} size={72} color={item.iconColor} />
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
          {/* extra dot for prefs screen */}
          <View style={styles.dot} />
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>
            {isLastSlide ? 'Personalise' : 'Next'}
          </Text>
          <Ionicons
            name={isLastSlide ? 'sparkles' : 'arrow-forward'}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: C.textFaint,
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 20,
  },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: C.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 16,
    color: C.textMed,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
    gap: 20,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0E0D0',
  },
  dotActive: {
    backgroundColor: C.orange,
    width: 24,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    width: '100%',
    elevation: 4,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  nextText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Prefs screen ──────────────────────────────────────────────────────────
  prefsScroll: {
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  prefsHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  prefsIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  prefsTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  prefsSub: {
    fontSize: 15,
    color: C.textMed,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textDark,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionSub: {
    fontSize: 13,
    color: C.textFaint,
    marginBottom: 10,
    marginTop: -4,
  },

  // Goals
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  goalChipActive: {
    borderColor: C.orange,
    backgroundColor: '#FFF0E8',
  },
  goalEmoji: {
    fontSize: 16,
  },
  goalLabel: {
    fontSize: 14,
    color: C.textMed,
    fontWeight: '500',
  },
  goalLabelActive: {
    color: C.orange,
    fontWeight: '700',
  },

  // Allergies
  allergyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  allergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  allergyChipActive: {
    borderColor: C.orange,
    backgroundColor: '#FFF0E8',
  },
  allergyText: {
    fontSize: 13,
    color: C.textMed,
    fontWeight: '500',
  },
  allergyTextActive: {
    color: C.orange,
    fontWeight: '700',
  },
  customAllergyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  customAllergyInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: C.textDark,
    backgroundColor: C.surface,
  },
  customAllergyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Budget
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    marginBottom: 10,
  },
  budgetRowActive: {
    borderColor: C.orange,
    backgroundColor: '#FFF0E8',
  },
  budgetEmoji: {
    fontSize: 22,
  },
  budgetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textDark,
    marginBottom: 2,
  },
  budgetLabelActive: {
    color: C.orange,
  },
  budgetSub: {
    fontSize: 12,
    color: C.textFaint,
  },

  // Finish
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    marginTop: 28,
    elevation: 4,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  finishBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipPrefsBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  skipPrefsText: {
    fontSize: 15,
    color: C.textFaint,
    fontWeight: '500',
  },
});
