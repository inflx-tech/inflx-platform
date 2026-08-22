import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ig } from '../theme/ig';

/**
 * CreatorAvatar — one creator, one face, everywhere.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * Used by search results, the creator profile, conversations, group members and the
 * agreed list. Before this, each screen drew its own initial block in its own way, so the
 * same person looked different depending on which screen you were on.
 *
 * THE RULE, from the founder 2026-08-22: only a picture the creator UPLOADED is ever
 * shown. The scraped Instagram picture is deliberately NOT used — a brand looking at a
 * creator should see what she chose to show, not what we took from her Instagram.
 *
 * So her uploaded `profile_image_url` is the only source. No upload means no picture, and she gets her
 * initials in a colour derived from her name — stable, so the same person is the same
 * colour on every screen and in every session. That is the honest empty state; a stock
 * silhouette would just be a picture nobody chose.
 */

// Muted enough to sit behind black text without competing with the yellow/blue/green
// that carry meaning elsewhere in this kit.
const TONES = [
  { bg: '#EDE7E0', fg: '#6B5B4B' },
  { bg: '#E4ECF6', fg: '#3B5A80' },
  { bg: '#E7F1EA', fg: '#2F6B4F' },
  { bg: '#F3E9F5', fg: '#6A4A72' },
  { bg: '#FAEDE3', fg: '#8A5A3B' },
];

/** Same name → same colour, on every screen and every launch. */
function toneFor(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return TONES[Math.abs(h) % TONES.length];
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CreatorAvatar({
  name,
  // Only ever the creator's own upload. Passing the scraped picture here is a bug.
  avatarUrl,
  size = 40,
  square = false,
  style,
}) {
  const radius = square ? Math.round(size * 0.28) : size / 2;
  const tone = toneFor(name);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[{ width: size, height: size, borderRadius: radius, backgroundColor: ig.lineSoft }, style]}
      />
    );
  }

  return (
    <View
      style={[
        s.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: tone.bg },
        style,
      ]}
    >
      <Text style={{ fontSize: Math.round(size * 0.36), fontWeight: '800', color: tone.fg }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
