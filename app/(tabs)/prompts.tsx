import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { getPrompts, savePrompts } from '../../utils/storage';
import { SAMPLE_PROMPTS } from '../../constants/samplePrompts';
import { Prompt } from '../../types';

export default function PromptsScreen() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

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
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Prompt Vault</Text>
          <Text style={styles.headerSubtitle}>
            Actionable AI prompts to execute the advice from our content
          </Text>
        </View>

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

        {/* Prompts List */}
        {filteredPrompts.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>
              No prompts available yet. Check back weekly for new actionable prompts!
            </Text>
          </Card>
        ) : (
          filteredPrompts.map((prompt) => (
            <Card key={prompt.id}>
              <TouchableOpacity onPress={() => openPromptDetail(prompt)}>
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
    backgroundColor: Colors.black,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    lineHeight: 22,
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
    borderRadius: BorderRadius.xl,
    marginRight: Spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: Colors.accentBlue,
  },
  categoryChipText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.medium,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  emptyText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  promptTitle: {
    flex: 1,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginRight: Spacing.sm,
  },
  categoryBadge: {
    backgroundColor: Colors.accentBlue + '30',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  categoryBadgeText: {
    fontSize: Typography.label,
    color: Colors.accentBlue,
    fontWeight: Typography.weights.semiBold,
  },
  promptSummary: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  promptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptSource: {
    fontSize: Typography.label,
    color: Colors.accentBlue,
    fontWeight: Typography.weights.medium,
  },
  promptDate: {
    fontSize: Typography.label,
    color: Colors.primaryLight,
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
    color: Colors.accentBlue,
    fontWeight: Typography.weights.semiBold,
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
    backgroundColor: Colors.accentBlue + '10',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accentBlue + '40',
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
    backgroundColor: Colors.accentBlue,
  },
  closeModalButton: {
    marginTop: Spacing.xs,
  },
});
