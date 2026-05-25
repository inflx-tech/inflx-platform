import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';

/**
 * <ScreenHeader title sub back onBack count countLabel />
 *
 * Ink topbar component. Single source of truth for brand-mobile screens
 * (Flow 21+). Replaces inline ink-topbar markup in Flows 18-20 (deferred
 * retroactive migration).
 *
 * Props:
 *   - title:      string (Outfit-Bold 22 white)
 *   - sub:        optional string (PJS Medium 11 muted-white)
 *   - back:       optional bool — render "‹ Back" link above title
 *   - onBack:     optional callback for back tap
 *   - count:      optional number — render count chip on right
 *   - countLabel: optional string for count suffix (default: '')
 *
 * Variants (5):
 *   1. title only
 *   2. title + sub
 *   3. title + back + (optional sub)
 *   4. title + count
 *   5. title + back + count
 */

export default function ScreenHeader({ title, sub, back, onBack, count, countLabel }) {
  return (
    <View style={styles.header}>
      {back && onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      )}

      <View style={styles.row}>
        <View style={styles.l}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <View style={styles.rule} />
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </View>

        {count != null && (
          <View style={styles.countChip}>
            <Text style={styles.countText}>
              {count}{countLabel ? ` ${countLabel.toUpperCase()}` : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: P.ink,
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 14,
  },
  backLink: { paddingBottom: 6 },
  backText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  l: { flex: 1, minWidth: 0, flexDirection: 'column', gap: 5 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    fontWeight: '700',
    color: P.white,
    letterSpacing: -0.3,
  },
  rule: {
    width: 30,
    height: 3,
    backgroundColor: P.yellow,
    borderRadius: 2,
  },
  sub: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  countChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  countText: {
    fontFamily: fonts.monoBold,
    fontSize: 10.5,
    fontWeight: '800',
    color: P.yellow,
    letterSpacing: 0.2,
  },
});
