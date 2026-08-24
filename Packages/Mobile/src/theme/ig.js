/* ════════════════════════════════════════════════════════════════════════
   Instagram-clean design tokens — the shared RN kit introduced by
   features/collabs-list and reused by every later influencer + brand-mobile
   screen in the IA redesign program.

   White surfaces, black text, hairline dividers. Colour is spent only where it
   carries meaning: amber = your turn · blue = waiting on brand ·
   purple = negotiating · green = done/live · red = closed.

   De-yellow pass: the "your turn" signal used to be brand yellow (#FFC107),
   which read as decoration rather than state. It is now amber — same role,
   same token names (y / yInk / yBg), no brand colour. Primary CTAs are ink
   with white labels; they never take the signal colour.
   ════════════════════════════════════════════════════════════════════════ */
export const ig = {
  bg:       '#FFFFFF',
  bgSoft:   '#FAFAFA',
  text:     '#0A0A0A',
  text2:    '#262626',
  mut:      '#8E8E8E',
  mut2:     '#B0B0B0',
  line:     '#DBDBDB',
  lineSoft: '#EFEFEF',

  y:        '#EA580C',  // your turn
  yInk:     '#C2410C',
  yBg:      '#FFF7ED',

  green:    '#1A7F52',
  greenBg:  '#EAF7F0',
  red:      '#C4321B',
  redBg:    '#FBEEEA',
  blue:     '#3B6FE0',
  blueBg:   '#EDF2FD',
  purple:   '#6D3FC4',
  purpleBg: '#F2ECFB',
};

// tone → { fg, dot } for status dots/pills.
export const IG_TONE = {
  you:     { fg: ig.yInk,   dot: ig.y },
  brand:   { fg: ig.blue,   dot: ig.blue },
  nego:    { fg: ig.purple, dot: ig.purple },
  done:    { fg: ig.green,  dot: ig.green },
  closed:  { fg: ig.red,    dot: ig.red },
  neutral: { fg: ig.mut,    dot: ig.mut2 },
};
