// ============================================================
// TMLSN — Profile Tab (inline settings, not a modal overlay)
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing } from '../../../constants/theme';
import { AuthModal } from '../../../components/AuthModal';
import { useAuth } from '../../../context/AuthContext';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';
import {
  SettingsSectionHeader,
  SettingsCard,
  SettingsRow,
  SETTINGS_ICON_COLOR,
  SETTINGS_ROW_HEIGHT,
  SETTINGS_ICON_SIZE,
  SETTINGS_ACCENT_GOLD,
} from '../../../components/SettingsShared';

const ACCENT_GOLD_DARK = '#A8895E';
const ACCENT_GRADIENT: [string, string] = [SETTINGS_ACCENT_GOLD, ACCENT_GOLD_DARK];
const AVATAR_SIZE = 56;
const TAB_BAR_HEIGHT = 76;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, signUp, signIn, signOut, debugCreateTestUser } = useAuth();

  const handleLogOutPress = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const scrollBottomPad = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={styles.wrapper}>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.profileRowCard}
          onPress={user ? undefined : () => setShowAuthModal(true)}
        >
          <View style={styles.avatarRing}>
            <LinearGradient colors={ACCENT_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: (AVATAR_SIZE + 4) / 2 }]} />
            <View style={styles.avatar}>
              <Text style={styles.avatarPlaceholder}>{user ? (user.email?.[0] ?? '?').toUpperCase() : '?'}</Text>
            </View>
          </View>
          <View style={styles.profileRowText}>
            <Text style={styles.profileRowMain}>{user ? (user.email ?? 'Logged in') : 'Log in / Create account'}</Text>
            <Text style={styles.profileRowSub}>{user ? 'Signed in to sync your data' : 'Sign in to sync your data across devices'}</Text>
          </View>
          {user ? (
            <Pressable onPress={handleLogOutPress} style={({ pressed }) => [styles.logOutButton, pressed && { opacity: 0.8 }]}>
              <Text style={styles.logOutButtonText}>Log out</Text>
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={SETTINGS_ICON_COLOR} />
          )}
        </Pressable>

        <AuthModal
          visible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSignUp={signUp}
          onSignIn={signIn}
          onDebugTestSignup={debugCreateTestUser}
        />

        <SettingsSectionHeader label="Invite Friends" />
        <Pressable style={styles.inviteCard}>
          <View style={[styles.referRow, styles.referRowInner]}>
            <View style={styles.referIconWrap}>
              <Ionicons name="person-add-outline" size={SETTINGS_ICON_SIZE} color={SETTINGS_ACCENT_GOLD} />
            </View>
            <View style={[styles.rowTextWrap, styles.referRowText]}>
              <Text style={styles.rowLabel}>Refer a friend and earn $10</Text>
              <Text style={styles.rowSubtitle}>Earn $10 per friend that signs up with your promo code.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SETTINGS_ICON_COLOR} />
          </View>
        </Pressable>

        <SettingsSectionHeader label="Account" />
        <SettingsCard>
          <SettingsRow icon="card-outline" label="Personal Details" last={false} onPress={() => {}} />
          <SettingsRow icon="settings-outline" label="Settings" last={false} onPress={() => router.push('/preferences')} />
          <SettingsRow icon="language-outline" label="Language" last={false} onPress={() => {}} />
          <SettingsRow icon="people-outline" label="Upgrade to Family Plan" last onPress={() => {}} />
        </SettingsCard>

        <SettingsSectionHeader label="Training" />
        <SettingsCard>
          <SettingsRow icon="barbell-outline" label="Training System" last onPress={() => router.push('/training-settings')} />
        </SettingsCard>

        <SettingsSectionHeader label="Goals & Tracking" />
        <SettingsCard>
          <SettingsRow icon="heart-outline" label="Apple Health" rightText="✓ Connected" last={false} onPress={() => {}} />
          <SettingsRow icon="locate-outline" label="Edit Nutrition Goals" last={false} onPress={() => {}} />
          <SettingsRow icon="chatbox-outline" label="Goals & current weight" last={false} onPress={() => {}} />
          <SettingsRow icon="notifications-outline" label="Tracking Reminders" last={false} onPress={() => {}} />
          <SettingsRow icon="time-outline" label="Weight History" last={false} onPress={() => {}} />
          <SettingsRow icon="radio-button-on-outline" label="Ring Colors Explained" last onPress={() => {}} />
        </SettingsCard>

        <SettingsSectionHeader label="Support & Legal" />
        <SettingsCard>
          <SettingsRow icon="megaphone-outline" label="Request a Feature" last={false} onPress={() => {}} />
          <SettingsRow icon="mail-outline" label="Support Email" last={false} onPress={() => {}} />
          <SettingsRow icon="share-outline" label="Export PDF Summary Report" last={false} onPress={() => {}} />
          <SettingsRow icon="sync-outline" label="Sync Data" rightText="Last Synced: 2:41 PM" last={false} onPress={() => {}} />
          <SettingsRow icon="document-text-outline" label="Terms and Conditions" last={false} onPress={() => {}} />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy" last onPress={() => {}} />
        </SettingsCard>

        <SettingsSectionHeader label="Follow Us" />
        <SettingsCard>
          <SettingsRow icon="logo-instagram" label="Instagram" last={false} onPress={() => {}} />
          <SettingsRow icon="logo-tiktok" label="TikTok" last={false} onPress={() => {}} />
          <SettingsRow icon="close" label="X" last onPress={() => {}} />
        </SettingsCard>

        <SettingsSectionHeader label="Account Actions" />
        <SettingsCard>
          <SettingsRow icon="person-remove-outline" label="Delete Account" last onPress={() => {}} />
        </SettingsCard>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  profileRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40,40,40,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: AVATAR_SIZE + 4 + Spacing.md * 2,
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
    color: SETTINGS_ICON_COLOR,
    marginTop: 2,
  },
  inviteCard: {
    backgroundColor: 'rgba(40,40,40,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  referRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SETTINGS_ROW_HEIGHT,
    paddingHorizontal: 0,
  },
  referRowInner: {
    borderBottomWidth: 0,
  },
  rowTextWrap: {
    flex: 1,
  },
  referRowText: {
    flex: 1,
  },
  referIconWrap: {
    width: SETTINGS_ICON_SIZE + 4,
    height: SETTINGS_ICON_SIZE + 4,
    marginRight: Spacing.md,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  rowSubtitle: {
    fontSize: 13,
    color: SETTINGS_ICON_COLOR,
    marginTop: 2,
  },
  logOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,80,80,0.2)',
  },
  logOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b6b',
  },
});
