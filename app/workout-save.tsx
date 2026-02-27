import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, BorderRadius, Font } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Camera, Image as ImageIcon } from 'phosphor-react-native';

const ACCENT_GOLD = '#D4B896';

export default function WorkoutSaveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setUploadError(null);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setUploadError(null);
    }
  };

  const handleSave = async () => {
    if (!supabase || !sessionId) return;
    setIsSaving(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      let postId = createdPostId;

      // 1. Insert workout_posts row FIRST (or skip if retrying after upload failure)
      if (!postId) {
        const { data: postData, error: postError } = await supabase
          .from('workout_posts')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            title: title.trim() || null,
            description: description.trim() || null,
            visibility: isPublic ? 'public' : 'private',
          })
          .select()
          .single();

        if (postError) throw postError;
        postId = postData.id;
        setCreatedPostId(postId);
        if (__DEV__) console.log('[WorkoutSave] created postId:', postId);
      }

      // 2. If user picked an image, upload to workout-images at postId/timestamp.jpg
      if (imageUri) {
        const timestamp = Date.now();
        const imagePath = `${postId}/${timestamp}.jpg`;

        const file = await fetch(imageUri);
        const blob = await file.blob();

        const { error: uploadErr } = await supabase.storage
          .from('workout-images')
          .upload(imagePath, blob, { upsert: true });

        if (uploadErr) {
          setUploadError('Image upload failed. Post saved. Tap Share again to retry upload.');
          if (__DEV__) console.warn('[WorkoutSave] upload failed:', uploadErr);
          setIsSaving(false);
          return;
        }

        // 3. Update workout_posts.image_path
        const { error: updateErr } = await supabase
          .from('workout_posts')
          .update({ image_path: imagePath })
          .eq('id', postId);

        if (updateErr) {
          setUploadError('Could not update post with image. Tap Share again to retry.');
          if (__DEV__) console.warn('[WorkoutSave] update image_path failed:', updateErr);
          setIsSaving(false);
          return;
        }

        if (__DEV__) console.log('[WorkoutSave] uploaded image_path:', imagePath);
      }

      router.back();
    } catch (e) {
      console.error('Save error', e);
      Alert.alert('Error', 'Could not save post.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.rootContainer}>
        {/* Background */}
        <ImageBackground
          source={require('../assets/home-background.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['transparent', 'rgba(47, 48, 49, 0.4)', 'rgba(47, 48, 49, 0.85)', '#2F3031', '#1a1a1a']}
            locations={[0, 0.2, 0.35, 0.45, 0.65]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={12}>
              <Text style={styles.headerSkipText}>Skip</Text>
            </Pressable>

            <Text style={styles.headerTitle}>New Post</Text>

            <Pressable onPress={handleSave} style={styles.headerBtn} hitSlop={12} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={ACCENT_GOLD} />
              ) : (
                <Text style={styles.headerShareText}>Share</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Error Banner */}
            {uploadError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{uploadError}</Text>
              </View>
            ) : null}

            {/* Photo Section */}
            <Text style={styles.sectionLabel}>Photo</Text>
            <View style={styles.card}>
              <View style={styles.imageRow}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={32} color={ACCENT_GOLD} weight="thin" />
                    <Text style={styles.placeholderText}>No photo</Text>
                  </View>
                )}
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoBtn} onPress={handleTakePhoto}>
                    <Camera size={20} color={ACCENT_GOLD} />
                    <Text style={styles.photoBtnText}>Camera</Text>
                  </Pressable>
                  <Pressable style={styles.photoBtn} onPress={handlePickPhoto}>
                    <ImageIcon size={20} color={ACCENT_GOLD} />
                    <Text style={styles.photoBtnText}>Gallery</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Post Details Section */}
            <Text style={styles.sectionLabel}>Post Details</Text>
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Title (e.g. Morning Push)..."
                  placeholderTextColor={ACCENT_GOLD + '66'}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
              <View style={styles.rowSeparator} />
              <View style={styles.captionRow}>
                <TextInput
                  style={styles.inputArea}
                  placeholder="Write a caption..."
                  placeholderTextColor={ACCENT_GOLD + '66'}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Privacy Section */}
            <Text style={styles.sectionLabel}>Privacy</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Publicly Visible</Text>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#34C759' }}
                  thumbColor={isPublic ? '#fff' : '#C6C6C6'}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#2F3031',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: {
    padding: Spacing.sm,
    minWidth: 56,
  },
  headerTitle: {
    fontFamily: Font.semiBold,
    fontSize: 18,
    color: '#C6C6C6',
    textAlign: 'center',
  },
  headerSkipText: {
    fontFamily: Font.regular,
    fontSize: 16,
    color: 'rgba(198, 198, 198, 0.5)',
  },
  headerShareText: {
    fontFamily: Font.semiBold,
    fontSize: 16,
    color: ACCENT_GOLD,
    textAlign: 'right',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Section labels
  sectionLabel: {
    fontFamily: Font.semiBold,
    fontSize: 14,
    color: ACCENT_GOLD,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },

  // Glass card
  card: {
    backgroundColor: 'rgba(40,40,40,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    overflow: 'hidden',
  },

  // Photo card internals
  imageRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    alignItems: 'center',
  },
  previewImage: {
    width: 100,
    height: 125,
    borderRadius: BorderRadius.md,
  },
  imagePlaceholder: {
    width: 100,
    height: 125,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  placeholderText: {
    fontFamily: Font.regular,
    color: '#C6C6C6',
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  photoActions: {
    flex: 1,
    marginLeft: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.sm,
  },
  photoBtnText: {
    fontFamily: Font.regular,
    fontSize: 14,
    color: '#C6C6C6',
  },

  // Input card internals
  inputRow: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  captionRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  input: {
    fontFamily: Font.regular,
    fontSize: 16,
    color: '#C6C6C6',
  },
  inputArea: {
    fontFamily: Font.regular,
    fontSize: 16,
    color: '#C6C6C6',
    minHeight: 90,
  },
  rowSeparator: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: Spacing.md,
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: Spacing.md,
  },
  toggleLabel: {
    fontFamily: Font.regular,
    fontSize: 16,
    color: '#C6C6C6',
  },

  // Error banner
  errorBanner: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,0,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.25)',
  },
  errorText: {
    fontFamily: Font.regular,
    fontSize: 14,
    color: '#C6C6C6',
  },
});
