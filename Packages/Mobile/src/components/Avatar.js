import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../theme/tokens';

const AVATAR_COLORS = [
  { bg: colors.navyPale, text: colors.navy },
  { bg: colors.orangePale, text: colors.orangeDeep },
  { bg: colors.tealPale, text: colors.tealDeep },
  { bg: colors.goldPale, text: '#7A5500' },
  { bg: colors.purplePale, text: '#3C3489' },
];

function getColor(name) {
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function Avatar({ name = '', size = 40, style }) {
  const initials = (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const cfg = getColor(name);
  return (
    <View style={[{ width: size, height: size, borderRadius: size/2, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.33, fontWeight: '700', color: cfg.text }}>{initials}</Text>
    </View>
  );
}
