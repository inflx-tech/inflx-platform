import React from 'react';
import { colors } from '../theme/tokens.js';

export default function LoadingSpinner({ size = 24, color = colors.navy, style, className }) {
  if (typeof document !== 'undefined') {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}20`,
          borderTop: `2px solid ${color}`,
          borderRadius: '50%',
          animation: 'inflx-spin 0.6s linear infinite',
          ...style,
        }}
      />
    );
  }

  const { ActivityIndicator } = require('react-native');
  return <ActivityIndicator size={size > 30 ? 'large' : 'small'} color={color} style={style} />;
}
