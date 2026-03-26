import React from 'react';
import { colors } from '../theme/tokens.js';

const AVATAR_COLORS = [
  { bg: colors.navyPale, text: colors.navy },
  { bg: colors.orangePale, text: colors.orangeDeep },
  { bg: colors.tealPale, text: colors.tealDeep },
  { bg: colors.goldPale, text: '#7A5500' },
  { bg: colors.purplePale, text: '#3C3489' },
  { bg: colors.redPale, text: colors.red },
];

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function getColorFromName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Avatar({ name = '', size = 36, style, className }) {
  const initials = getInitials(name);
  const colorConfig = getColorFromName(name);

  if (typeof document !== 'undefined') {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: colorConfig.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.33,
          fontWeight: 700,
          color: colorConfig.text,
          flexShrink: 0,
          fontFamily: 'Outfit, sans-serif',
          ...style,
        }}
      >
        {initials}
      </div>
    );
  }

  // React Native
  const { View, Text } = require('react-native');
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colorConfig.bg,
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    }}>
      <Text style={{ fontSize: size * 0.33, fontWeight: '700', color: colorConfig.text }}>
        {initials}
      </Text>
    </View>
  );
}
