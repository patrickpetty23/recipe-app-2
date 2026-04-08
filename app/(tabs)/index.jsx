import { useState, useRef, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  Image,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';

import { processChat, parseRecipeFromText, parseRecipeFromImage } from '../../src/services/openai';
import {
  getAllRecipes,
  getShoppingListIngredients,
  getCookLogForDate,
  getSetting,
  addManualShoppingItem,
  getMealPlanForWeek,
} from '../../src/db/queries';
import { scrapeRecipeUrl } from '../../src/services/scraper';
import { parsePdf, parseDocx } from '../../src/services/fileParser';
import { logger } from '../../src/utils/logger';

const URL_REGEX = /^https?:\/\//i;
const MEAL_PLAN_REGEX = /\b(meal.?plan|plan.{0,6}(week|meal|day|menu)|what.{0,12}(should|can).{0,8}eat|weekly.{0,6}(meal|menu|food)|help.{0,8}(me.{0,6})?(plan|meal|diet|nutrition)|diet.{0,6}plan|schedule.{0,8}meal)\b/i;

const WELCOME_ID = 'welcome';
const TYPING_ID = 'typing';

const WELCOME_MESSAGE = {
  id: WELCOME_ID,
  role: 'assistant',
  type: 'text',
  content:
    "Hi! I'm Mise, your AI cooking assistant. Ask me anything — scan a recipe, plan your week, check your nutrition, add items to your shopping list, or just ask what to cook tonight.",
  imageUri: null,
  recipeData: null,
};

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  // Staggered bounce loop for each dot
  useRef((() => {
    function bounceDot(anim, delay) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 240, useNativeDriver: true }),
          Animated.delay(480),
        ])
      );
    }
    const loops = anims.map((a, i) => bounceDot(a, i * 160));
    loops.forEach((l) => l.start());
    // no cleanup needed — component unmounts with typing indicator removal
  })()).current;

  return (
    <View style={styles.assistantBubble}>
      <View style={styles.typingRow}>
        {anims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Action card (rendered for agent action responses) ─────────────────────────

function ActionCard({ item, onAction }) {
  const ACTION_META = {
    open_planner:    { icon: 'calendar',      label: 'Open Meal Planner',    color: '#9C27B0' },
    open_planner_ai: { icon: 'sparkles',      label: 'Ask AI to Plan',       color: '#FF6B35' },
    open_tab_list:   { icon: 'cart',          label: 'View Shopping List',   color: '#0071DC' },
    open_tab_tracker:{ icon: 'bar-chart',     label: 'View Nutrition',       color: '#34C759' },
    open_tab_recipes:{ icon: 'book',          label: 'Browse Recipes',       color: '#FF6B35' },
    search_library:  { icon: 'search',        label: 'Search Library',       color: '#FF6B35' },
    add_shopping:    { icon: 'add-circle',    label: 'Add to Shopping List', color: '#0071DC' },
    start_timer:     { icon: 'timer-outline', label: 'Start Timer',          color: '#FF9500' },
  };
  const key = item.action === 'open_tab' ? `open_tab_${item.tab}` : item.action;
  const meta = ACTION_META[key] ?? { icon: 'arrow-forward-circle', label: 'Take Action', color: '#FF6B35' };

  return (
    <View style={styles.actionCard}>
      <Text style={styles.assistantBubbleText}>{item.content}</Text>
      <TouchableOpacity
        style={[styles.actionCardBtn, { backgroundColor: meta.color }]}
        onPress={() => onAction(item)}
        activeOpacity={0.85}
      >
        <Ionicons name={meta.icon} size={16} color="#fff" />
        <Text style={styles.actionCardBtnText}>{meta.label}</Text>
        <Ionicons name="chevron-forward" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ── Meal plan promo card ──────────────────────────────────────────────────────

function MealPlanCard({ onOpen }) {
  return (
    <View style={styles.mealPlanCard}>
      <View style={styles.mealPlanCardHeader}>
        <Ionicons name="calendar" size={22} color="#FF6B35" />
        <Text style={styles.mealPlanCardTitle}>Meal Planner AI</Text>
      </View>
      <Text style={styles.mealPlanCardBody}>
        Tell me your goals, allergies, or budget and I'll build a personalised weekly plan — choosing from your saved recipes or suggesting new ones.
      </Text>
      <View style={styles.mealPlanCardFeatures}>
        {['📅  Weekly calendar view', '🥗  Smart meal suggestions', '🛒  Auto shopping list', '📊  Nutrition tracking'].map((f) => (
          <Text key={f} style={styles.mealPlanCardFeature}>{f}</Text>
        ))}
      </View>
      <TouchableOpacity style={styles.mealPlanCardBtn} onPress={onOpen} activeOpacity={0.85}>
        <Ionicons name="sparkles" size={16} color="#fff" />
        <Text style={styles.mealPlanCardBtnText}>Open Meal Planner</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ── Recipe card (rendered inside AI message bubble) ───────────────────────────

function RecipeCard({ item, onSave }) {
  const rd = item.recipeData;
  if (!rd) return null;

  const metaParts = [
    rd.prepTime ? `Prep ${rd.prepTime}` : null,
    rd.cookTime ? `Cook ${rd.cookTime}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.recipeCard}>
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={styles.recipeCardImage}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.recipeCardBody}>
        <Text style={styles.recipeCardTitle} numberOfLines={2}>
          {rd.title || 'Untitled Recipe'}
        </Text>

        <View style={styles.recipeCardMeta}>
          {rd.cuisine ? (
            <View style={styles.cuisineChip}>
              <Text style={styles.cuisineChipText}>{rd.cuisine}</Text>
            </View>
          ) : null}
          {metaParts.map((m) => (
            <Text key={m} style={styles.recipeMetaText}>{m}</Text>
          ))}
        </View>

        {rd.ingredients?.length > 0 ? (
          <Text style={styles.recipeCountText}>
            {rd.ingredients.length} ingredient{rd.ingredients.length !== 1 ? 's' : ''}
            {rd.steps?.length > 0
              ? `  ·  ${rd.steps.length} step${rd.steps.length !== 1 ? 's' : ''}`
              : ''}
          </Text>
        ) : null}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => onSave(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="bookmark" size={16} color="#fff" />
          <Text style={styles.saveButtonText}>Save to Recipe Book</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── In-chat countdown timer banner ────────────────────────────────────────────

function ChatTimerBanner({ seconds: initialSeconds, onDone, onCancel }) {
  const [remaining, setRemaining] = useState(initialSeconds);
  useEffect(() => {
    const iv = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(iv); onDone(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <View style={styles.timerBanner}>
      <Ionicons name="timer-outline" size={18} color="#FF9500" />
      <Text style={styles.timerBannerText}>
        {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`} remaining
      </Text>
      <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );
}

// ── Build live app context for the AI agent ───────────────────────────────────

function buildAppContext() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const recipes = getAllRecipes();
    const shoppingItems = getShoppingListIngredients();
    const todayLog = getCookLogForDate(today);
    const calorieGoalRaw = getSetting('calorie_goal');
    const calorieGoal = calorieGoalRaw ? parseInt(calorieGoalRaw, 10) : null;

    const todayCalories = todayLog.reduce((s, e) => s + (e.calories ?? 0), 0);
    const todayProtein = todayLog.reduce((s, e) => s + (e.protein ?? 0), 0);

    // Build compact recipe list for AI context (max 20 titles)
    const recipeList = recipes.length > 0
      ? recipes.slice(0, 20).map((r) => `"${r.title}"`).join(', ')
      : null;

    // Build meal plan summary for current week
    const monday = new Date(today);
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);
    const plan = getMealPlanForWeek(weekStart, weekEnd);
    const planSummary = plan.length > 0
      ? plan.map((p) => `${p.plannedDate} ${p.mealType}: ${p.recipeTitle}`).join('; ')
      : null;

    return {
      recipeCount: recipes.length,
      recipeList,
      shoppingCount: shoppingItems.filter((i) => !i.checked).length,
      todayCalories: Math.round(todayCalories),
      todayProtein,
      calorieGoal,
      today,
      planSummary,
    };
  } catch {
    return null;
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const inputRef = useRef(null);
  // Stores Animated.Values keyed by message id for entrance animations
  const animMap = useRef(new Map()).current;

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null); // { uri, base64 }
  const [busy, setBusy] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const [activeTimerSeconds, setActiveTimerSeconds] = useState(null); // non-null = timer running
  const pendingAction = useRef(null);

  // Android fallback: Modal.onDismiss only fires on iOS, so use effect + delay
  useEffect(() => {
    if (!showAttachSheet && pendingAction.current && Platform.OS === 'android') {
      const timer = setTimeout(handleAttachSheetDismiss, 400);
      return () => clearTimeout(timer);
    }
  }, [showAttachSheet]);

  // ── Message helpers ─────────────────────────────────────────────────────────

  function getOrCreateAnim(id, startAt = 1) {
    if (!animMap.has(id)) animMap.set(id, new Animated.Value(startAt));
    return animMap.get(id);
  }

  function animateIn(id) {
    const anim = animMap.get(id);
    if (!anim) return;
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 55,
      friction: 9,
    }).start();
  }

  function addMessage(msg) {
    animMap.set(msg.id, new Animated.Value(0));
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => animateIn(msg.id), 0);
  }

  function addTypingIndicator() {
    animMap.set(TYPING_ID, new Animated.Value(1));
    setMessages((prev) => [...prev, { id: TYPING_ID, role: 'assistant', type: 'typing' }]);
  }

  function removeTypingAndAdd(msg) {
    animMap.set(msg.id, new Animated.Value(0));
    setMessages((prev) => [...prev.filter((m) => m.id !== TYPING_ID), msg]);
    setTimeout(() => animateIn(msg.id), 0);
  }

  function removeTypingIndicator() {
    setMessages((prev) => prev.filter((m) => m.id !== TYPING_ID));
  }

  // Builds the conversation history sent to processChat (strips UI-only entries)
  function buildHistory(msgs) {
    return msgs
      .filter((m) => m.id !== WELCOME_ID && m.type !== 'typing')
      .map((m) => ({
        role: m.role,
        content:
          m.type === 'recipe'
            ? `[Recipe found: ${m.recipeData?.title ?? 'Unknown'}]`
            : m.content || '',
      }));
  }

  // ── Send logic ──────────────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text && !attachedImage) return;
    if (busy) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg = {
      id: Crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: text,
      imageUri: attachedImage?.uri ?? null,
      recipeData: null,
    };

    addMessage(userMsg);
    setInputText('');
    const pendingBase64 = attachedImage?.base64 ?? null;
    setAttachedImage(null);
    setBusy(true);
    addTypingIndicator();

    try {
      // ── Meal planning intent → navigate to Planner AI ─────────────────────
      if (!pendingBase64 && MEAL_PLAN_REGEX.test(text)) {
        removeTypingAndAdd({
          id: Crypto.randomUUID(),
          role: 'assistant',
          type: 'meal_plan_promo',
          content: '',
          imageUri: null,
          recipeData: null,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // ── URL detected → scrape + full recipe parse ──────────────────────────
      if (!pendingBase64 && URL_REGEX.test(text)) {
        logger.info('chat.handleSend.url', { url: text.slice(0, 80) });
        const scraped = await scrapeRecipeUrl(text);
        const recipeData = await parseRecipeFromText(scraped);
        removeTypingAndAdd({
          id: Crypto.randomUUID(),
          role: 'assistant',
          type: 'recipe',
          content: recipeData.title ? `Here's the recipe I found!` : 'Found a recipe for you.',
          imageUri: null,
          recipeData,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // ── Image attached → processChat with vision ───────────────────────────
      if (pendingBase64) {
        logger.info('chat.handleSend.image', {});
        const history = buildHistory(messages);
        const result = await processChat(
          [...history, { role: 'user', content: text || 'What is this recipe?' }],
          pendingBase64
        );
        if (result.type === 'recipe' && result.recipe) {
          removeTypingAndAdd({
            id: Crypto.randomUUID(),
            role: 'assistant',
            type: 'recipe',
            content: result.message || 'Found a recipe!',
            imageUri: userMsg.imageUri,
            recipeData: result.recipe,
          });
        } else {
          removeTypingAndAdd({
            id: Crypto.randomUUID(),
            role: 'assistant',
            type: 'text',
            content: result.message || "I couldn't identify a recipe from that image.",
            imageUri: null,
            recipeData: null,
          });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // ── Plain text → processChat (with live app context) ──────────────────
      logger.info('chat.handleSend.text', { length: text.length });
      const history = buildHistory(messages);
      const appCtx = buildAppContext();
      const result = await processChat([...history, { role: 'user', content: text }], null, appCtx);
      if (result.type === 'recipe' && result.recipe) {
        removeTypingAndAdd({
          id: Crypto.randomUUID(),
          role: 'assistant',
          type: 'recipe',
          content: result.message || 'Here you go!',
          imageUri: null,
          recipeData: result.recipe,
        });
      } else if (result.type === 'action') {
        removeTypingAndAdd({
          id: Crypto.randomUUID(),
          role: 'assistant',
          type: 'action',
          content: result.message || "Here you go!",
          action: result.action,
          tab: result.tab ?? null,
          query: result.query ?? null,
          items: result.items ?? null,
          seconds: result.seconds ?? null,
          recipeData: null,
          imageUri: null,
        });
      } else {
        removeTypingAndAdd({
          id: Crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: result.message || 'I had trouble with that. Can you rephrase?',
          imageUri: null,
          recipeData: null,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      logger.error('chat.handleSend.error', { error: err.message });
      removeTypingIndicator();
      addMessage({
        id: Crypto.randomUUID(),
        role: 'assistant',
        type: 'text',
        content: 'Sorry, something went wrong. Please try again.',
        imageUri: null,
        recipeData: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  // ── Attachment handlers ─────────────────────────────────────────────────────
  // Each button stores which action to run, then closes the Modal.
  // The actual picker fires from the Modal's onDismiss callback so iOS has
  // fully torn down the native modal before a new system sheet is presented.

  function queueAttachAction(action) {
    pendingAction.current = action;
    setShowAttachSheet(false);
  }

  function handleAttachSheetDismiss() {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (!action) return;
    if (action === 'camera') launchCamera();
    else if (action === 'photo') launchPhotoLibrary();
    else if (action === 'file') launchFilePicker();
    else if (action === 'url') {
      setPendingUrl('');
      setShowUrlInput(true);
    }
  }

  async function launchCamera() {
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Camera Access Blocked',
            'Enable camera access in your device Settings to attach photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert('Permission Required', 'Camera access is needed to attach photos.');
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.6,
        maxWidth: 1280,
        maxHeight: 1280,
      });
      if (!result.canceled) {
        setAttachedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
      }
    } catch (err) {
      logger.error('chat.cameraAttach.error', { error: err.message });
    }
  }

  async function launchPhotoLibrary() {
    try {
      const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
      logger.info('scan.handlePickPhoto', { step: 'permissions', granted: perms.granted, status: perms.status });
      if (!perms.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed to pick recipe images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.6,
        maxWidth: 1280,
        maxHeight: 1280,
      });
      if (!result.canceled) {
        setAttachedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
      }
    } catch (err) {
      logger.error('chat.photoAttach.error', { error: err.message });
    }
  }

  async function launchFilePicker() {
    setBusy(true);

    let fileName = 'Document';
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setBusy(false);
        return;
      }

      const file = result.assets[0];
      fileName = file.name ?? fileName;
      const isPdf = file.mimeType === 'application/pdf' || file.name?.endsWith('.pdf');

      const userMsg = {
        id: Crypto.randomUUID(),
        role: 'user',
        type: 'text',
        content: `📄 ${fileName}`,
        imageUri: null,
        recipeData: null,
      };
      addMessage(userMsg);
      addTypingIndicator();

      const text = isPdf ? await parsePdf(file.uri) : await parseDocx(file.uri);
      const recipeData = await parseRecipeFromText(text);

      removeTypingAndAdd({
        id: Crypto.randomUUID(),
        role: 'assistant',
        type: 'recipe',
        content: 'Found a recipe in your document!',
        imageUri: null,
        recipeData,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      logger.error('chat.fileAttach.error', { error: err.message });
      removeTypingIndicator();
      addMessage({
        id: Crypto.randomUUID(),
        role: 'assistant',
        type: 'text',
        content: "Couldn't read that file. Try a different format or paste the text.",
        imageUri: null,
        recipeData: null,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleUrlAttach() {
    queueAttachAction('url');
  }

  async function handleUrlImport() {
    const url = pendingUrl.trim();
    setShowUrlInput(false);
    if (!url || !URL_REGEX.test(url)) {
      Alert.alert('Invalid URL', 'Please enter a URL starting with http:// or https://');
      return;
    }
    if (busy) return;
    setBusy(true);

    const userMsg = {
      id: Crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: url,
      imageUri: null,
      recipeData: null,
    };
    addMessage(userMsg);
    addTypingIndicator();

    try {
      logger.info('chat.handleUrlImport', { url: url.slice(0, 80) });
      const scraped = await scrapeRecipeUrl(url);
      const recipeData = await parseRecipeFromText(scraped);
      removeTypingAndAdd({
        id: Crypto.randomUUID(),
        role: 'assistant',
        type: 'recipe',
        content: recipeData.title ? `Here's the recipe I found!` : 'Found a recipe for you.',
        imageUri: null,
        recipeData,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      logger.error('chat.handleUrlImport.error', { error: err.message });
      removeTypingIndicator();
      addMessage({
        id: Crypto.randomUUID(),
        role: 'assistant',
        type: 'text',
        content: "Couldn't fetch that URL. Check the link and try again.",
        imageUri: null,
        recipeData: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  // ── Handle agent action responses ──────────────────────────────────────────

  function handleAction(item) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    switch (item.action) {
      case 'open_planner':
        router.push('/(tabs)/planner');
        break;
      case 'open_planner_ai':
        router.push('/(tabs)/planner?openAI=true');
        break;
      case 'open_tab':
        router.push(`/(tabs)/${item.tab ?? 'index'}`);
        break;
      case 'search_library':
        router.push({ pathname: '/(tabs)/library', params: { q: item.query ?? '' } });
        break;
      case 'add_shopping': {
        const items = Array.isArray(item.items) ? item.items : [];
        if (items.length === 0) break;
        Alert.alert(
          `Add ${items.length} item${items.length !== 1 ? 's' : ''} to list?`,
          items.slice(0, 5).join(', ') + (items.length > 5 ? ` +${items.length - 5} more` : ''),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add',
              onPress: () => {
                for (const name of items) {
                  try { addManualShoppingItem(name); } catch { /* ignore */ }
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.push('/(tabs)/list');
              },
            },
          ]
        );
        break;
      }
      case 'start_timer': {
        const secs = typeof item.seconds === 'number' ? item.seconds : 0;
        if (secs <= 0) break;
        setActiveTimerSeconds(secs);
        break;
      }
      default:
        break;
    }
  }

  // ── Save recipe → editor ────────────────────────────────────────────────────

  function handleSaveRecipe(item) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/recipe/editor',
      params: {
        recipeData: JSON.stringify(item.recipeData),
        sourceType: 'chat',
        imageUri: item.imageUri ?? '',
      },
    });
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderMessage({ item }) {
    const anim = getOrCreateAnim(item.id, item.id === WELCOME_ID ? 1 : 0);
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

    return (
      <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
        {item.type === 'typing' && (
          <View style={styles.assistantRow}>
            <TypingIndicator />
          </View>
        )}

        {item.type === 'text' && item.role === 'user' && (
          <View style={styles.userRow}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.userImage} resizeMode="cover" />
            ) : null}
            {item.content ? (
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{item.content}</Text>
              </View>
            ) : null}
          </View>
        )}

        {item.type === 'text' && item.role === 'assistant' && (
          <View style={styles.assistantRow}>
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantBubbleText}>{item.content}</Text>
            </View>
          </View>
        )}

        {item.type === 'recipe' && (
          <View style={styles.assistantRow}>
            <View style={styles.recipeWrapper}>
              {item.content ? (
                <Text style={styles.recipeIntroText}>{item.content}</Text>
              ) : null}
              <RecipeCard item={item} onSave={handleSaveRecipe} />
            </View>
          </View>
        )}

        {item.type === 'action' && (
          <View style={styles.assistantRow}>
            <ActionCard item={item} onAction={handleAction} />
          </View>
        )}

        {item.type === 'meal_plan_promo' && (
          <View style={styles.assistantRow}>
            <MealPlanCard onOpen={() => router.push('/(tabs)/planner?openAI=true')} />
          </View>
        )}
      </Animated.View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Recipe Assistant</Text>
        <Text style={styles.headerSub}>GPT-4o powered</Text>
      </View>

      {/* Message list */}
      <FlatList
        ref={flatRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* Active timer banner */}
      {activeTimerSeconds != null && (
        <ChatTimerBanner
          seconds={activeTimerSeconds}
          onDone={() => {
            setActiveTimerSeconds(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addMessage({
              id: Crypto.randomUUID(),
              role: 'assistant',
              type: 'text',
              content: "⏱️ Timer's done!",
              imageUri: null,
              recipeData: null,
            });
          }}
          onCancel={() => setActiveTimerSeconds(null)}
        />
      )}

      {/* Suggestion chips */}
      {messages.length <= 2 && !busy && (
        <View style={styles.chipsRow}>
          {[
            { label: '🍽️  What can I cook tonight?', text: 'What can I cook tonight?' },
            { label: '📅  Plan my week', text: 'Can you help me plan my meals for this week?' },
            { label: '🛒  Add to list', text: 'Add ' },
            { label: '🔄  Substitute an ingredient', text: 'I need to substitute ' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={styles.chip}
              onPress={() => setInputText(chip.text)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input area */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom || 8 }]}>
        {attachedImage ? (
          <View style={styles.attachPreviewRow}>
            <Image source={{ uri: attachedImage.uri }} style={styles.attachThumb} resizeMode="cover" />
            <TouchableOpacity
              style={styles.attachClearBtn}
              onPress={() => setAttachedImage(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={22} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.attachLabel}>Photo attached</Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TouchableOpacity
            onPress={() => setShowAttachSheet(true)}
            disabled={busy}
            style={styles.attachIconBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="add-circle" size={32} color={busy ? '#C7C7CC' : '#FF6B35'} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Ask me anything — recipes, your plan, shopping list…"
            placeholderTextColor="#8E8E93"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!busy}
            returnKeyType="default"
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (busy || (!inputText.trim() && !attachedImage)) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={busy || (!inputText.trim() && !attachedImage)}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={busy || (!inputText.trim() && !attachedImage) ? '#C7C7CC' : '#fff'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Attachment sheet */}
      <Modal
        visible={showAttachSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachSheet(false)}
        onDismiss={handleAttachSheetDismiss}
        onShow={() => { pendingAction.current = null; }}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAttachSheet(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to Message</Text>

            <TouchableOpacity style={styles.sheetRow} onPress={() => queueAttachAction('camera')}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#EBF3FF' }]}>
                <Ionicons name="camera" size={22} color="#007AFF" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>Camera</Text>
                <Text style={styles.sheetRowSub}>Take a photo of a recipe</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={() => queueAttachAction('photo')}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#F0EBFF' }]}>
                <Ionicons name="images" size={22} color="#7C3AED" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>Photo Library</Text>
                <Text style={styles.sheetRowSub}>Choose a recipe photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={() => queueAttachAction('file')}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#FFF5EB' }]}>
                <Ionicons name="document-text" size={22} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>PDF or DOCX</Text>
                <Text style={styles.sheetRowSub}>Import a recipe document</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleUrlAttach}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#EBFFEF' }]}>
                <Ionicons name="link" size={22} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>From URL</Text>
                <Text style={styles.sheetRowSub}>Paste a recipe website link</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setShowAttachSheet(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* URL import modal */}
      <Modal
        visible={showUrlInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlInput(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Tapping the dark area behind the card dismisses */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUrlInput(false)} />
          <Pressable style={styles.urlModal} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Import from URL</Text>
            <TextInput
              style={styles.urlInput}
              placeholder="https://www.example.com/recipe"
              placeholderTextColor="#B38B6D"
              value={pendingUrl}
              onChangeText={setPendingUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleUrlImport}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.saveButton, !pendingUrl.trim() && styles.sendBtnDisabled]}
              onPress={handleUrlImport}
              disabled={!pendingUrl.trim()}
            >
              <Ionicons name="arrow-forward" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Import Recipe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetCancel, { marginTop: 10 }]}
              onPress={() => setShowUrlInput(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E0D0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D1B00',
  },
  headerSub: {
    fontSize: 12,
    color: '#B38B6D',
    marginTop: 1,
  },

  // ── Message list ─────────────────────────────────────────────────────────────
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  userRow: {
    alignItems: 'flex-end',
    gap: 6,
  },
  userImage: {
    width: 220,
    height: 160,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userBubble: {
    backgroundColor: '#FF6B35',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userBubbleText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    // Material Design elevation
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  assistantBubbleText: {
    color: '#2D1B00',
    fontSize: 16,
    lineHeight: 22,
  },

  // ── Typing dots ───────────────────────────────────────────────────────────────
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B38B6D',
  },

  // ── Recipe card ───────────────────────────────────────────────────────────────
  recipeWrapper: {
    maxWidth: '88%',
    gap: 6,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
    gap: 12,
    maxWidth: 300,
  },
  actionCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  actionCardBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  mealPlanCard: {
    maxWidth: '88%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0E0D0',
    elevation: 2,
    shadowColor: '#2D1B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    gap: 10,
  },
  mealPlanCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealPlanCardTitle: { fontSize: 17, fontWeight: '800', color: '#2D1B00' },
  mealPlanCardBody: { fontSize: 14, color: '#6B4C2A', lineHeight: 20 },
  mealPlanCardFeatures: { gap: 4 },
  mealPlanCardFeature: { fontSize: 13, color: '#B38B6D' },
  mealPlanCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    marginTop: 4,
  },
  mealPlanCardBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  recipeIntroText: {
    fontSize: 14,
    color: '#6B4C2A',
    paddingLeft: 4,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  recipeCardImage: {
    width: '100%',
    height: 180,
  },
  recipeCardBody: {
    padding: 16,
    gap: 8,
  },
  recipeCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D1B00',
    lineHeight: 26,
  },
  recipeCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  cuisineChip: {
    backgroundColor: '#EBF3FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  cuisineChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B35',
  },
  recipeMetaText: {
    fontSize: 13,
    color: '#6B4C2A',
  },
  recipeCountText: {
    fontSize: 13,
    color: '#B38B6D',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginTop: 4,
    elevation: 2,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Input area ────────────────────────────────────────────────────────────────
  inputArea: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0E0D0',
    // paddingBottom applied dynamically via insets.bottom in render
  },
  attachPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
  },
  attachThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  attachClearBtn: {
    padding: 2,
  },
  attachLabel: {
    fontSize: 13,
    color: '#6B4C2A',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  attachIconBtn: {
    paddingBottom: 2,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#2D1B00',
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: '#F0E0D0',
  },

  // ── Attachment sheet ──────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D1B00',
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  sheetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D1B00',
  },
  sheetRowSub: {
    fontSize: 13,
    color: '#B38B6D',
    marginTop: 1,
  },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B4C2A',
  },

  // ── URL import modal ───────────────────────────────────────────────────────
  urlModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  urlInput: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E0D0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2D1B00',
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  chip: {
    backgroundColor: '#FFF0E8',
    borderWidth: 1,
    borderColor: '#F0D0B8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF5E0',
    borderTopWidth: 1,
    borderColor: '#FFE0A0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  timerBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FF9500',
  },
});
