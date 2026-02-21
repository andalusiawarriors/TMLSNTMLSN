/**
 * Full-screen camera for food scanning, opened from search-food.
 * On Close: router.back() → returns to search-food.
 * On success: navigates to nutrition with addFoodResult to add the meal.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { searchByBarcode, ParsedNutrition } from '../utils/foodApi';
import { analyzeFood, readNutritionLabel } from '../utils/geminiApi';

type ScanMode = 'ai' | 'barcode' | 'label';

const MODE_LABELS: Record<ScanMode, string> = {
  ai: 'Scan Food (AI)',
  barcode: 'Barcode',
  label: 'Food Label',
};

function toScanMode(s: string | undefined): ScanMode {
  if (s === 'barcode' || s === 'ai' || s === 'label') return s;
  return 'ai';
}

function navigateToAddFood(router: ReturnType<typeof useRouter>, food: ParsedNutrition) {
  router.replace({
    pathname: '/(tabs)/nutrition',
    params: {
      addFoodResult: JSON.stringify({
        name: food.name,
        brand: food.brand || '',
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        servingSize: food.servingSize || '',
      }),
    },
  });
}

export default function ScanFoodCameraScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const initialMode = toScanMode(mode);

  const [cameraMode, setCameraMode] = useState<ScanMode>(initialMode);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [aiPhotoBase64, setAiPhotoBase64] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [showAiDescribe, setShowAiDescribe] = useState(false);
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const handleClose = () => {
    router.back();
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (cameraMode !== 'barcode' || cameraLoading) return;
    setCameraLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const food = await searchByBarcode(result.data);
    setCameraLoading(false);
    if (food) {
      navigateToAddFood(router, food);
    } else {
      Alert.alert('Not Found', 'Could not find that barcode. Try searching manually.', [
        { text: 'Search', onPress: () => router.replace({ pathname: '/(tabs)/nutrition' }) },
        { text: 'OK' },
      ]);
    }
  };

  const handleCameraShutter = async () => {
    if (!cameraRef.current || cameraLoading) return;
    setCameraLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (!photo?.base64) {
        setCameraLoading(false);
        return;
      }
      if (cameraMode === 'label') {
        const parsed = await readNutritionLabel(photo.base64);
        setCameraLoading(false);
        if (parsed) {
          navigateToAddFood(router, parsed);
        } else {
          Alert.alert('Could not read label', 'Try again with better lighting or angle.');
        }
      } else {
        setCameraLoading(false);
        setAiPhotoBase64(photo.base64);
        setShowAiDescribe(true);
      }
    } catch (e) {
      setCameraLoading(false);
      console.warn('Camera capture error:', e);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiPhotoBase64) return;
    setCameraLoading(true);
    const parsed = await analyzeFood(aiPhotoBase64, 'image/jpeg', aiDescription || undefined);
    setCameraLoading(false);
    if (parsed) {
      setShowAiDescribe(false);
      setAiPhotoBase64(null);
      setAiDescription('');
      navigateToAddFood(router, parsed);
    } else {
      Alert.alert('Analysis Failed', 'Could not analyze the photo. Try again.');
    }
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Required', 'Camera permission is needed to scan food.');
        return;
      }
    }
  };

  // Request permission on mount
  React.useEffect(() => {
    handleOpenCamera();
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Requesting camera access…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Camera permission is required</Text>
        <TouchableOpacity onPress={handleOpenCamera} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      {!showAiDescribe && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={
            cameraMode === 'barcode'
              ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }
              : { barcodeTypes: [] }
          }
          onBarcodeScanned={
            cameraMode === 'barcode' && !cameraLoading ? handleBarCodeScanned : undefined
          }
        />
      )}
      {showAiDescribe && (
        <View style={styles.aiDescribeOverlay}>
          <Text style={styles.aiDescribeTitle}>Describe your food</Text>
          <Text style={styles.aiDescribeHint}>Optional — helps the AI estimate better</Text>
          <TextInput
            style={styles.aiDescribeInput}
            placeholder="e.g. grilled chicken breast with rice"
            placeholderTextColor="#888"
            value={aiDescription}
            onChangeText={setAiDescription}
            multiline
          />
          <TouchableOpacity
            style={styles.aiDescribeButton}
            onPress={handleAiSubmit}
            disabled={cameraLoading}
          >
            {cameraLoading ? (
              <ActivityIndicator color="#2F3031" />
            ) : (
              <Text style={styles.aiDescribeButtonText}>Analyze</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowAiDescribe(false);
              setAiPhotoBase64(null);
            }}
            style={{ marginTop: 12 }}
          >
            <Text style={{ color: '#C6C6C6', fontSize: 14 }}>Retake</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.cameraTopBar}>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.cameraCloseText}>Close</Text>
        </TouchableOpacity>
      </View>
      {!showAiDescribe && (
        <View style={styles.cameraModeRow}>
          {(['ai', 'barcode', 'label'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.cameraModeBubble, cameraMode === m && styles.cameraModeBubbleActive]}
              onPress={() => setCameraMode(m)}
            >
              <Text
                style={[
                  styles.cameraModeBubbleText,
                  cameraMode === m && styles.cameraModeBubbleTextActive,
                ]}
              >
                {MODE_LABELS[m]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {!showAiDescribe && cameraMode !== 'barcode' && (
        <View style={styles.cameraShutterRow}>
          {cameraLoading ? (
            <ActivityIndicator size="large" color="#C6C6C6" />
          ) : (
            <TouchableOpacity style={styles.shutterButton} onPress={handleCameraShutter}>
              <View style={styles.shutterButtonInner} />
            </TouchableOpacity>
          )}
        </View>
      )}
      {!showAiDescribe && cameraMode === 'barcode' && cameraLoading && (
        <View style={styles.cameraShutterRow}>
          <ActivityIndicator size="large" color="#C6C6C6" />
        </View>
      )}
    </View>
  );
}

const BUBBLE_FONT = 11;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#C6C6C6',
    fontSize: 16,
  },
  permissionButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#C6C6C6',
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#2F3031',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraTopBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  cameraCloseText: {
    fontSize: 16,
    color: '#C6C6C6',
  },
  cameraModeRow: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  cameraModeBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cameraModeBubbleActive: {
    backgroundColor: '#C6C6C6',
  },
  cameraModeBubbleText: {
    fontSize: BUBBLE_FONT,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  cameraModeBubbleTextActive: {
    fontSize: BUBBLE_FONT,
    fontWeight: '500',
    color: '#2F3031',
    letterSpacing: -0.3,
  },
  cameraShutterRow: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#C6C6C6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#C6C6C6',
  },
  aiDescribeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2F3031',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 5,
  },
  aiDescribeTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  aiDescribeHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  aiDescribeInput: {
    width: '100%',
    minHeight: 80,
    backgroundColor: '#3D3E3F',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  aiDescribeButton: {
    backgroundColor: '#C6C6C6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  aiDescribeButtonText: {
    color: '#2F3031',
    fontSize: 16,
    fontWeight: '600',
  },
});
