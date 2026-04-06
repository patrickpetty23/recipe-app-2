import { useState, useRef, useCallback } from 'react';
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
import { scrapeRecipeUrl } from '../../src/services/scraper';
import { parsePdf, parseDocx } from '../../src/services/fileParser';
import { logger } from '../../src/utils/logger';

const URL_REGEX = /^https?:\/\//i;

const WELCOME_ID = 'welcome';
const TYPING_ID = 'typing';

const WELCOME_MESSAGE = {
  id: WELCOME_ID,
  role: 'assistant',
  type: 'text',
  content:
    "Hi! I'm your recipe assistant. Send me a photo of a recipe, paste a link, or just describe what you want to cook.",
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

      // ── Plain text → processChat ───────────────────────────────────────────
      logger.info('chat.handleSend.text', { length: text.length });
      const history = buildHistory(messages);
      const result = await processChat([...history, { role: 'user', content: text }]);
      if (result.type === 'recipe' && result.recipe) {
        removeTypingAndAdd({
          id: Crypto.randomUUID(),
          role: 'assistant',
          type: 'recipe',
          content: result.message || 'Here you go!',
          imageUri: null,
          recipeData: result.recipe,
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

  async function handleCameraAttach() {
    setShowAttachSheet(false);
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

  async function handlePhotoAttach() {
    setShowAttachSheet(false);
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

  async function handleFileAttach() {
    setShowAttachSheet(false);
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

      // Show user's file message first
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
            placeholder="Paste a link, drop a photo, or describe a recipe…"
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
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAttachSheet(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to Message</Text>

            <TouchableOpacity style={styles.sheetRow} onPress={handleCameraAttach}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#EBF3FF' }]}>
                <Ionicons name="camera" size={22} color="#007AFF" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>Camera</Text>
                <Text style={styles.sheetRowSub}>Take a photo of a recipe</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handlePhotoAttach}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#F0EBFF' }]}>
                <Ionicons name="images" size={22} color="#7C3AED" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>Photo Library</Text>
                <Text style={styles.sheetRowSub}>Choose a recipe photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleFileAttach}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#FFF5EB' }]}>
                <Ionicons name="document-text" size={22} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.sheetRowTitle}>PDF or DOCX</Text>
                <Text style={styles.sheetRowSub}>Import a recipe document</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setShowAttachSheet(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
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
});
