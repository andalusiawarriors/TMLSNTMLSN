// TMLSN Styling Constants based on PRD Styling Guidelines

// Font families – match home (nutrition) section
export const Font = {
  regular: 'EBGaramond_400Regular',
  medium: 'EBGaramond_500Medium',
  semiBold: 'EBGaramond_600SemiBold',
  bold: 'EBGaramond_700Bold',
  extraBold: 'EBGaramond_800ExtraBold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export const HeadingLetterSpacing = -1;

// Shared (same in both themes)
const accentGold = '#D4B896';
const accentGoldDark = '#A8895E';
const accentRed = '#FF0000';
const accentBlue = '#0000FF';
const white = '#FFFFFF';
const black = '#000000';

export type ColorPalette = {
  primaryDark: string;
  primaryDarkLighter: string;
  primaryLight: string;
  accentRed: string;
  accentBlue: string;
  accentGold: string;
  accentGoldDark: string;
  white: string;
  black: string;
  tabBarBorder: [string, string];
  tabBarFill: [string, string];
  tabBarSelectedPill: string;
  fabIconBg: string;
  backgroundGradient: [string, string];
  cardBorderGradient: [string, string];
  cardFillGradient: [string, string];
  cardIconTint: string;
  pillBorderGradient: [string, string];
  pillFillGradient: [string, string];
};

export const DarkPalette: ColorPalette = {
  primaryDark: '#2F3031',
  primaryDarkLighter: '#3D3E3F',
  primaryLight: '#C6C6C6',
  accentRed,
  accentBlue,
  accentGold,
  accentGoldDark,
  white,
  black,
  tabBarBorder: ['#4E4F50', '#4A4B4C'],
  tabBarFill: ['#363738', '#2E2F30'],
  tabBarSelectedPill: 'rgba(108, 108, 108, 0.6)',
  fabIconBg: '#2F3031',
  backgroundGradient: ['#2f3031', '#1a1a1a'],
  cardBorderGradient: ['#525354', '#48494A'],
  cardFillGradient: ['#363738', '#2E2F30'],
  cardIconTint: '#FFFFFF',
  pillBorderGradient: ['#4E4F50', '#4A4B4C'],
  pillFillGradient: ['#363738', '#2E2F30'],
};

export const Colors = DarkPalette;

export const Typography = {
  // Font Sizes
  h1: 32,           // Screen titles
  h2: 22,           // Section headers
  body: 17,         // General content
  dataValue: 20,    // Tracker values (calories, weight, etc.)
  label: 13,        // Labels, metadata
  promptText: 16,   // Prompt vault text
  
  // Font Weights
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const Shadows = {
  card: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  button: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  }
};
