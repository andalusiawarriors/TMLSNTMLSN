import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Image, Pressable, ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
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

      router.replace('/workout-history');
    } catch (e) {
      console.error('Save error', e);
      Alert.alert('Error', 'Could not save post.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.black }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: colors.primaryLight }]}>Skip</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primaryLight }]}>New Post</Text>
          <Pressable onPress={handleSave} style={styles.headerBtn} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={colors.primaryLight} /> : <Text style={[styles.headerBtnText, { color: '#007AFF', fontWeight: '600' }]}>Share</Text>}
          </Pressable>
        </View>

        <View style={[styles.content]}>
          {uploadError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.primaryLight + '15', borderColor: colors.accentRed + '40' }]}>
              <Text style={[styles.errorText, { color: colors.primaryLight }]}>{uploadError}</Text>
            </View>
          ) : null}
          <View style={styles.imageSection}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.primaryDarkLighter }]}>
                <Camera size={32} color={colors.primaryLight} weight="thin" />
                <Text style={{ color: colors.primaryLight, marginTop: 8, fontWeight: '500' }}>No photo</Text>
              </View>
            )}

            <View style={styles.photoActions}>
              <Pressable style={[styles.photoBtn, { backgroundColor: colors.primaryDarkLighter }]} onPress={handleTakePhoto}>
                <Camera size={20} color={colors.primaryLight} />
                <Text style={[styles.photoBtnText, { color: colors.primaryLight }]}>Camera</Text>
              </Pressable>
              <Pressable style={[styles.photoBtn, { backgroundColor: colors.primaryDarkLighter }]} onPress={handlePickPhoto}>
                <ImageIcon size={20} color={colors.primaryLight} />
                <Text style={[styles.photoBtnText, { color: colors.primaryLight }]}>Gallery</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.inputGroup, { borderBottomColor: colors.primaryDarkLighter }]}>
            <TextInput
              style={[styles.input, { color: colors.primaryLight }]}
              placeholder="Title (e.g. Morning Push)..."
              placeholderTextColor={colors.primaryLight + '60'}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={[styles.inputGroup, { borderBottomColor: colors.primaryDarkLighter, flex: 1 }]}>
            <TextInput
              style={[styles.inputArea, { color: colors.primaryLight }]}
              placeholder="Write a caption..."
              placeholderTextColor={colors.primaryLight + '60'}
              multiline
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
          </View>

          <View style={[styles.row, { borderBottomColor: colors.primaryDarkLighter }]}>
            <Text style={[styles.rowLabel, { color: colors.primaryLight }]}>Publicly Visible</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: colors.primaryDarkLighter, true: '#34C759' }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerBtn: { padding: Spacing.sm },
  headerBtnText: { fontSize: 16, fontWeight: '600' },
  content: { flex: 1, padding: Spacing.lg },
  errorBanner: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  errorText: { fontSize: 14 },
  imageSection: { flexDirection: 'row', marginBottom: Spacing.xl },
  previewImage: { width: 100, height: 125, borderRadius: 12 },
  imagePlaceholder: { width: 100, height: 125, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photoActions: { flex: 1, marginLeft: Spacing.lg, justifyContent: 'center', gap: Spacing.md },
  photoBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  photoBtnText: { fontSize: 14, fontWeight: '600' },
  inputGroup: { paddingVertical: Spacing.md, borderBottomWidth: 1 },
  input: { fontSize: 16, fontWeight: '400', paddingVertical: Spacing.sm },
  inputArea: { fontSize: 16, fontWeight: '400', minHeight: 100 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.lg, borderBottomWidth: 1 },
  rowLabel: { fontSize: 16, fontWeight: '400' }
});
