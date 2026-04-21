export const colors = {
  navy: '#1B2D5E',
  navyDeep: '#111E42',
  navyMid: '#243672',
  navyPale: '#EEF1FB',
  orange: '#F47920',
  orangeDeep: '#D4601A',
  orangePale: '#FEF0E4',
  gold: '#FFB800',
  goldPale: '#FFF8E1',
  teal: '#00B894',
  tealDeep: '#007A63',
  tealPale: '#E0FAF5',
  red: '#E8401A',
  redPale: '#FDEEE9',
  purple: '#7F77DD',
  purplePale: '#EEEDFE',
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surface2: '#F2F4F9',
  border: '#E0E4EF',
  border2: '#C8CEDF',
  t1: '#0D1630',
  t2: '#4A5278',
  t3: '#8B91AD',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

/**
 * Format a rupee amount for display with Indian number grouping.
 *
 * Since migration 021 (paise→rupees), every monetary value in the
 * platform is stored and returned in rupees, so fmtMoney and fmtRupees
 * are identical. fmtMoney stays as an alias to avoid a 46-file rename
 * across web + 3 mobile apps. Prefer fmtRupees in new code.
 */
export function fmtRupees(rupees) {
  const rounded = Math.round(rupees || 0);
  const s = rounded.toString();
  // Indian number formatting: last 3 digits, then groups of 2
  const lastThree = s.length > 3 ? s.slice(-3) : s;
  const rest = s.length > 3 ? s.slice(0, s.length - 3) : '';
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (rest ? ',' : '') + lastThree;
  return `\u20B9${formatted}`;
}

// Legacy alias. Treat input as RUPEES now (not paise).
export const fmtMoney = fmtRupees;

export function fmtNum(n) {
  const num = Math.round(n || 0);
  const s = num.toString();
  const lastThree = s.length > 3 ? s.slice(-3) : s;
  const rest = s.length > 3 ? s.slice(0, s.length - 3) : '';
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (rest ? ',' : '') + lastThree;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dark Theme (Follower App Redesign)
// ─────────────────────────────────────────────────────────────────────────────

export const darkColors = {
  bg: '#070b16',
  bg2: '#0e1525',
  card: '#151d30',
  input: '#0a1020',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  border: 'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(245,158,11,0.25)',
  amber: '#f59e0b',
  amberDim: 'rgba(245,158,11,0.1)',
  green: '#10b981',
  greenDim: 'rgba(16,185,129,0.1)',
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.08)',
  blue: '#3b82f6',
  blueDim: 'rgba(59,130,246,0.08)',
  pink: '#ec4899',
  pinkDim: 'rgba(236,72,153,0.1)',
  teal: '#14b8a6',
  tealDim: 'rgba(20,184,166,0.1)',
  purple: '#8b5cf6',
  purpleDim: 'rgba(139,92,246,0.1)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.1)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-Business Accent Colors
// ─────────────────────────────────────────────────────────────────────────────

export const businessAccents = {
  restaurant:      { accent: '#ef4444', dim: 'rgba(239,68,68,0.08)',  icon: '🍽️' },
  bakery:          { accent: '#f97316', dim: 'rgba(249,115,22,0.1)',  icon: '🎂' },
  fashion_walkin:  { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '👗' },
  fashion_online:  { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '🛍️' },
  salon:           { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '💇' },
  car_rental:      { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '🚗' },
  packaged_food:   { accent: '#10b981', dim: 'rgba(16,185,129,0.1)', icon: '🛒' },
  florist:         { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '💐' },
  function_hall:   { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.1)', icon: '🏛️' },
  wedding_planner: { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '💍' },
  // Future categories
  gym_fitness:     { accent: '#3b82f6', dim: 'rgba(59,130,246,0.08)', icon: '💪' },
  travel_packages: { accent: '#14b8a6', dim: 'rgba(20,184,166,0.1)', icon: '✈️' },
  hotel_homestay:  { accent: '#14b8a6', dim: 'rgba(20,184,166,0.1)', icon: '🏨' },
  electronics:     { accent: '#3b82f6', dim: 'rgba(59,130,246,0.08)', icon: '📱' },
  jewellery:       { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '💎' },
  footwear:        { accent: '#ef4444', dim: 'rgba(239,68,68,0.08)', icon: '👟' },
  furniture:       { accent: '#10b981', dim: 'rgba(16,185,129,0.1)', icon: '🪴' },
  optical:         { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.1)', icon: '👓' },
  home_services:   { accent: '#10b981', dim: 'rgba(16,185,129,0.1)', icon: '🔧' },
  // Phase 3
  bike_rental:     { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '🏍️' },
  coworking_space: { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.1)', icon: '🏢' },
  // Phase 4
  clinic_doctor:   { accent: '#3b82f6', dim: 'rgba(59,130,246,0.08)', icon: '🏥' },
  dental_clinic:   { accent: '#3b82f6', dim: 'rgba(59,130,246,0.08)', icon: '🦷' },
  interior_design: { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.1)', icon: '🎨' },
  legal_ca:        { accent: '#6366f1', dim: 'rgba(99,102,241,0.1)',  icon: '⚖️' },
  photography:     { accent: '#f97316', dim: 'rgba(249,115,22,0.1)', icon: '📸' },
  pest_control:    { accent: '#10b981', dim: 'rgba(16,185,129,0.1)', icon: '🐛' },
  home_beauty:     { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '💅' },
  laundry:         { accent: '#3b82f6', dim: 'rgba(59,130,246,0.08)', icon: '👔' },
  diagnostic_lab:  { accent: '#3b82f6', dim: 'rgba(59,130,246,0.08)', icon: '🔬' },
  pet_grooming:    { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '🐾' },
  coaching_center: { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.1)', icon: '📚' },
  // Phase 5
  pet_shop:        { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '🐕' },
  flowers_gifting: { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '🌹' },
  grocery:         { accent: '#10b981', dim: 'rgba(16,185,129,0.1)', icon: '🛒' },
  hardware:        { accent: '#f97316', dim: 'rgba(249,115,22,0.1)', icon: '🔨' },
};

export function getBusinessAccent(categoryKey) {
  return businessAccents[categoryKey] || { accent: '#f59e0b', dim: 'rgba(245,158,11,0.1)', icon: '🏪' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Font families (Syne for headings, DM Sans for body)
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

export const fonts = {
  heading: Platform.select({
    ios: 'Syne-Bold',
    android: 'Syne-Bold',
    default: 'System',
  }),
  headingBlack: Platform.select({
    ios: 'Syne-ExtraBold',
    android: 'Syne-ExtraBold',
    default: 'System',
  }),
  body: Platform.select({
    ios: 'DMSans-Regular',
    android: 'DMSans-Regular',
    default: 'System',
  }),
  bodyMedium: Platform.select({
    ios: 'DMSans-Medium',
    android: 'DMSans-Medium',
    default: 'System',
  }),
  bodySemiBold: Platform.select({
    ios: 'DMSans-SemiBold',
    android: 'DMSans-SemiBold',
    default: 'System',
  }),
  bodyBold: Platform.select({
    ios: 'DMSans-Bold',
    android: 'DMSans-Bold',
    default: 'System',
  }),
};
