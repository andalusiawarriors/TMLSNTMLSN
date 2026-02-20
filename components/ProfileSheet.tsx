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
import { Typography, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const ACCENT_GOLD = '#D4B896';
const ACCENT_GOLD_DARK = '#A8895E';
const ACCENT_GRADIENT: [string, string] = [ACCENT_GOLD, ACCENT_GOLD_DARK];

const TAB_BAR_HEIGHT = 76; // PILL_BOTTOM(19) + PILL_HEIGHT(57) from _layout
const ROW_HEIGHT = 56;
const ICON_SIZE = 22;
const AVATAR_SIZE = 56;

export type ProfileSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called when user taps Preferences — typically closes sheet and navigates to preferences */
  onPreferencesPress?: () => void;
};

function Row({
  icon,
  label,
  subtitle,
  rightText,
  onPress,
  last,
  iconColor,
  labelColor,
  rowBorderColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  last?: boolean;
  iconColor: string;
  labelColor: string;
  rowBorderColor?: string;
}) {
  const rowStyle = [styles.row, !last && [styles.rowBorder, rowBorderColor && { borderBottomColor: rowBorderColor }]];
  const children = (
    <>
      <Ionicons name={icon} size={ICON_SIZE} color={iconColor} style={styles.rowIcon} />
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: iconColor }]}>{subtitle}</Text> : null}
      </View>
      {rightText ? (
        <Text style={[styles.rowRight, { color: iconColor }]}>{rightText}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={iconColor} />
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

function Card({ children, bg, border }: { children: React.ReactNode; bg?: string; border?: string }) {
  return <View style={[styles.card, bg && { backgroundColor: bg }, border && { borderColor: border }]}>{children}</View>;
}

export function ProfileSheet({ visible, onClose, onPreferencesPress }: ProfileSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const isLight = theme === 'light';
  const cardBg = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(40,40,40,0.6)';
  const cardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
  const gradientStart = isLight ? '#C6C6C6' : '#2f3031';
  const gradientEnd = isLight ? '#B0B0B0' : '#1a1a1a';
  const iconColor = isLight ? colors.primaryLight + 'CC' : 'rgba(255,255,255,0.7)';
  const labelColor = isLight ? colors.primaryLight : colors.white;
  const closeBtnBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const closeBtnIcon = isLight ? colors.primaryLight : 'rgba(255,255,255,0.7)';
  const rowBorderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
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
                  <Stop offset="0" stopColor={gradientStart} />
                  <Stop offset="1" stopColor={gradientEnd} />
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
                  backgroundColor: closeBtnBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color={closeBtnIcon} />
              </TouchableOpacity>
              <Text style={[styles.profileTitle, { textAlign: 'center', color: labelColor }]}>profile</Text>
            </View>

            <Pressable style={[styles.profileRowCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.avatarRing}>
                <LinearGradient colors={ACCENT_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: (AVATAR_SIZE + 4) / 2 }]} />
                <View style={[styles.avatar, { backgroundColor: colors.primaryDark }]}>
                  <Text style={[styles.avatarPlaceholder, { color: colors.primaryLight }]}>?</Text>
                </View>
              </View>
              <View style={styles.profileRowText}>
                <Text style={[styles.profileRowMain, { color: labelColor }]}>Tap to set name</Text>
                <Text style={[styles.profileRowSub, { color: iconColor }]}>and username</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={iconColor} />
            </Pressable>

            <SectionHeader label="Invite Friends" />
            <Pressable style={[styles.inviteCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.row, styles.referRow]}>
                <MaskedView
                  style={styles.referIconWrap}
                  maskElement={<Ionicons name="person-add-outline" size={ICON_SIZE} color="black" />}
                >
                  <LinearGradient colors={ACCENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                </MaskedView>
                <View style={[styles.rowTextWrap, styles.referRowText]}>
                  <Text style={[styles.rowLabel, { color: labelColor }]}>Refer a friend and earn $10</Text>
                  <Text style={[styles.rowSubtitle, { color: iconColor }]}>Earn $10 per friend that signs up with your promo code.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={iconColor} />
              </View>
            </Pressable>

            <SectionHeader label="Account" />
            <Card bg={cardBg} border={cardBorder}>
              <Row icon="card-outline" label="Personal Details" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="settings-outline" label="Preferences" last={false} onPress={onPreferencesPress} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="language-outline" label="Language" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="people-outline" label="Upgrade to Family Plan" last onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
            </Card>

            <SectionHeader label="Goals & Tracking" />
            <Card bg={cardBg} border={cardBorder}>
              <Row icon="heart-outline" label="Apple Health" rightText="✓ Connected" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="locate-outline" label="Edit Nutrition Goals" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="chatbox-outline" label="Goals & current weight" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="notifications-outline" label="Tracking Reminders" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="time-outline" label="Weight History" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="radio-button-on-outline" label="Ring Colors Explained" last onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
            </Card>

            <SectionHeader label="Support & Legal" />
            <Card bg={cardBg} border={cardBorder}>
              <Row icon="megaphone-outline" label="Request a Feature" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="mail-outline" label="Support Email" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="share-outline" label="Export PDF Summary Report" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="sync-outline" label="Sync Data" rightText="Last Synced: 2:41 PM" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="document-text-outline" label="Terms and Conditions" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="shield-checkmark-outline" label="Privacy Policy" last onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
            </Card>

            <SectionHeader label="Follow Us" />
            <Card bg={cardBg} border={cardBorder}>
              <Row icon="logo-instagram" label="Instagram" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="logo-tiktok" label="TikTok" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="close" label="X" last onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
            </Card>

            <SectionHeader label="Account Actions" />
            <Card bg={cardBg} border={cardBorder}>
              <Row icon="log-out-outline" label="Logout" last={false} onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
              <Row icon="person-remove-outline" label="Delete Account" last onPress={() => {}} iconColor={iconColor} labelColor={labelColor} rowBorderColor={rowBorderColor} />
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
    marginBottom: Spacing.md,
  },
  profileRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    fontSize: 24,
  },
  profileRowText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileRowMain: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileRowSub: {
    fontSize: 13,
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
    backgroundColor: 'rgba(40,40,40,0.6)', // fallback, overridden by bg prop
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', // fallback, overridden by border prop
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  inviteCard: {
    borderWidth: 1,
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
    borderBottomColor: 'rgba(128,128,128,0.3)', // fallback, Row uses inline override
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
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rowRight: {
    fontSize: 13,
    marginLeft: Spacing.sm,
  },
});
