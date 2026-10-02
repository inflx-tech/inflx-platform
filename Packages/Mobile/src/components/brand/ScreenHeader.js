import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';

/**
 * <ScreenHeader title sub back onBack count countLabel />
 *
 * White topbar component. Single source of truth for brand-mobile screens
 * (Flow 21+). Replaces inline topbar markup in Flows 18-20 (deferred
 * retroactive migration).
 *
 * White surface, ink text, hairline rule underneath. No colour accent — the
 * former ink bar + yellow underline were retired in the white/black pass.
 *
 * Props:
 *   - title:      string (Outfit-Bold 22 ink)
 *   - sub:        optional string (PJS Medium 11 muted)
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
  // ui-walk-fixes D4 — no blank strip: the phone's real top inset plus a small gap.
  const top = useTopInset(TOP_GAP_TITLE);
  return (
    <View style={[styles.header, { paddingTop: top }]}>
      {back && onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      )}

      <View style={styles.row}>
        <View style={styles.l}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
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
    backgroundColor: P.white,
    paddingHorizontal: 18,
    paddingTop: TOP_GAP_TITLE,   // only the gap; the component adds the phone's top inset
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.border,
  },
  backLink: { paddingBottom: 6 },
  backText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    fontWeight: '600',
    color: P.muted2,
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
    color: P.ink,
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: P.muted2,
  },
  countChip: {
    backgroundColor: P.bg2,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  countText: {
    fontFamily: fonts.monoBold,
    fontSize: 10.5,
    fontWeight: '800',
    color: P.ink,
    letterSpacing: 0.2,
  },
});
