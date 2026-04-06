import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

import { getRecipeById } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

// ── Countdown Timer component ─────────────────────────────────────────────────

function CountdownTimer({ seconds, onDone, onCancel }) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = remaining / seconds;

  return (
    <View style={timerStyles.container}>
      <View style={timerStyles.ring}>
        <Text style={timerStyles.time}>
          {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
        </Text>
        <Text style={timerStyles.label}>remaining</Text>
      </View>
      <TouchableOpacity style={timerStyles.cancelBtn} onPress={onCancel}>
        <Text style={timerStyles.cancelText}>Cancel Timer</Text>
      </TouchableOpacity>
    </View>
  );
}

const timerStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 24, gap: 20 },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
  },
  time: { fontSize: 32, fontWeight: '800', color: '#FF9500' },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.4)',
  },
  cancelText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CookingScreen() {
  useKeepAwake();

  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  // Timer state
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [activeTimer, setActiveTimer] = useState(null); // seconds

  // Slide transition animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Done checkmark scale animation
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  // Refs to always-latest nav callbacks so PanResponder (created once) avoids stale closures
  const goNextRef = useRef(null);
  const goPrevRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadSteps();
      return () => {
        Speech.stop();
      };
    }, [id])
  );

  function loadSteps() {
    try {
      const data = getRecipeById(id);
      if (!data) { router.back(); return; }
      setRecipe(data);
      const s = data.steps || [];
      if (s.length === 0) { router.back(); return; }
      setSteps(s);
      setCurrentIndex(0);
      setDone(false);
      logger.info('cooking.load', { id, stepCount: s.length });
      // Speak first step after a short delay
      setTimeout(() => speakStep(s[0]), 600);
    } catch (err) {
      logger.error('cooking.load.error', { id, error: err.message });
      router.back();
    }
  }

  // ── TTS ───────────────────────────────────────────────────────────────────────

  function speakStep(step) {
    if (!ttsEnabled || !step) return;
    try {
      Speech.stop();
      Speech.speak(`Step ${step.stepNumber}. ${step.instruction}`, {
        language: 'en-US',
        rate: Platform.OS === 'android' ? 0.85 : 0.9,
        pitch: 1.0,
      });
    } catch (err) {
      logger.error('cooking.tts.error', { error: err.message });
    }
  }

  function toggleTts() {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    if (!next) {
      Speech.stop();
    } else {
      // speakStep reads ttsEnabled from closure which is still the old value here,
      // so we speak directly using the already-computed `next = true`
      const step = steps[currentIndex];
      if (step) {
        try {
          Speech.stop();
          Speech.speak(`Step ${step.stepNumber}. ${step.instruction}`, {
            language: 'en-US',
            rate: Platform.OS === 'android' ? 0.85 : 0.9,
            pitch: 1.0,
          });
        } catch (err) {
          logger.error('cooking.tts.error', { error: err.message });
        }
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  function animateSlide(direction, callback) {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction * -SCREEN_WIDTH * 0.12,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start(() => {
      callback();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    });
  }

  function goNext() {
    if (currentIndex >= steps.length - 1) { finishCooking(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Speech.stop();
    animateSlide(1, () => {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setTimeout(() => speakStep(steps[next]), 200);
    });
  }

  function goPrev() {
    if (currentIndex <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Speech.stop();
    animateSlide(-1, () => {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      setTimeout(() => speakStep(steps[prev]), 200);
    });
  }

  function finishCooking() {
    Speech.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7, delay: 150 }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true, delay: 150 }),
    ]).start(() => {
      if (ttsEnabled) {
        setTimeout(() => Speech.speak(`Amazing! You finished making ${recipe?.title ?? 'the recipe'}. Enjoy!`, { rate: 0.9 }), 400);
      }
    });
  }

  // ── Timer ─────────────────────────────────────────────────────────────────────

  function handleStartTimer() {
    const mins = parseFloat(timerInput);
    if (!mins || mins <= 0) return;
    setTimerModalVisible(false);
    setTimerInput('');
    setActiveTimer(Math.round(mins * 60));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleTimerDone() {
    setActiveTimer(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (ttsEnabled) Speech.speak("Timer's done! Check your dish.", { rate: 0.9 });
  }

  // ── Swipe gesture ─────────────────────────────────────────────────────────────

  // Keep refs current on every render so PanResponder always calls the latest version
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => { slideAnim.setValue(gs.dx * 0.12); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(slideAnim, { toValue: 0, duration: 80, useNativeDriver: true }).start(
            () => goNextRef.current?.()
          );
        } else if (gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(slideAnim, { toValue: 0, duration: 80, useNativeDriver: true }).start(
            () => goPrevRef.current?.()
          );
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!recipe || steps.length === 0) return <View style={styles.screen} />;

  const step = steps[currentIndex];
  const total = steps.length;

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (done) {
    return (
      <View style={styles.screen}>
        <TouchableOpacity style={[styles.exitBtn, { marginTop: insets.top + 10, marginLeft: 16 }]} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.doneContainer}>
          <Animated.View style={[styles.doneCircle, { transform: [{ scale: checkScale }], opacity: checkOpacity }]}>
            <Ionicons name="checkmark" size={64} color="#fff" />
          </Animated.View>
          <Animated.Text style={[styles.doneTitle, { opacity: checkOpacity }]}>All done!</Animated.Text>
          <Animated.Text style={[styles.doneSub, { opacity: checkOpacity }]}>Enjoy your {recipe.title}</Animated.Text>
          <Animated.View style={{ opacity: checkOpacity }}>
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Back to Recipe</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Main cooking view ─────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.exitBtn} onPress={() => { Speech.stop(); router.back(); }}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Step counter */}
        <View style={styles.stepCounterCenter}>
          <Text style={styles.stepCounterText}>Step {currentIndex + 1} of {total}</Text>
          <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
        </View>

        {/* TTS + Timer controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={toggleTts}>
            <Ionicons
              name={ttsEnabled ? 'volume-high' : 'volume-mute'}
              size={18}
              color={ttsEnabled ? '#FF9500' : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setTimerModalVisible(true)}>
            <Ionicons name="timer-outline" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active timer overlay */}
      {activeTimer !== null && (
        <CountdownTimer
          seconds={activeTimer}
          onDone={handleTimerDone}
          onCancel={() => setActiveTimer(null)}
        />
      )}

      {/* Swipeable content */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          {step.illustrationUrl ? (
            <Image source={{ uri: step.illustrationUrl }} style={styles.illustration} resizeMode="cover" />
          ) : (
            <View style={styles.illustrationPlaceholder}>
              <Ionicons name="restaurant-outline" size={56} color="rgba(255,255,255,0.2)" />
            </View>
          )}
        </View>

        {/* Instruction */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instruction}>{step.instruction}</Text>
        </View>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive, i < currentIndex && styles.dotDone]}
          />
        ))}
      </View>

      {/* Navigation arrows */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={goPrev}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={28} color={currentIndex === 0 ? 'rgba(255,255,255,0.15)' : '#fff'} />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navHint}>Swipe or tap arrows</Text>
        </View>

        <TouchableOpacity style={styles.navBtn} onPress={goNext}>
          <Ionicons
            name={currentIndex === total - 1 ? 'checkmark-circle' : 'chevron-forward'}
            size={28}
            color={currentIndex === total - 1 ? '#FF9500' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* Timer input modal */}
      <Modal
        visible={timerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimerModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Set Timer</Text>
            <Text style={styles.modalSub}>How many minutes?</Text>
            <TextInput
              style={styles.timerInput}
              value={timerInput}
              onChangeText={setTimerInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 10"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setTimerModalVisible(false); setTimerInput(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalStartBtn, !timerInput && styles.modalStartBtnDisabled]}
                onPress={handleStartTimer}
                disabled={!timerInput}
              >
                <Text style={styles.modalStartText}>Start</Text>
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
    backgroundColor: '#1C1C1E',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCounterCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  stepCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recipeTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  topControls: {
    flexDirection: 'row',
    gap: 6,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  illustrationContainer: {
    width: '100%',
    aspectRatio: 1.65,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#2C2C2E',
  },
  illustration: { width: '100%', height: '100%' },
  illustrationPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
  },
  instructionContainer: {
    flex: 1,
  },
  instruction: {
    fontSize: 20,
    lineHeight: 30,
    color: '#F2F2F7',
    fontWeight: '400',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    flexWrap: 'wrap',
    paddingHorizontal: 24,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: {
    backgroundColor: '#FF9500',
    width: 20,
    borderRadius: 3.5,
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 24 : 40,
    gap: 16,
  },
  navBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
  },
  navHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
  // Done screen
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  doneCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  doneTitle: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 8 },
  doneSub: { fontSize: 17, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  doneBtn: {
    marginTop: 16,
    backgroundColor: '#FF9500',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  doneBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  // Timer modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#2C2C2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  modalSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16 },
  timerInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  modalStartBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FF9500',
    borderRadius: 14,
  },
  modalStartBtnDisabled: { opacity: 0.35 },
  modalStartText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
