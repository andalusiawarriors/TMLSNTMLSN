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
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Spacing, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Camera, Image as ImageIcon } from 'phosphor-react-native';

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

      if (imageUri) {
        const timestamp = Date.now();
        const imagePath = `${postId}/${timestamp}.jpg`;

        const file = await fetch(imageUri);
        const blob = await file.blob();

        const { error: uploadErr } = await supabase.storage
          .from('workout-images')
          .upload(imagePath, blob, { upsert: true });

        if (uploadErr) {
          setUploadError('Image upload failed. Post saved. Tap Share again to retry.');
          if (__DEV__) console.warn('[WorkoutSave] upload failed:', uploadErr);
          setIsSaving(false);
          return;
        }

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
      <View style={[styles.root, { backgroundColor: colors.primaryDark }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ─── TOP BAR ─── */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.skipWrap} hitSlop={12}>
              <Text style={[styles.skipText, { color: colors.primaryLight + '60' }]}>Skip</Text>
            </Pressable>

            <Text style={[styles.screenTitle, { color: colors.primaryLight }]}>New Post</Text>

            <Pressable onPress={handleSave} style={styles.shareWrap} hitSlop={12} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <View style={[styles.shareButton, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.shareButtonText, { color: colors.primaryDark }]}>Share</Text>
                </View>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Error */}
            {uploadError ? (
              <View style={[styles.errorRow, { backgroundColor: colors.accentRed + '15' }]}>
                <Text style={[styles.errorText, { color: colors.primaryLight }]}>{uploadError}</Text>
              </View>
            ) : null}

            {/* ─── PHOTO ─── */}
            <View style={[styles.photoRow]}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: colors.primaryLight + '08' }]}>
                  <Camera size={28} color={colors.primaryLight + '50'} weight="thin" />
                </View>
              )}

              <View style={styles.photoButtons}>
                <Pressable
                  style={[styles.photoBtn, { backgroundColor: colors.primaryLight + '12' }]}
                  onPress={handleTakePhoto}
                >
                  <Camera size={18} color={colors.primaryLight} />
                  <Text style={[styles.photoBtnLabel, { color: colors.primaryLight }]}>Camera</Text>
                </Pressable>
                <Pressable
                  style={[styles.photoBtn, { backgroundColor: colors.primaryLight + '12' }]}
                  onPress={handlePickPhoto}
                >
                  <ImageIcon size={18} color={colors.primaryLight} />
                  <Text style={[styles.photoBtnLabel, { color: colors.primaryLight }]}>Gallery</Text>
                </Pressable>
              </View>
            </View>

            {/* ─── INPUTS ─── */}
            <View style={[styles.inputGroup, { backgroundColor: colors.primaryLight + '08' }]}>
              <TextInput
                style={[styles.inputTitle, { color: colors.primaryLight }]}
                placeholder="Title"
                placeholderTextColor={colors.primaryLight + '30'}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
              />
              <View style={[styles.inputDivider, { backgroundColor: colors.primaryLight + '12' }]} />
              <TextInput
                style={[styles.inputCaption, { color: colors.primaryLight }]}
                placeholder="Write a caption..."
                placeholderTextColor={colors.primaryLight + '30'}
                multiline
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
            </View>

            {/* ─── VISIBILITY ─── */}
            <View style={[styles.toggleRow, { backgroundColor: colors.primaryLight + '08' }]}>
              <Text style={[styles.toggleLabel, { color: colors.primaryLight }]}>Public</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: colors.primaryLight + '20', true: colors.primaryLight + '80' }}
                thumbColor={isPublic ? colors.primaryDark : colors.primaryLight + '60'}
                ios_backgroundColor={colors.primaryLight + '20'}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Top bar — matches workout overlay logTopBar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  skipWrap: {
    minWidth: 52,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '400',
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  shareWrap: {
    minWidth: 52,
    alignItems: 'flex-end',
  },
  shareButton: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },

  // Error
  errorRow: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  // Photo row
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 2,
  },
  photoPlaceholder: {
    width: 88,
    height: 110,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: 88,
    height: 110,
    borderRadius: 12,
  },
  photoButtons: {
    flex: 1,
    gap: 10,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  photoBtnLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Input group
  inputGroup: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '400',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  inputCaption: {
    fontSize: 15,
    fontWeight: '400',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    minHeight: 96,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 14,
    height: 52,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
});
