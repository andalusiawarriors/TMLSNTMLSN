import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../constants/theme';
import { AuthModal } from './AuthModal';

const ACCENT_GOLD = '#D4B896';
const ACCENT_GOLD_DARK = '#A8895E';
const ACCENT_GRADIENT: [string, string] = [ACCENT_GOLD, ACCENT_GOLD_DARK];

const TAB_BAR_HEIGHT = 76; // PILL_BOTTOM(19) + PILL_HEIGHT(57) from _layout
const CARD_BG = 'rgba(40,40,40,0.6)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';
const ROW_HEIGHT = 56;
const ICON_SIZE = 22;
const ICON_COLOR = 'rgba(255,255,255,0.7)';
const AVATAR_SIZE = 56;

export type ProfileSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPreferencesPress?: () => void;
};

function Row({
  icon,
  label,
  subtitle,
  rightText,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const rowStyle = [styles.row, !last && styles.rowBorder];
  const children = (
    <>
      <Ionicons name={icon} size={ICON_SIZE} color={ICON_COLOR} style={styles.rowIcon} />
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightText ? (
        <Text style={styles.rowRight}>{rightText}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={ICON_COLOR} />
      )}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.rowPressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{children}</View>;
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={[styles.sectionHeader, { color: ACCENT_GOLD }]}>{label}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const noOpAuth = async (_email: string, _password: string) => ({ error: null as Error | null });

export function ProfileSheet({ visible, onClose, onPreferencesPress }: ProfileSheetProps) {
  const insets = useSafeAreaInsets();
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Padding so last items can scroll above the tab bar (which sits on top)
  const scrollBottomPad = TAB_BAR_HEIGHT + insets.bottom;

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100000, elevation: 100000, overflow: 'visible' }]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tintOverlay]} />
      </Pressable>
      <View style={[styles.sheet, styles.sheetOverflow]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: scrollBottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.closeRow}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={ICON_COLOR} />
            </TouchableOpacity>
          </View>
          <Pressable
            style={styles.profileRowCard}
            onPress={() => setShowAuthModal(true)}
          >
              <View style={styles.avatarRing}>
                <LinearGradient colors={ACCENT_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: (AVATAR_SIZE + 4) / 2 }]} />
                <View style={styles.avatar}>
                  <Text style={styles.avatarPlaceholder}>?</Text>
                </View>
              </View>
              <View style={styles.profileRowText}>
                <Text style={styles.profileRowMain}>Log in / Create account</Text>
                <Text style={styles.profileRowSub}>Sign in to sync your data across devices</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ICON_COLOR} />
            </Pressable>

            <AuthModal
              visible={showAuthModal}
              onClose={() => setShowAuthModal(false)}
              onSignUp={noOpAuth}
              onSignIn={noOpAuth}
            />

            <SectionHeader label="Invite Friends" />
            <Pressable style={styles.inviteCard}>
              <View style={[styles.row, styles.referRow]}>
                <View style={styles.referIconWrap}>
                  <Ionicons name="person-add-outline" size={ICON_SIZE} color={ACCENT_GOLD} />
                </View>
                <View style={[styles.rowTextWrap, styles.referRowText]}>
                  <Text style={styles.rowLabel}>Refer a friend and earn $10</Text>
                  <Text style={styles.rowSubtitle}>Earn $10 per friend that signs up with your promo code.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ICON_COLOR} />
              </View>
            </Pressable>

            <SectionHeader label="Account" />
            <Card>
              <Row icon="card-outline" label="Personal Details" last={false} onPress={() => {}} />
              <Row icon="settings-outline" label="Preferences" last={false} onPress={onPreferencesPress} />
              <Row icon="language-outline" label="Language" last={false} onPress={() => {}} />
              <Row icon="people-outline" label="Upgrade to Family Plan" last onPress={() => {}} />
            </Card>

            <SectionHeader label="Goals & Tracking" />
            <Card>
              <Row icon="heart-outline" label="Apple Health" rightText="✓ Connected" last={false} onPress={() => {}} />
              <Row icon="locate-outline" label="Edit Nutrition Goals" last={false} onPress={() => {}} />
              <Row icon="chatbox-outline" label="Goals & current weight" last={false} onPress={() => {}} />
              <Row icon="notifications-outline" label="Tracking Reminders" last={false} onPress={() => {}} />
              <Row icon="time-outline" label="Weight History" last={false} onPress={() => {}} />
              <Row icon="radio-button-on-outline" label="Ring Colors Explained" last onPress={() => {}} />
            </Card>

            <SectionHeader label="Support & Legal" />
            <Card>
              <Row icon="megaphone-outline" label="Request a Feature" last={false} onPress={() => {}} />
              <Row icon="mail-outline" label="Support Email" last={false} onPress={() => {}} />
              <Row icon="share-outline" label="Export PDF Summary Report" last={false} onPress={() => {}} />
              <Row icon="sync-outline" label="Sync Data" rightText="Last Synced: 2:41 PM" last={false} onPress={() => {}} />
              <Row icon="document-text-outline" label="Terms and Conditions" last={false} onPress={() => {}} />
              <Row icon="shield-checkmark-outline" label="Privacy Policy" last onPress={() => {}} />
            </Card>

            <SectionHeader label="Follow Us" />
            <Card>
              <Row icon="logo-instagram" label="Instagram" last={false} onPress={() => {}} />
              <Row icon="logo-tiktok" label="TikTok" last={false} onPress={() => {}} />
              <Row icon="close" label="X" last onPress={() => {}} />
            </Card>

            <SectionHeader label="Account Actions" />
            <Card>
              <Row icon="person-remove-outline" label="Delete Account" last onPress={() => {}} />
            </Card>

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tintOverlay: {
    backgroundColor: 'rgba(47, 48, 49, 0.5)',
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheetOverflow: {
    overflow: 'visible',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  scroll: {
    flex: 1,
    overflow: 'visible',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(40,40,40,1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  profileRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 18,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: AVATAR_SIZE + 4 + Spacing.md * 2, // avatar ring (60px) + vertical padding
    marginBottom: Spacing.lg,
  },
  avatarRing: {
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    fontSize: 24,
    color: Colors.primaryLight,
  },
  profileRowText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileRowMain: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  profileRowSub: {
    fontSize: 13,
    color: ICON_COLOR,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  inviteCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  referRow: {
    height: undefined,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: Spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowIcon: {
    marginRight: Spacing.md,
  },
  rowTextWrap: {
    flex: 1,
  },
  referRowText: {
    flex: 1,
  },
  referIconWrap: {
    width: ICON_SIZE + 4,
    height: ICON_SIZE + 4,
    marginRight: Spacing.md,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  rowSubtitle: {
    fontSize: 13,
    color: ICON_COLOR,
    marginTop: 2,
  },
  rowRight: {
    fontSize: 13,
    color: ICON_COLOR,
    marginLeft: Spacing.sm,
  },
});
