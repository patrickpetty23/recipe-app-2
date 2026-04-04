import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { parseRecipeFromImage, parseRecipeFromText } from '../../src/services/openai';
import { scrapeRecipeUrl } from '../../src/services/scraper';
import { parsePdf, parseDocx } from '../../src/services/fileParser';
import { getAllRecipes } from '../../src/db/queries';
import { logger } from '../../src/utils/logger';

export default function HomeScreen() {
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState('');
  const [recipeCount, setRecipeCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      try {
        const recipes = getAllRecipes();
        setRecipeCount(recipes.length);
      } catch (err) {
        logger.error('home.loadCount.error', { error: err.message });
      }
    }, [])
  );

  function navigateToEditor(recipeData, sourceType, imageUri) {
    router.push({
      pathname: '/recipe/editor',
      params: {
        recipeData: JSON.stringify(recipeData),
        sourceType,
        imageUri: imageUri ?? '',
      },
    });
  }

  function openModal() {
    setShowUploadModal(true);
    setShowUrlInput(false);
    setUrl('');
  }

  function closeModal() {
    setShowUploadModal(false);
    setShowUrlInput(false);
    setUrl('');
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    setLoading(true);
    setLoadingMessage('Capturing photo…');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      setShowCamera(false);
      setLoadingMessage('Analyzing recipe with GPT-4o…');
      const recipeData = await parseRecipeFromImage(photo.base64);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigateToEditor(recipeData, 'camera', photo.uri);
    } catch (err) {
      logger.error('scan.handleCapture.error', { error: err.message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  async function handleOpenCamera() {
    closeModal();
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan recipes.');
        return;
      }
    }
    setShowCamera(true);
  }

  async function handlePickPhoto() {
    closeModal();
    setLoading(true);
    setLoadingMessage('Opening photo library…');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      });
      if (result.canceled) {
        setLoading(false);
        setLoadingMessage('');
        return;
      }
      setLoadingMessage('Analyzing recipe with GPT-4o…');
      const asset = result.assets[0];
      const recipeData = await parseRecipeFromImage(asset.base64);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigateToEditor(recipeData, 'photo', asset.uri);
    } catch (err) {
      logger.error('scan.handlePickPhoto.error', { error: err.message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  async function handleUrlImport() {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('Enter a URL', 'Paste a recipe URL to import.');
      return;
    }
    closeModal();
    setLoading(true);
    setLoadingMessage('Fetching recipe from URL…');
    try {
      const text = await scrapeRecipeUrl(trimmed);
      setLoadingMessage('Extracting ingredients with GPT-4o…');
      const recipeData = await parseRecipeFromText(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigateToEditor(recipeData, 'url', null);
    } catch (err) {
      logger.error('scan.handleUrlImport.error', { error: err.message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  async function handleFilePick() {
    closeModal();
    setLoading(true);
    setLoadingMessage('Selecting file…');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setLoading(false);
        setLoadingMessage('');
        return;
      }
      const file = result.assets[0];
      const isPdf = file.mimeType === 'application/pdf' || file.name?.endsWith('.pdf');
      setLoadingMessage('Extracting text from file…');
      const text = isPdf ? await parsePdf(file.uri) : await parseDocx(file.uri);
      setLoadingMessage('Extracting ingredients with GPT-4o…');
      const recipeData = await parseRecipeFromText(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigateToEditor(recipeData, 'file', null);
    } catch (err) {
      logger.error('scan.handleFilePick.error', { error: err.message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        ) : (
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCamera(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={styles.cancelButton} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.greeting}>Recipe Scanner</Text>
        <Text style={styles.tagline}>
          Scan a cookbook, snap a photo, or paste a link — we'll handle the rest.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/library')}>
          <Text style={styles.statNumber}>{recipeCount}</Text>
          <Text style={styles.statLabel}>{recipeCount === 1 ? 'Recipe Saved' : 'Recipes Saved'}</Text>
          <Text style={styles.statCta}>View Library →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ctaSection}>
        <TouchableOpacity style={styles.uploadButton} onPress={openModal} activeOpacity={0.85}>
          <Ionicons name="add-circle" size={28} color="#fff" />
          <Text style={styles.uploadButtonText}>Add Recipe</Text>
        </TouchableOpacity>
        <Text style={styles.ctaHint}>Import from camera, photos, URL, or file</Text>
      </View>

      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalPositioner}
          >
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add a Recipe</Text>

              <TouchableOpacity style={styles.modalOption} onPress={handleOpenCamera}>
                <View style={[styles.modalIconWrap, { backgroundColor: '#EBF5FF' }]}>
                  <Ionicons name="camera" size={22} color="#007AFF" />
                </View>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Scan with Camera</Text>
                  <Text style={styles.modalOptionSub}>Point at a cookbook or recipe card</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={handlePickPhoto}>
                <View style={[styles.modalIconWrap, { backgroundColor: '#F0EBFF' }]}>
                  <Ionicons name="images" size={22} color="#7C3AED" />
                </View>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Pick from Photos</Text>
                  <Text style={styles.modalOptionSub}>Choose a recipe image from your library</Text>
                </View>
              </TouchableOpacity>

              {!showUrlInput ? (
                <TouchableOpacity style={styles.modalOption} onPress={() => setShowUrlInput(true)}>
                  <View style={[styles.modalIconWrap, { backgroundColor: '#EBFFF0' }]}>
                    <Ionicons name="link" size={22} color="#16A34A" />
                  </View>
                  <View style={styles.modalOptionText}>
                    <Text style={styles.modalOptionTitle}>Import from URL</Text>
                    <Text style={styles.modalOptionSub}>Paste a link to any recipe page</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.urlInputSection}>
                  <View style={styles.urlRow}>
                    <TextInput
                      style={styles.urlInput}
                      placeholder="https://example.com/recipe"
                      placeholderTextColor="#999"
                      value={url}
                      onChangeText={setUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      autoFocus
                    />
                    <TouchableOpacity style={styles.urlGoButton} onPress={handleUrlImport}>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.modalOption} onPress={handleFilePick}>
                <View style={[styles.modalIconWrap, { backgroundColor: '#FFF5EB' }]}>
                  <Ionicons name="document-text" size={22} color="#EA580C" />
                </View>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Import PDF or DOCX</Text>
                  <Text style={styles.modalOptionSub}>Upload a recipe document</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCancelButton} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {loading && !showCamera && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 64 : 80,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#636366',
    lineHeight: 22,
  },
  statsRow: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 1,
  },
  statNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
  },
  statCta: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 8,
  },
  ctaSection: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 10,
    width: '100%',
    elevation: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
  },
  ctaHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalPositioner: {
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalOptionSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  urlInputSection: {
    paddingVertical: 10,
    paddingLeft: 58,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  urlGoButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636366',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  cancelButton: {
    width: 70,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
});
