import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './Input';
import { Colors, Typography, Spacing } from '../constants/theme';

const ACCENT_GOLD = '#D4B896';
const CARD_BG = 'rgba(40,40,40,0.95)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';
const ICON_COLOR = 'rgba(255,255,255,0.7)';
const ROW_HEIGHT = 56;
const ICON_SIZE = 22;

export type AuthModalStep = 'choice' | 'create' | 'login';

export type AuthModalProps = {
  visible: boolean;
  onClose: () => void;
  onSignUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSignIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  onDebugTestSignup?: () => Promise<void>;
};

function SectionHeader({ label }: { label: string }) {
  return <Text style={[styles.sectionHeader, { color: ACCENT_GOLD }]}>{label}</Text>;
}

function AuthRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const rowStyle = [styles.row, !last && styles.rowBorder];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={ICON_SIZE} color={ACCENT_GOLD} style={styles.rowIcon} />
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ICON_COLOR} />
    </Pressable>
  );
}

export function AuthModal({ visible, onClose, onSignUp, onSignIn, onDebugTestSignup }: AuthModalProps) {
  const [step, setStep] = useState<AuthModalStep>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setStep('choice');
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error: err } = await onSignUp(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err.message || 'Sign up failed');
      return;
    }
    handleClose();
  };

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    const { error: err } = await onSignIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err.message || 'Log in failed');
      return;
    }
    handleClose();
  };

  const renderChoice = () => (
    <View style={styles.content}>
      <SectionHeader label="Account" />
      <View style={styles.card}>
        <AuthRow
          icon="person-add-outline"
          label="Create account"
          onPress={() => { setStep('create'); setError(null); }}
          last={false}
        />
        <AuthRow
          icon="log-in-outline"
          label="Log in"
          onPress={() => { setStep('login'); setError(null); }}
          last={!__DEV__ || !onDebugTestSignup}
        />
        {__DEV__ && onDebugTestSignup ? (
          <AuthRow icon="bug-outline" label="[TEMP DEBUG] Test signup" onPress={onDebugTestSignup} last />
        ) : null}
      </View>
    </View>
  );

  const renderCreate = () => (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.profileTitle, { textAlign: 'center' }]}>Create account</Text>
      <SectionHeader label="Create account" />
      <View style={styles.card}>
        <View style={styles.inputWrap}>
          <Input
            label="Email"
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.inputContainer}
          />
          <Input
            label="Password"
            placeholder="Min 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            containerStyle={styles.inputContainer}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primaryLight} style={styles.loader} />
        ) : (
          <Pressable
            style={({ pressed }) => [styles.submitRow, pressed && styles.rowPressed]}
            onPress={handleCreate}
          >
            <Ionicons name="person-add-outline" size={ICON_SIZE} color={ACCENT_GOLD} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Create account</Text>
          </Pressable>
        )}
        <Pressable onPress={() => { setStep('choice'); setError(null); }} style={styles.backRow}>
          <Ionicons name="arrow-back" size={ICON_SIZE} color={ICON_COLOR} style={styles.rowIcon} />
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  const renderLogin = () => (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.profileTitle, { textAlign: 'center' }]}>Log in</Text>
      <SectionHeader label="Log in" />
      <View style={styles.card}>
        <View style={styles.inputWrap}>
          <Input
            label="Email"
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.inputContainer}
          />
          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            containerStyle={styles.inputContainer}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primaryLight} style={styles.loader} />
        ) : (
          <Pressable
            style={({ pressed }) => [styles.submitRow, pressed && styles.rowPressed]}
            onPress={handleLogin}
          >
            <Ionicons name="log-in-outline" size={ICON_SIZE} color={ACCENT_GOLD} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Log in</Text>
          </Pressable>
        )}
        <Pressable onPress={() => { setStep('choice'); setError(null); }} style={styles.backRow}>
          <Ionicons name="arrow-back" size={ICON_SIZE} color={ICON_COLOR} style={styles.rowIcon} />
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.modalCard}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={ICON_COLOR} />
          </TouchableOpacity>
          {step === 'choice' && renderChoice()}
          {step === 'create' && renderCreate()}
          {step === 'login' && renderLogin()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(47, 48, 49, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: Spacing.lg,
    paddingTop: Spacing.xl + 8,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(40,40,40,1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  content: {
    width: '100%',
  },
  profileTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
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
    paddingVertical: Spacing.sm,
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
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  inputWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  inputContainer: {
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: Typography.label,
    color: Colors.accentRed,
    marginHorizontal: Spacing.md,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  loader: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  backLinkText: {
    fontSize: Typography.label,
    color: ICON_COLOR,
  },
});
