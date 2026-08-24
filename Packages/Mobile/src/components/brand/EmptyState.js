import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';

/**
 * <EmptyState icon title sub />
 *
 * Dashed hairline card with a neutral tile + Outfit title +
 * PJS muted sub. Introduced in Flow 21 (2026-05-25). Replaces inline
 * equivalents in Flows 18-20.
 *
 * Props:
 *   - icon:  string placeholder (e.g. '[$]', '[BELL]', '[NONE]')
 *   - title: short string
 *   - sub:   longer string, max ~260px wrap
 */

export default function EmptyState({ icon = '[—]', title, sub }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: P.border,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: P.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    fontWeight: '800',
    color: P.ink,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    fontWeight: '700',
    color: P.ink,
  },
  sub: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    color: P.muted,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
});
