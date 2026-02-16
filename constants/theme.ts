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

export const Colors = {
  // Duo-tone Foundation
  primaryDark: '#2F3031',     // Primary backgrounds, cards, nav bars
  primaryDarkLighter: '#3D3E3F', // Lighter shade for tab bar pill
  primaryLight: '#C6C6C6',    // Primary text, disabled states, secondary backgrounds
  
  // Accent Colors (use sparingly)
  accentRed: '#FF0000',       // Critical alerts, error states, urgent triggers
  accentBlue: '#0000FF',      // Positive feedback, completion, success states
  
  // Neutral
  white: '#FFFFFF',           // Explicit highlights, high-priority headings
  black: '#000000',           // Pure black for extreme contrast when needed
};

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
