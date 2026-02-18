import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../constants/theme';

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
  return (
    <MaskedView
      maskElement={<Text style={[styles.sectionHeader, { backgroundColor: 'transparent' }]}>{label}</Text>}
    >
      <LinearGradient colors={ACCENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[styles.sectionHeader, { opacity: 0 }]}>{label}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function ProfileSheet({ visible, onClose }: ProfileSheetProps) {
  const insets = useSafeAreaInsets();
  // Padding so last items can scroll above the tab bar (which sits on top)
  const scrollBottomPad = TAB_BAR_HEIGHT + insets.bottom;

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]} pointerEvents="box-none">
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { paddingTop: insets.top, paddingBottom: Spacing.md }]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="profileBgGrad" cx="0%" cy="0%" r="150%" fx="0%" fy="0%">
                  <Stop offset="0" stopColor="#2f3031" />
                  <Stop offset="1" stopColor="#1a1a1a" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#profileBgGrad)" />
            </Svg>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
                position: 'relative',
              }}
            >
              <TouchableOpacity
                onPress={onClose}
                style={{
                  position: 'absolute',
                  left: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <Text style={[styles.profileTitle, { textAlign: 'center' }]}>profile</Text>
            </View>

            <Pressable style={styles.profileRowCard}>
              <View style={styles.avatarRing}>
                <LinearGradient colors={ACCENT_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: (AVATAR_SIZE + 4) / 2 }]} />
                <View style={styles.avatar}>
                  <Text style={styles.avatarPlaceholder}>?</Text>
                </View>
              </View>
              <View style={styles.profileRowText}>
                <Text style={styles.profileRowMain}>Tap to set name</Text>
                <Text style={styles.profileRowSub}>and username</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ICON_COLOR} />
            </Pressable>

            <SectionHeader label="Invite Friends" />
            <Pressable style={styles.card}>
              <View style={[styles.row, styles.rowBorder]}>
                <MaskedView
                  style={styles.referIconWrap}
                  maskElement={<Ionicons name="person-add-outline" size={ICON_SIZE} color="black" />}
                >
                  <LinearGradient colors={ACCENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                </MaskedView>
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
              <Row icon="settings-outline" label="Preferences" last={false} onPress={() => {}} />
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
              <Row icon="log-out-outline" label="Logout" last={false} onPress={() => {}} />
              <Row icon="person-remove-outline" label="Delete Account" last onPress={() => {}} />
            </Card>

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
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
