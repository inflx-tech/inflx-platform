/**
 * icons.js — monochrome vector icons for the post surfaces (design v3,
 * founder-locked board post-design-v3.html). The colourful emoji are gone:
 * pins and shop CTAs use a WHITE bag on a black circle; engagement uses
 * thin black outlines — the reference language, colour to colour.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** White bag in a black circle — the pin/CTA marker. */
export function BagCircle({ size = 22, bg = '#111' }) {
  const s = size * 0.55;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 12 12">
        <Path d="M3 4.3h6l-.5 5.4h-5z" fill="#FFF" />
        <Path d="M4.2 4.2a1.8 1.8 0 0 1 3.6 0" stroke="#FFF" strokeWidth="1.2" fill="none" />
      </Svg>
    </View>
  );
}

/** Black outline bag (no circle) — light CTAs like the white shop pill. */
export function BagOutline({ size = 15, color = '#111' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M3.6 5h8.8l-.8 8H4.4z" stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <Path d="M5.7 5a2.3 2.3 0 0 1 4.6 0" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const line = (color, w = 1.4) => ({ stroke: color, strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' });

export function HeartIcon({ size = 18, color = '#111', filled = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M8 13.6C4.6 11 2.5 8.8 2.5 6.4 2.5 4.6 3.9 3.3 5.6 3.3c1 0 2 .5 2.4 1.3.4-.8 1.4-1.3 2.4-1.3 1.7 0 3.1 1.3 3.1 3.1 0 2.4-2.1 4.6-5.5 7.2z"
        {...(filled ? { fill: color } : line(color))}
      />
    </Svg>
  );
}

export function CommentIcon({ size = 18, color = '#111' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M13.5 7.5c0 3-2.5 5.2-5.5 5.2-.7 0-1.4-.1-2-.3l-3 1 1-2.6c-.6-.9-1-2-1-3.3C3 4.5 5.2 2.3 8 2.3s5.5 2.2 5.5 5.2z" {...line(color)} />
    </Svg>
  );
}

export function ShareIcon({ size = 18, color = '#111' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M13.6 2.4 7.2 8.8M13.6 2.4 9.4 13.6 7.2 8.8 2.4 6.6z" {...line(color)} />
    </Svg>
  );
}

export function SaveIcon({ size = 18, color = '#111', filled = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M4 2.5h8v11l-4-3-4 3z" {...(filled ? { fill: color } : line(color))} />
    </Svg>
  );
}

/** Blue verified tick — renders ONLY for verified creators (never fake). */
export function VerifiedTick({ size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M8 1.5 9.9 3l2.4-.3.6 2.3 2.1 1.2-1 2.2 1 2.2-2.1 1.2-.6 2.3-2.4-.3L8 15.3 6.1 13.9l-2.4.3-.6-2.3L1 10.7l1-2.2-1-2.2L3.1 5l.6-2.3L6.1 3z" fill="#3897F0" />
      <Path d="M5.2 8.2 7 10l3.6-3.8" stroke="#FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
