// ─────────────────────────────────────────────────────────────────────────────
// Liquid Glass Design Tokens — single source of truth
//
// All pill/segmented/scrub components pull from here.
// Cards use GLASS_RADIUS_CARD; pills use GLASS_RADIUS_PILL.
// ─────────────────────────────────────────────────────────────────────────────

export const GLASS_RADIUS_PILL = 18;
export const GLASS_RADIUS_CARD = 38;

export const PILL_HEIGHT = 36;
export const PILL_INSET = 3;

export const LG = {
  // Track / container
  fill:         'rgba(47,48,49,0.26)',
  fillHover:    'rgba(47,48,49,0.18)',
  bg:           'rgba(47,48,49,0.22)',
  bgActive:     'rgba(198,198,198,0.12)',

  // Borders
  border:       'rgba(198,198,198,0.18)',
  borderHi:     'rgba(255,255,255,0.08)',
  borderSel:    'rgba(198,198,198,0.36)',
  borderBright: 'rgba(255,255,255,0.22)',

  // Selected pill indicator
  selPill:      'rgba(198,198,198,0.92)',
  selPillDark:  'rgba(47,48,49,0.18)',

  // Lens (long-press scrub bubble)
  lensFill:     'rgba(198,198,198,0.12)',
  lensBorder:   'rgba(198,198,198,0.40)',

  // Text
  text:         'rgba(198,198,198,0.78)',
  textFull:     '#C6C6C6',
  textActive:   'rgba(198,198,198,0.95)',
  textDim:      'rgba(198,198,198,0.50)',
  textDark:     '#2F3031',

  // Specular / frost gradients
  specDiag:     ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent'] as const,
  specTop:      ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.04)', 'transparent'] as const,
  specFrost:    ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.00)'] as const,
  depthBottom:  ['transparent', 'rgba(0,0,0,0.16)'] as const,

  // Selected pill gradients
  selSpecTop:   ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.12)', 'transparent'] as const,
  selDepth:     ['transparent', 'rgba(0,0,0,0.08)'] as const,

  // Lens gradients
  lensSpec:     ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.10)', 'transparent'] as const,

  // Press lens blob
  lensBlob:     ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.00)'] as const,

  // Interactive specular (press feedback)
  pressSpec:    ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.08)', 'transparent'] as const,
} as const;

// Spring presets — iOS 26 "bubbly but controlled"
export const SP = {
  slide:  { damping: 18, stiffness: 280, mass: 0.7 },
  lens:   { damping: 14, stiffness: 440, mass: 0.22 },
  press:  { damping: 16, stiffness: 420, mass: 0.35 },
  pulse:  { damping: 12, stiffness: 380, mass: 0.4 },
  bounce: { damping: 14, stiffness: 360, mass: 0.35 },
} as const;

export const LONG_PRESS_MS = 280;

// Shadow preset for glass pills
export const GLASS_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.22,
  shadowRadius: 10,
  elevation: 6,
} as const;

// Blur intensities
export const BLUR = {
  track: 28,
  lens: 40,
} as const;
