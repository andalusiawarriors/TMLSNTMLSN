import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { AnimatedFadeInUp } from '../../components/AnimatedFadeInUp';
import { HomeGradientBackground } from '../../components/HomeGradientBackground';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { getPrompts, savePrompts } from '../../utils/storage';
import { SAMPLE_PROMPTS } from '../../constants/samplePrompts';
import { Prompt } from '../../types';

const CONTENT_PADDING = 19;
const CARD_RADIUS = 16;
const CARD_LABEL_FONT_SIZE = 10;
const CARD_LABEL_COLOR = '#FFFFFF';

export default function PromptsScreen() {
  const insets = useSafeAreaInsets();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [animTrigger, setAnimTrigger] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
    }, [])
  );

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    let storedPrompts = await getPrompts();
    
    // If no prompts in storage, use sample prompts
    if (storedPrompts.length === 0) {
      await savePrompts(SAMPLE_PROMPTS);
      storedPrompts = SAMPLE_PROMPTS;
    }
    
    setPrompts(storedPrompts);
  };

  const openPromptDetail = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setShowDetailModal(true);
  };

  const copyPromptToClipboard = async () => {
    if (!selectedPrompt) return;

    await Clipboard.setStringAsync(selectedPrompt.fullText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Show a success message (in production, you might use a toast)
    alert('✅ Prompt copied to clipboard! Paste it into ChatGPT or your preferred AI tool.');
  };

  const openSourceLink = async () => {
    if (!selectedPrompt) return;
    
    try {
      await Linking.openURL(selectedPrompt.sourceUrl);
    } catch (error) {
      alert('Could not open link');
    }
  };

  const filteredPrompts = filterCategory
    ? prompts.filter((p) => p.category === filterCategory)
    : prompts;

  const categories = Array.from(new Set(prompts.map((p) => p.category).filter(Boolean)));

  return (
    <View style={styles.container}>
      <HomeGradientBackground />
      <ScrollView style={styles.scrollLayer} contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 52 }]}>
        <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
          <View style={styles.headerWrap}>
            <Text style={styles.headerTitle}>prompts.</Text>
            <Text style={styles.headerSubtitle}>
              actionable AI prompts to execute the advice from our content
            </Text>
          </View>
        </AnimatedFadeInUp>

        <AnimatedFadeInUp delay={50} duration={380} trigger={animTrigger}>
          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilter}
            contentContainerStyle={styles.categoryFilterContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                !filterCategory && styles.categoryChipActive,
              ]}
              onPress={() => setFilterCategory(null)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  !filterCategory && styles.categoryChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  filterCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setFilterCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    filterCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </AnimatedFadeInUp>

        {/* Prompts List */}
        {filteredPrompts.length === 0 ? (
          <AnimatedFadeInUp delay={100} duration={380} trigger={animTrigger}>
            <Card gradientFill borderRadius={CARD_RADIUS} style={styles.promptCard}>
              <Text style={styles.emptyText}>
                No prompts available yet. Check back weekly for new actionable prompts!
              </Text>
            </Card>
          </AnimatedFadeInUp>
        ) : (
          filteredPrompts.map((prompt, index) => (
            <AnimatedFadeInUp key={prompt.id} delay={100 + index * 45} duration={380} trigger={animTrigger}>
              <Card gradientFill borderRadius={CARD_RADIUS} style={styles.promptCard}>
                <TouchableOpacity onPress={() => openPromptDetail(prompt)} style={styles.promptCardInner}>
                  <View style={styles.promptHeader}>
                    <Text style={styles.promptTitle}>{prompt.title}</Text>
                    {prompt.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{prompt.category}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.promptSummary}>{prompt.summary}</Text>
                  <View style={styles.promptFooter}>
                    <Text style={styles.promptSource}>From: {prompt.source}</Text>
                    <Text style={styles.promptDate}>
                      {new Date(prompt.dateAdded).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Card>
            </AnimatedFadeInUp>
          ))
        )}
      </ScrollView>

      {/* Prompt Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedPrompt && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle}>{selectedPrompt.title}</Text>
                    {selectedPrompt.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {selectedPrompt.category}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalSummary}>{selectedPrompt.summary}</Text>

                  <TouchableOpacity
                    style={styles.sourceLink}
                    onPress={openSourceLink}
                  >
                    <Text style={styles.sourceLinkText}>
                      📄 {selectedPrompt.source}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.promptTextContainer}>
                    <Text style={styles.promptTextLabel}>Prompt:</Text>
                    <ScrollView style={styles.promptTextScroll}>
                      <Text style={styles.promptText}>{selectedPrompt.fullText}</Text>
                    </ScrollView>
                  </View>

                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsTitle}>How to use:</Text>
                    <Text style={styles.instructionsText}>
                      1. Tap "Copy to Clipboard" below
                    </Text>
                    <Text style={styles.instructionsText}>
                      2. Open ChatGPT or your preferred AI tool
                    </Text>
                    <Text style={styles.instructionsText}>
                      3. Paste and fill in [YOUR_INFO] placeholders
                    </Text>
                    <Text style={styles.instructionsText}>
                      4. Get your personalized protocol!
                    </Text>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <Button
                    title="📋 Copy to Clipboard"
                    onPress={copyPromptToClipboard}
                    style={styles.copyButton}
                  />
                  <Button
                    title="Close"
                    onPress={() => setShowDetailModal(false)}
                    variant="secondary"
                    style={styles.closeModalButton}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollLayer: {
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: Spacing.xxl,
  },
  promptCard: {
    width: Dimensions.get('window').width - CONTENT_PADDING * 2,
    alignSelf: 'center',
    paddingTop: 17.5,
    paddingBottom: 17.5,
    paddingHorizontal: 11,
    marginVertical: 0,
    marginBottom: Spacing.sm,
  },
  promptCardInner: {
    flex: 1,
  },
  headerWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: Typography.label,
    color: Colors.primaryLight,
    opacity: 0.8,
    marginTop: Spacing.sm,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  categoryFilter: {
    marginBottom: Spacing.md,
  },
  categoryFilterContent: {
    paddingRight: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: CARD_RADIUS,
    marginRight: Spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: Colors.primaryLight + '30',
  },
  categoryChipText: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  categoryChipTextActive: {
    color: CARD_LABEL_COLOR,
  },
  emptyText: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  promptTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
    marginRight: Spacing.sm,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  categoryBadgeText: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
  },
  promptSummary: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
    marginBottom: Spacing.md,
  },
  promptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptSource: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
  },
  promptDate: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: Colors.white,
    fontWeight: Typography.weights.bold,
  },
  modalBody: {
    flex: 1,
    marginBottom: Spacing.lg,
  },
  modalSummary: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  sourceLink: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sourceLinkText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: '500',
  },
  promptTextContainer: {
    marginBottom: Spacing.lg,
  },
  promptTextLabel: {
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  promptTextScroll: {
    maxHeight: 300,
  },
  promptText: {
    fontSize: Typography.promptText,
    color: Colors.primaryLight,
    lineHeight: 24,
    backgroundColor: Colors.black,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    fontFamily: 'monospace',
  },
  instructionsBox: {
    backgroundColor: Colors.primaryLight + '10',
    padding: Spacing.md,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '30',
  },
  instructionsTitle: {
    fontSize: Typography.body,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  instructionsText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  modalActions: {
    gap: Spacing.sm,
  },
  copyButton: {
    backgroundColor: Colors.primaryDarkLighter,
  },
  closeModalButton: {
    marginTop: Spacing.xs,
  },
});
