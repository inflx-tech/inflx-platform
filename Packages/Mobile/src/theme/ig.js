/* ════════════════════════════════════════════════════════════════════════
   Instagram-clean design tokens — the shared RN kit introduced by
   features/collabs-list and reused by every later influencer + brand-mobile
   screen in the IA redesign program.

   White surfaces, black text, hairline dividers. Colour is spent only where it
   carries meaning: yellow = your turn · blue = waiting on brand ·
   purple = negotiating · green = done/live · red = closed.
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

  y:        '#FFC107',  // your turn
  yInk:     '#7A6200',
  yBg:      '#FFF6D6',

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
