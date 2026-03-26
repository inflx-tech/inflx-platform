// INFLX Design Tokens — extracted from all mockup files
// Source: File 01-08 HTML mockups

export const colors = {
  // Navy family
  navy: '#1B2D5E',
  navyDeep: '#111E42',
  navyMid: '#243672',
  navyLight: '#2E4494',
  navyPale: '#EEF1FB',

  // Orange family
  orange: '#F47920',
  orangeDeep: '#D4601A',
  orangeLight: '#FF9240',
  orangePale: '#FEF0E4',

  // Gold family
  gold: '#FFB800',
  goldDeep: '#E0A000',
  goldPale: '#FFF8E1',

  // Teal family
  teal: '#00B894',
  tealDeep: '#007A63',
  tealPale: '#E0FAF5',

  // Red family
  red: '#E8401A',
  redPale: '#FDEEE9',

  // Purple family
  purple: '#7F77DD',
  purplePale: '#EEEDFE',

  // Background / Surface
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surface2: '#F2F4F9',
  surface3: '#E8EBF4',

  // Borders
  border: '#E0E4EF',
  border2: '#C8CEDF',

  // Text
  t1: '#0D1630',
  t2: '#4A5278',
  t3: '#8B91AD',

  // Semantic
  success: '#00B894',
  warning: '#FFB800',
  error: '#E8401A',
  info: '#7F77DD',

  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const fontFamily = {
  display: 'Outfit',
  body: 'Plus Jakarta Sans',
};

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 14,
  xl: 16,
  '2xl': 18,
  '3xl': 20,
  '4xl': 22,
  '5xl': 26,
  '6xl': 32,
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const shadow = {
  sm: {
    shadowColor: '#1B2D5E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#1B2D5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1B2D5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Status badge configs — maps status string to color config
export const statusColors = {
  // Campaign statuses
  draft:           { bg: colors.surface2,    text: colors.t2,       border: colors.border },
  pending_wallet:  { bg: colors.goldPale,    text: '#7A5500',       border: 'rgba(255,184,0,0.2)' },
  published:       { bg: colors.navyPale,    text: colors.navy,     border: 'rgba(27,45,94,0.15)' },
  active:          { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },
  live:            { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },
  completed:       { bg: colors.navyPale,    text: colors.navy,     border: 'rgba(27,45,94,0.15)' },
  cancelled:       { bg: colors.redPale,     text: colors.red,      border: 'rgba(232,64,26,0.2)' },

  // Offer/CI statuses
  invited:         { bg: colors.goldPale,    text: '#7A5500',       border: 'rgba(255,184,0,0.2)' },
  accepted:        { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },
  negotiating:     { bg: colors.orangePale,  text: colors.orangeDeep, border: 'rgba(244,121,32,0.2)' },
  contracted:      { bg: colors.navyPale,    text: colors.navy,     border: 'rgba(27,45,94,0.15)' },
  declined:        { bg: colors.redPale,     text: colors.red,      border: 'rgba(232,64,26,0.2)' },
  expired:         { bg: colors.surface2,    text: colors.t3,       border: colors.border },

  // Deliverable statuses
  pending:         { bg: colors.goldPale,    text: '#7A5500',       border: 'rgba(255,184,0,0.2)' },
  submitted:       { bg: colors.navyPale,    text: colors.navy,     border: 'rgba(27,45,94,0.15)' },
  under_review:    { bg: colors.orangePale,  text: colors.orangeDeep, border: 'rgba(244,121,32,0.2)' },
  revision_requested: { bg: colors.redPale, text: colors.red,       border: 'rgba(232,64,26,0.2)' },
  approved:        { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },

  // User statuses
  'pending':       { bg: colors.goldPale,    text: '#7A5500',       border: 'rgba(255,184,0,0.2)' },
  'approved':      { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },
  'rejected':      { bg: colors.redPale,     text: colors.red,      border: 'rgba(232,64,26,0.2)' },
  'suspended':     { bg: colors.surface2,    text: colors.t3,       border: colors.border },

  // Escrow statuses
  queued:          { bg: colors.goldPale,    text: '#7A5500',       border: 'rgba(255,184,0,0.2)' },
  locked:          { bg: colors.navyPale,    text: colors.navy,     border: 'rgba(27,45,94,0.15)' },
  released:        { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },

  // Withdrawal statuses
  processing:      { bg: colors.orangePale,  text: colors.orangeDeep, border: 'rgba(244,121,32,0.2)' },
  failed:          { bg: colors.redPale,     text: colors.red,      border: 'rgba(232,64,26,0.2)' },

  // Order statuses
  confirmed:       { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },
  dispatched:      { bg: colors.navyPale,    text: colors.navy,     border: 'rgba(27,45,94,0.15)' },
  delivered:       { bg: colors.tealPale,    text: colors.tealDeep, border: 'rgba(0,184,148,0.2)' },
};

export default { colors, spacing, radius, fontFamily, fontSize, fontWeight, shadow, statusColors };
