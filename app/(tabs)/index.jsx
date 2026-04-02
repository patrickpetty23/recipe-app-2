import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { parseImageIngredients, parseTextIngredients } from '../../src/services/openai';
import { scrapeRecipeUrl } from '../../src/services/scraper';
import { parsePdf, parseDocx } from '../../src/services/fileParser';
import { logger } from '../../src/utils/logger';

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [url, setUrl] = useState('');

  function navigateToEditor(ingredients, sourceType) {
    router.push({
      pathname: '/recipe/editor',
      params: { ingredients: JSON.stringify(ingredients), sourceType },
    });
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    setLoading(true);
    setLoadingMessage('Capturing photo...');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      setShowCamera(false);
      setLoadingMessage('Analyzing recipe with GPT-4o...');
      const ingredients = await parseImageIngredients(photo.base64);
      navigateToEditor(ingredients, 'camera');
    } catch (err) {
      logger.error('scan.handleCapture.error', { error: err.message });
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  async function handleOpenCamera() {
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
    setLoading(true);
    setLoadingMessage('Opening photo library...');
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
      setLoadingMessage('Analyzing recipe with GPT-4o...');
      const ingredients = await parseImageIngredients(result.assets[0].base64);
      navigateToEditor(ingredients, 'photo');
    } catch (err) {
      logger.error('scan.handlePickPhoto.error', { error: err.message });
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
    setLoading(true);
    setLoadingMessage('Fetching recipe from URL...');
    try {
      const text = await scrapeRecipeUrl(trimmed);
      setLoadingMessage('Extracting ingredients with GPT-4o...');
      const ingredients = await parseTextIngredients(text);
      setUrl('');
      navigateToEditor(ingredients, 'url');
    } catch (err) {
      logger.error('scan.handleUrlImport.error', { error: err.message });
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  async function handleFilePick() {
    setLoading(true);
    setLoadingMessage('Selecting file...');
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
      setLoadingMessage('Extracting text from file...');
      const text = isPdf ? await parsePdf(file.uri) : await parseDocx(file.uri);
      setLoadingMessage('Extracting ingredients with GPT-4o...');
      const ingredients = await parseTextIngredients(text);
      navigateToEditor(ingredients, 'file');
    } catch (err) {
      logger.error('scan.handleFilePick.error', { error: err.message });
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Import Recipe</Text>
        <Text style={styles.subheading}>Choose how to add your recipe</Text>

        <TouchableOpacity style={styles.actionButton} onPress={handleOpenCamera}>
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.actionText}>Scan with Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handlePickPhoto}>
          <Ionicons name="images" size={24} color="#fff" />
          <Text style={styles.actionText}>Pick from Photos</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Import from URL</Text>
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
          />
          <TouchableOpacity style={styles.urlButton} onPress={handleUrlImport}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.actionButtonAlt} onPress={handleFilePick}>
          <Ionicons name="document-text" size={24} color="#007AFF" />
          <Text style={styles.actionTextAlt}>Import PDF or DOCX</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && !showCamera && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingTextDark}>{loadingMessage}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingTop: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  actionText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  actionButtonAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  actionTextAlt: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  urlButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  loadingTextDark: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
});
