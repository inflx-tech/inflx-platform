import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Gradient — OTA-safe linear-gradient primitive (pure JS, zero native deps).
 *
 * Bare RN 0.73.6 has no react-native-linear-gradient / SVG / Expo, and the whole
 * follower rebuild ships via OTA (no APK), so a native gradient lib is off-limits.
 * This approximates a 2-stop linear gradient by stacking N absolutely-positioned
 * View slices, each a solid colour interpolated start→end. Children render above
 * the slices. Close at a glance; not a GPU gradient. (Precedent: Flow-52 D1 serif
 * OTA fallback.) Contract: features/follower-card-foundation/.
 *
 * Props:
 *   colors     [start, end] hex strings (#RGB or #RRGGBB). 1 colour → plain fill.
 *   direction  'vertical' (default) | 'horizontal' | 'diagonal' (≈ vertical v1)
 *   slices     band count (default 14)
 *   style      outer View style (borderRadius/height/etc.); clipped (overflow hidden)
 *   children   rendered above the gradient
 *
 * Defensive: missing/short `colors` → a plain View (never throws).
 */

function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a, b, t) {
  const c = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${c(a.r, b.r)},${c(a.g, b.g)},${c(a.b, b.b)})`;
}

export default function Gradient({ colors, direction = 'vertical', slices = 14, style, children }) {
  const list = (Array.isArray(colors) ? colors : [colors]).filter(Boolean);

  // 0–1 colours → plain fill (defensive; still honours `style`).
  if (list.length < 2) {
    return <View style={[style, list[0] ? { backgroundColor: list[0] } : null]}>{children}</View>;
  }

  const start = hexToRgb(list[0]);
  const end = hexToRgb(list[list.length - 1]);
  const horizontal = direction === 'horizontal';
  const n = Math.max(2, slices | 0);

  const bands = [];
  for (let i = 0; i < n; i++) {
    bands.push(
      <View
        key={i}
        style={[horizontal ? styles.band : styles.row, { backgroundColor: mix(start, end, i / (n - 1)) }]}
      />
    );
  }

  return (
    <View style={[styles.clip, style]}>
      <View style={[StyleSheet.absoluteFill, horizontal ? styles.rowWrap : styles.colWrap]} pointerEvents="none">
        {bands}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  colWrap: { flexDirection: 'column' },     // vertical gradient: bands stacked top→bottom
  rowWrap: { flexDirection: 'row' },        // horizontal gradient: bands left→right
  row: { flex: 1, width: '100%' },
  band: { flex: 1, height: '100%' },
});
