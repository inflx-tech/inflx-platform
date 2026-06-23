import React from 'react';
import { View, StyleSheet } from 'react-native';
import { brandPalette as lightColors } from '../../theme/tokens';
import { vegKind } from '../../utils/veg';

/**
 * VegDot — square Indian veg/non-veg indicator.
 *
 * Green-bordered square with green dot = veg. Red-bordered with red dot
 * = non-veg. Standard convention in Indian F&B UI; mandatory for
 * restaurant menu items.
 *
 * Props:
 *   veg — bool. true = veg, false = non-veg. Accepts the string
 *         "Veg"/"Non-Veg" too since several backend rows use that
 *         shape (legacy attributes_schema.veg_flag).
 *   size — number, default 12 (px square). Border is 1.5px regardless.
 */

export default function VegDot({ veg, size = 12 }) {
  const kind = vegKind(veg);
  // Unknown ('na'/unmarked) → neutral grey, never a false non-veg claim.
  const color = kind === 'veg' ? lightColors.success
    : kind === 'nonveg' ? lightColors.danger
    : '#9CA3AF';
  const dotSize = Math.max(4, Math.floor(size * 0.45));

  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderColor: color,
        },
      ]}
    >
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
