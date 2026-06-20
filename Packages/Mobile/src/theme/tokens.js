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
// Light Theme (Wave 3 — Restaurant + brand-web parity)
// ─────────────────────────────────────────────────────────────────────────────
// Yellow + white palette confirmed with chat. Imported explicitly by
// restaurant-related screens in Wave 4; non-restaurant follower surfaces
// continue to use darkColors. Token names mirror the brand-web Tailwind
// tokens (yellow / ink / paper / line) so designers/devs can switch
// between web and mobile without re-mapping.

export const lightColors = {
  // Backgrounds
  bg:         '#FAFAFA',
  paper:      '#FFFFFF',
  surface:    '#F4F4F5',
  surface2:   '#E4E4E7',

  // Text / ink ladder
  ink:        '#0A0A0A',
  ink2:       '#18181B',
  muted:      '#52525B',
  muted2:     '#71717A',
  muted3:     '#A1A1AA',

  // Borders
  border:     '#E4E4E7',
  border2:    '#D4D4D8',

  // Primary — Yellow. Text on yellow = ink (per spec).
  yellow:      '#EAB308',
  yellowDeep:  '#CA8A04',
  yellowLight: '#FACC15',
  yellow50:    '#FEFCE8',
  yellow100:   '#FEF9C3',
  yellow200:   '#FEF08A',

  // Status
  success:    '#00B894',
  success50:  '#ECFDF5',
  success100: '#D1FAE5',
  warning:    '#FFB800',
  warning50:  '#FFFBEB',
  warning100: '#FEF3C7',
  danger:     '#E8401A',
  danger50:   '#FDEEE9',

  white:      '#FFFFFF',
  black:      '#000000',
};

// ─────────────────────────────────────────────────────────────────────────────
// Brand Palette (Wave 2 — brand-web → mobile-brand parity)
// ─────────────────────────────────────────────────────────────────────────────
// Locked 8-hex spec adopted across the 17 brand-web redesign flows shipped
// 2026-04 → 2026-05-25. Mobile-brand bucket (Flows 18+) consumes this export
// directly. Kept separate from `lightColors` so the 24 Wave-3 follower /
// restaurant screens that already consume `lightColors` see zero visual
// change (notable: `lightColors.yellow = #EAB308` vs brandPalette.yellow =
// #FFC107 — different shades by design).

export const brandPalette = {
  // Surfaces
  white:        '#FFFFFF',
  bg:           '#FAFAFA',
  bg2:          '#F4F4F5',

  // Yellow ladder
  yellow:       '#FFC107',
  yellowHover:  '#E0A800',
  yellowPale:   '#FFF7CC',
  yellow50:     '#FFFDEB',
  yellowText:   '#6B5A00',

  // Ink + muted ladder
  ink:          '#0A0A0A',
  ink2:         '#1F1F22',
  muted:        '#52525B',
  muted2:       '#71717A',
  muted3:       '#A1A1AA',
  muted4:       '#D4D4D8',

  // Borders
  border:       '#E4E4E7',
  borderSoft:   '#F4F4F5',

  // Status pales (per Flow 15 brand-web pattern)
  success:      '#10B981',
  successPale:  '#D1FAE5',
  successText:  '#047857',
  danger:       '#E8401A',
  dangerPale:   '#FDEEE9',
  dangerText:   '#B91C1C',
  conv:         '#7E22CE',
  convPale:     '#F3E8FF',
  eng:          '#0E7490',
  engPale:      '#CFFAFE',
  hyb:          '#6B5A00',
  hybPale:      '#FFF7CC',
  info:         '#1D4ED8',
  infoPale:     '#DBEAFE',
};

// ─────────────────────────────────────────────────────────────────────────────
// Creator Vibe palette (Flow 52 — follower re-theme: cream + terracotta)
// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWER-SCOPED. Overrides the F0 yellow `brandPalette` for the follower app
// only. brandPalette / lightColors / darkColors are intentionally left intact so
// brand-web + mobile-brand (and any non-migrated follower screen) see zero change.
// Hex values mirror the locked Creator Vibe mockup
// (features/redesign-flow-52-follower-creator-vibe/04-preview/mockups/all-screens.html).

export const creatorVibe = {
  // Surfaces — white canvas + cream accents (Phase 5 INFLX gold/cream re-skin).
  screenBg:  '#F7F4EC',  // warm near-white app background
  card:      '#FFFFFF',
  soft:      '#FBF1D9',  // cream — info/chip/thumbnail tint
  soft2:     '#F5EAD3',

  // Primary — GOLD (CTAs, active states). Per the locked mockup, text on gold = INK.
  // (Key name kept as `brown` to avoid touching 150+ call sites; value is now gold.)
  brown:     '#F6B11E',
  brownDark: '#E8A200',

  // Ink + muted ladder
  ink:       '#1A1A1A',
  muted:     '#6B6B6B',
  line:      '#EBE3D2',

  // Accents
  gold:      '#F6B11E',  // explicit alias for new gold-accent usages
  goldDeep:  '#E8A200',
  cream:     '#FBEFD0',
  onGold:    '#1A1A1A',  // text/icon color to use ON a gold background
  offer:     '#D9663C',  // sale / discount — terracotta (reserved accent)
  star:      '#F2A93B',  // ratings
  verify:    '#2D9CDB',  // verified tick
  ring1:     '#F6B11E',  // creator-story gradient start (gold)
  ring2:     '#FAD27A',  // creator-story gradient end (light gold)

  white:     '#FFFFFF',
  black:     '#000000',
};

// ─────────────────────────────────────────────────────────────────────────────
// Toing palette (Follower v2 redesign — white canvas + yellow accent)
// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWER-V2-SCOPED. The from-scratch follower redesign moves OFF the gold+cream
// `creatorVibe` theme (screenBg #F7F4EC) ONTO a pure-white canvas with a rationed
// yellow accent + pink secondary. Locked with the founder in chat 2026-06-20
// (contract: features/follower-location-redesign/). creatorVibe / lightColors /
// brandPalette are intentionally left intact so every non-migrated follower
// screen + the brand/influencer apps see ZERO change — v2 screens import `toing`
// explicitly, behind the follower-v2 flag.
//
// THE ONE RULE: text on yellow = INK (never white — white vanishes on yellow).
// `yellowDeep` is the readable yellow for icons/outlines/text ON white;
// bright `yellow` is for fills (with ink text on top).

export const toing = {
  // Canvas — white-first, colour rationed
  pageBg:     '#F4F5F7',
  card:       '#FFFFFF',
  line:       '#E8EAED',

  // Ink ladder
  ink:        '#1A1D1F',
  muted:      '#6B7280',
  hint:       '#9CA3AF',

  // Brand — yellow primary (fills), ink text on top, deep-gold for on-white accents
  yellow:     '#F5A623',
  yellowInk:  '#1A1D1F',  // text/icon colour to use ON a yellow fill
  yellowDeep: '#C77A00',  // readable yellow for icons / outlines / text ON white
  yellowTint: '#FFF6E0',  // soft yellow background (chips / strips)

  // Accent — pink (offers, savings, secondary highlights)
  pink:       '#E11D6B',
  pinkDark:   '#A1124B',
  pinkTint:   '#FCE7F0',

  // Per-business accents (atmosphere only — never on Pay/ADD)
  vFood:      '#F5A623',
  vFashion:   '#E11D6B',
  vFurniture: '#92400E',
  vBeauty:    '#7C3AED',
  vCars:      '#1D4ED8',

  // Semantic — green stays for veg/success, warning is orange (≠ brand yellow)
  veg:        '#15803D',
  nonVeg:     '#B91C1C',
  egg:        '#CA8A04',
  success:    '#15803D',
  successTint:'#E6F6EC',
  warning:    '#EA580C',
  danger:     '#DC2626',
  offer:      '#E11D6B',

  white:      '#FFFFFF',
  black:      '#000000',
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-Business Accent Colors
// ─────────────────────────────────────────────────────────────────────────────

export const businessAccents = {
  restaurant:      { accent: '#ef4444', dim: 'rgba(239,68,68,0.08)',  icon: '🍽️' },
  bakery:          { accent: '#f97316', dim: 'rgba(249,115,22,0.1)',  icon: '🎂' },
  // Fashion-1: unified fashion category. Pink/magenta accent ties to the
  // creator-vibe pitch (salon/beauty/lifestyle creators); the schema picks
  // walkin_pay + online_order based on the brand's offers_online_delivery flag.
  fashion:         { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '👗' },
  // Legacy aliases retained — brands still rolling out under the old keys
  // will continue to theme correctly until they migrate to `fashion`.
  fashion_walkin:  { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '👗' },
  fashion_online:  { accent: '#ec4899', dim: 'rgba(236,72,153,0.1)', icon: '🛍️' },
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
// Follower light-theme per-business accents (Wave 3 — Flow 38 / Phase F0)
// ─────────────────────────────────────────────────────────────────────────────
// The follower app flips from dark (Wave-3 darkColors) to LIGHT brandPalette.
// Per-business accents are now RESTRAINED — used ONLY for wayfinding (category
// tiles, card hero tints, store hero), never on chrome / text / CTAs (those
// are always ink + yellow per brandPalette). `pale` is the tint used for hero
// backgrounds; `accent` is reserved for the rare in-content emphasis. The 4
// focus verticals get distinct hues; everything else falls back to the brand
// yellow family. Additive — `businessAccents` (dark) stays for any follower
// screen not yet migrated to light.

export const businessAccentsLight = {
  // 🍽️ Eat (restaurant family) — warm red
  restaurant:      { accent: '#E8401A', pale: '#FDEEE9', icon: '🍽️' },
  bakery:          { accent: '#E8401A', pale: '#FDEEE9', icon: '🧁' },
  // 👗 Fashion — pink
  fashion:         { accent: '#DB2777', pale: '#FCE7F3', icon: '👗' },
  fashion_walkin:  { accent: '#DB2777', pale: '#FCE7F3', icon: '👗' },
  fashion_online:  { accent: '#DB2777', pale: '#FCE7F3', icon: '👕' },
  footwear:        { accent: '#DB2777', pale: '#FCE7F3', icon: '👟' },
  jewellery:       { accent: '#DB2777', pale: '#FCE7F3', icon: '💎' },
  // 💇 Beauty (salon family) — purple
  salon:           { accent: '#7E22CE', pale: '#F3E8FF', icon: '💇' },
  beauty:          { accent: '#7E22CE', pale: '#F3E8FF', icon: '💄' },
  home_beauty:     { accent: '#7E22CE', pale: '#F3E8FF', icon: '💅' },
  // 🚗 Car rental — blue
  car_rental:      { accent: '#1D4ED8', pale: '#DBEAFE', icon: '🚗' },
  bike_rental:     { accent: '#1D4ED8', pale: '#DBEAFE', icon: '🏍️' },
};

// Returns { accent, pale, icon } in the light scheme; falls back to the
// brand yellow family for the 26 deferred businesses.
export function getBusinessAccentLight(categoryKey) {
  return businessAccentsLight[categoryKey]
    || { accent: brandPalette.yellowText, pale: brandPalette.yellowPale, icon: '🏪' };
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

  // ─── Wave 3: Outfit (display) + Plus Jakarta Sans (body) + JetBrains Mono ───
  // Used by restaurant-related screens via the lightColors palette. Each
  // family is registered as a separate Platform.select so we never collide
  // with the existing Syne / DM Sans loaders.

  // Outfit — display font (headlines, score numbers, brand names)
  displayBold: Platform.select({
    ios: 'Outfit-Bold',
    android: 'Outfit-Bold',
    default: 'System',
  }),
  displayBlack: Platform.select({
    ios: 'Outfit-ExtraBold',
    android: 'Outfit-ExtraBold',
    default: 'System',
  }),

  // Plus Jakarta Sans — body font (default text)
  sansRegular: Platform.select({
    ios: 'PlusJakartaSans-Regular',
    android: 'PlusJakartaSans-Regular',
    default: 'System',
  }),
  sansMedium: Platform.select({
    ios: 'PlusJakartaSans-Medium',
    android: 'PlusJakartaSans-Medium',
    default: 'System',
  }),
  sansSemiBold: Platform.select({
    ios: 'PlusJakartaSans-SemiBold',
    android: 'PlusJakartaSans-SemiBold',
    default: 'System',
  }),
  sansBold: Platform.select({
    ios: 'PlusJakartaSans-Bold',
    android: 'PlusJakartaSans-Bold',
    default: 'System',
  }),

  // JetBrains Mono — IDs, prices, meta labels
  monoMedium: Platform.select({
    ios: 'JetBrainsMono-Medium',
    android: 'JetBrainsMono-Medium',
    default: 'monospace',
  }),
  monoBold: Platform.select({
    ios: 'JetBrainsMono-Bold',
    android: 'JetBrainsMono-Bold',
    default: 'monospace',
  }),

  // ─── Flow 52 (Creator Vibe): serif display headings ───
  // D1 = OTA-safe fallback: use a system serif now (no native font asset → ships
  // via OTA). Swap these to 'Fraunces-*' in a later native APK build (52.x) once
  // the .ttf is bundled + react-native-asset re-linked. Apply fontWeight in the
  // style (system serif has no separate bold family name on Android).
  serifDisplay: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
};
