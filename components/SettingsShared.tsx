import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';

// Match Profile sheet design tokens
export const SETTINGS_CARD_BG = 'rgba(40,40,40,0.6)';
export const SETTINGS_CARD_BORDER = 'rgba(255,255,255,0.06)';
export const SETTINGS_ROW_HEIGHT = 56;
export const SETTINGS_ICON_SIZE = 22;
export const SETTINGS_ICON_COLOR = 'rgba(255,255,255,0.7)';
export const SETTINGS_ACCENT_GOLD = '#D4B896';

export function SettingsSectionHeader({ label }: { label: string }) {
  return (
    <Text style={[sharedStyles.sectionHeader, { color: SETTINGS_ACCENT_GOLD }]}>
      {label}
    </Text>
  );
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return <View style={sharedStyles.card}>{children}</View>;
}

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  rightText?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
};

function renderRowRight(
  right: React.ReactNode | undefined,
  rightText: string | undefined,
  onPress: (() => void) | undefined
): React.ReactNode {
  if (right != null) return right;
  if (rightText != null) return <Text style={sharedStyles.rowRight}>{rightText}</Text>;
  if (onPress) return <Ionicons name="chevron-forward" size={18} color={SETTINGS_ICON_COLOR} />;
  return null;
}

export function SettingsRow({
  icon,
  label,
  subtitle,
  rightText,
  right,
  onPress,
  last = false,
}: SettingsRowProps) {
  const rowStyle = [sharedStyles.row, !last && sharedStyles.rowBorder];
  const content = (
    <>
      <Ionicons name={icon} size={SETTINGS_ICON_SIZE} color={SETTINGS_ICON_COLOR} style={sharedStyles.rowIcon} />
      <View style={sharedStyles.rowTextWrap}>
        <Text style={sharedStyles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={sharedStyles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {renderRowRight(right, rightText, onPress)}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && sharedStyles.rowPressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

type SettingsToggleRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
};

export function SettingsToggleRow({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  last = false,
}: SettingsToggleRowProps) {
  const rowStyle = [sharedStyles.row, !last && sharedStyles.rowBorder];
  return (
    <View style={rowStyle}>
      <Ionicons name={icon} size={SETTINGS_ICON_SIZE} color={SETTINGS_ICON_COLOR} style={sharedStyles.rowIcon} />
      <View style={sharedStyles.rowTextWrap}>
        <Text style={sharedStyles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={sharedStyles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.4)', true: 'rgba(255,255,255,0.8)' }}
        thumbColor={value ? '#2F3031' : SETTINGS_ICON_COLOR}
      />
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: SETTINGS_CARD_BG,
    borderWidth: 1,
    borderColor: SETTINGS_CARD_BORDER,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SETTINGS_ROW_HEIGHT,
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
    color: '#FFFFFF',
  },
  rowSubtitle: {
    fontSize: 13,
    color: SETTINGS_ICON_COLOR,
    marginTop: 2,
  },
  rowRight: {
    fontSize: 13,
    color: SETTINGS_ICON_COLOR,
    marginLeft: Spacing.sm,
  },
});
