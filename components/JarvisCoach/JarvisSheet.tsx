import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BottomSheetModal, BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { CaretRight } from 'phosphor-react-native';

import { Colors, Font } from '../../constants/theme';
import { useJarvis } from '../../hooks/useJarvis';

const BG = '#2f3031';
const MUTED = 'rgba(198,198,198,0.55)';
const CHAMPAGNE = '#D4B896';
const GREEN = '#22C55E';

function BlinkingCursor() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 530 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={animatedStyle}>
      <Text style={styles.cursorChar}>|</Text>
    </Animated.View>
  );
}

function PulsingDot() {
  const opacity = useSharedValue(0.7);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export type JarvisSheetProps = {
  onClose: () => void;
};

export function JarvisSheet({ onClose }: JarvisSheetProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const modalRef = useRef<BottomSheetModal>(null);
  const jarvis = useJarvis();
  const { contextLoading, noUser, context } = jarvis;

  useEffect(() => {
    if (!contextLoading && jarvis.messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [contextLoading, jarvis.messages.length]);

  const showNoUser = noUser && !contextLoading;

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  const handleSend = useCallback(() => {
    const t = inputText.trim();
    if (!t || jarvis.isLoading) return;
    setInputText('');
    jarvis.sendMessage(t);
  }, [inputText, jarvis]);

  const subheader = context
    ? (context.todayPlan?.workoutType && context.trainingSettings?.scheduleMode
        ? `${context.todayPlan.workoutType} · ${context.trainingSettings.scheduleMode}`
        : context.todayPlan?.workoutType ?? context.trainingSettings?.scheduleMode ?? '')
    : '';

  return (
      <BottomSheetModal
        ref={modalRef}
        snapPoints={['85%']}
        enablePanDownToClose
        onDismiss={onClose}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>JARVIS</Text>
              <PulsingDot />
            </View>
            {subheader ? (
              <Text style={styles.subheader} numberOfLines={1}>
                {subheader}
              </Text>
            ) : null}
          </View>

          {showNoUser ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Sign in to use JARVIS</Text>
            </View>
          ) : contextLoading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>JARVIS initialising...</Text>
              <BlinkingCursor />
            </View>
          ) : (
            <>
              <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
              >
                <ScrollView
                  ref={scrollRef}
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {jarvis.messages.map((m, i) =>
                    m.role === 'assistant' ? (
                      <View key={i} style={styles.msgRow}>
                        <Text style={styles.assistantMsg}>{m.content}</Text>
                      </View>
                    ) : (
                      <View key={i} style={styles.msgRowRight}>
                        <View style={styles.userBubble}>
                          <Text style={styles.userMsg}>{m.content}</Text>
                        </View>
                      </View>
                    )
                  )}
                  {jarvis.isLoading && (
                    <View style={styles.msgRow}>
                      <Text style={styles.assistantMsg}>Thinking...</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.inputRow}>
                  <BottomSheetTextInput
                    style={styles.input}
                    placeholder="Ask JARVIS..."
                    placeholderTextColor={MUTED}
                    value={inputText}
                    onChangeText={setInputText}
                    editable={!jarvis.isLoading}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendBtn,
                      pressed && styles.sendBtnPressed,
                    ]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || jarvis.isLoading}
                  >
                    <CaretRight size={20} weight="bold" color={Colors.primaryLight} />
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: BG },
  handle: { backgroundColor: MUTED, width: 36 },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: Font.mono,
    fontSize: 18,
    letterSpacing: 2,
    color: Colors.primaryLight,
    textTransform: 'uppercase',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  subheader: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  loadingWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  loadingText: {
    fontFamily: Font.mono,
    fontSize: 14,
    color: MUTED,
  },
  cursorChar: {
    fontFamily: Font.mono,
    fontSize: 14,
    color: MUTED,
  },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  msgRow: { marginBottom: 16, alignSelf: 'flex-start', maxWidth: '95%' },
  msgRowRight: { marginBottom: 16, alignSelf: 'flex-end', maxWidth: '85%' },
  assistantMsg: {
    fontFamily: Font.mono,
    fontSize: 14,
    color: Colors.primaryLight,
    lineHeight: 20,
  },
  userBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CHAMPAGNE,
    backgroundColor: 'transparent',
  },
  userMsg: {
    fontSize: 14,
    color: Colors.primaryLight,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(198,198,198,0.12)',
    color: Colors.primaryLight,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(198,198,198,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: { opacity: 0.7 },
});
