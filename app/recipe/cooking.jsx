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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getRecipeById } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export default function CookingScreen() {
  useKeepAwake();

  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [recipe, setRecipe] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);

  // Slide transition animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Done checkmark scale animation
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadSteps();
    }, [id])
  );

  function loadSteps() {
    try {
      const data = getRecipeById(id);
      if (!data) {
        router.back();
        return;
      }
      setRecipe(data);
      const s = data.steps || [];
      if (s.length === 0) {
        router.back();
        return;
      }
      setSteps(s);
      setCurrentIndex(0);
      setDone(false);
      logger.info('cooking.load', { id, stepCount: s.length });
    } catch (err) {
      logger.error('cooking.load.error', { id, error: err.message });
      router.back();
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  function animateSlide(direction, callback) {
    // direction: 1 = forward (slide left), -1 = backward (slide right)
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction * -SCREEN_WIDTH * 0.15,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    });
  }

  function goNext() {
    if (currentIndex >= steps.length - 1) {
      // Finished!
      finishCooking();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateSlide(1, () => setCurrentIndex((i) => i + 1));
  }

  function goPrev() {
    if (currentIndex <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateSlide(-1, () => setCurrentIndex((i) => i - 1));
  }

  function finishCooking() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
    // Animate the checkmark in
    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
        delay: 150,
      }),
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        delay: 150,
      }),
    ]).start();
  }

  // ── Swipe gesture ─────────────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        slideAnim.setValue(gs.dx * 0.15);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(slideAnim, { toValue: 0, duration: 80, useNativeDriver: true }).start(goNext);
        } else if (gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(slideAnim, { toValue: 0, duration: 80, useNativeDriver: true }).start(goPrev);
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!recipe || steps.length === 0) {
    return <View style={styles.screen} />;
  }

  const step = steps[currentIndex];
  const total = steps.length;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (done) {
    return (
      <View style={styles.screen}>
        {/* X to exit */}
        <TouchableOpacity style={styles.exitBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.doneContainer}>
          <Animated.View
            style={[
              styles.doneCircle,
              { transform: [{ scale: checkScale }], opacity: checkOpacity },
            ]}
          >
            <Ionicons name="checkmark" size={64} color="#fff" />
          </Animated.View>
          <Animated.Text style={[styles.doneTitle, { opacity: checkOpacity }]}>
            All done!
          </Animated.Text>
          <Animated.Text style={[styles.doneSub, { opacity: checkOpacity }]}>
            Enjoy your {recipe.title}
          </Animated.Text>
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
      {/* X to exit */}
      <TouchableOpacity
        style={styles.exitBtn}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Step counter */}
      <View style={styles.stepCounter}>
        <Text style={styles.stepCounterText}>
          Step {currentIndex + 1} of {total}
        </Text>
        <Text style={styles.recipeTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
      </View>

      {/* Swipeable content */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          {step.illustrationUrl ? (
            <Image
              source={{ uri: step.illustrationUrl }}
              style={styles.illustration}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.illustrationPlaceholder}>
              <Ionicons name="restaurant-outline" size={56} color="rgba(255,255,255,0.3)" />
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
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
              i < currentIndex && styles.dotDone,
            ]}
          />
        ))}
      </View>

      {/* Navigation arrows */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
          onPress={goPrev}
          disabled={isFirst}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={isFirst ? 'rgba(255,255,255,0.2)' : '#fff'}
          />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navHint}>Swipe or tap to navigate</Text>
        </View>

        <TouchableOpacity style={styles.navBtn} onPress={goNext}>
          <Ionicons name={isLast ? 'checkmark-circle' : 'chevron-forward'} size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },

  // ── Exit button ───────────────────────────────────────────────────────────────
  exitBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 58,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Step counter ──────────────────────────────────────────────────────────────
  stepCounter: {
    paddingTop: Platform.OS === 'android' ? 52 : 66,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  stepCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recipeTitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // ── Content ───────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  illustrationContainer: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#2C2C2E',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  illustrationPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  instruction: {
    fontSize: 20,
    lineHeight: 30,
    color: '#F2F2F7',
    fontWeight: '400',
  },

  // ── Progress dots ─────────────────────────────────────────────────────────────
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    flexWrap: 'wrap',
    paddingHorizontal: 24,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#FF9500',
    width: 20,
    borderRadius: 3.5,
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // ── Navigation row ────────────────────────────────────────────────────────────
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
  },
  navHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },

  // ── Done screen ───────────────────────────────────────────────────────────────
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
  doneTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  doneSub: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
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
  doneBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
