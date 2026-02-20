import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing, Font } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const ACCENT_GOLD = '#D4B896';
const ACCENT_GOLD_DARK = '#A8895E';
const ACCENT_GRADIENT: [string, string] = [ACCENT_GOLD, ACCENT_GOLD_DARK];
const ROW_HEIGHT = 56;
const ICON_SIZE = 22;

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

function ThemeRow({
  icon,
  label,
  selected,
  onPress,
  last,
  iconColor,
  labelColor,
  rowBorderColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
  last: boolean;
  iconColor: string;
  labelColor: string;
  rowBorderColor: string;
}) {
  const rowStyle = [styles.row, !last && [styles.rowBorder, { borderBottomColor: rowBorderColor }]];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={ICON_SIZE} color={iconColor} style={styles.rowIcon} />
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark" size={20} color={iconColor} />
      ) : (
        <View style={{ width: 20 }} />
      )}
    </Pressable>
  );
}

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, colors, setTheme } = useTheme();
  const isLight = theme === 'light';
  const iconColor = isLight ? colors.primaryLight + 'CC' : 'rgba(255,255,255,0.7)';
  const labelColor = isLight ? colors.primaryLight : colors.white;
  const cardBg = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(40,40,40,0.6)';
  const cardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
  const rowBorderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const gradientStart = isLight ? '#C6C6C6' : '#2f3031';
  const gradientEnd = isLight ? '#B0B0B0' : '#1a1a1a';

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="prefsBgGrad" cx="0%" cy="0%" r="150%" fx="0%" fy="0%">
              <Stop offset="0" stopColor={gradientStart} />
              <Stop offset="1" stopColor={gradientEnd} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#prefsBgGrad)" />
        </Svg>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader label="Appearance" />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemeRow
            icon="moon"
            label="Dark"
            selected={theme === 'dark'}
            onPress={() => setTheme('dark')}
            last={false}
            iconColor={iconColor}
            labelColor={labelColor}
            rowBorderColor={rowBorderColor}
          />
          <ThemeRow
            icon="sunny"
            label="Light"
            selected={theme === 'light'}
            onPress={() => setTheme('light')}
            last
            iconColor={iconColor}
            labelColor={labelColor}
            rowBorderColor={rowBorderColor}
          />
        </View>
        <Text style={[styles.hint, { color: iconColor }]}>dark (default) or light — more options coming later</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  card: {
    borderWidth: 1,
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
    fontFamily: Font.monoMedium,
    fontSize: 16,
    letterSpacing: -0.5,
  },
  hint: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: 4,
  },
});
