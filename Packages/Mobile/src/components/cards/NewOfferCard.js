import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkColors, getBusinessAccent } from '../../theme/tokens';

/**
 * NewOfferCard — full-width shop/category level deal card.
 *
 * Matches the HTML mockup: gradient bg, store logo + name + deal description
 * + tags (left), big discount % (right), influencer strip (bottom).
 */

export default function NewOfferCard({
  store,         // { name, logo_initial, category }
  dealType,      // 'shop' | 'category'
  dealLabel,     // e.g. "Shop ₹3,000+ · All categories"
  discountValue, // e.g. "15%"
  tags,          // ['Sarees', "Men's", 'Bridal']
  influencer,    // { name, avatar_initial }
  validTill,     // e.g. "Apr 15"
  accentColor,   // override accent
  onPress,
}) {
  const accent = accentColor || getBusinessAccent(store?.category).accent;
  const accentDim = getBusinessAccent(store?.category).dim;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: accentDim, borderColor: `${accent}33` }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Main content row */}
      <View style={styles.inner}>
        {/* Store logo */}
        <View style={[styles.logo, { backgroundColor: accent }]}>
          <Text style={styles.logoText}>{store?.logo_initial || store?.name?.[0] || '?'}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.storeName}>{store?.name}</Text>
          <Text style={styles.dealDesc}>
            {dealType === 'shop' ? '🏪' : '📂'} {dealLabel}
          </Text>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <View style={styles.tags}>
              {tags.map((tag, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: accentDim }]}>
                  <Text style={[styles.tagText, { color: accent }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Big discount % */}
        <View style={styles.dealRight}>
          <Text style={[styles.dealValue, { color: accent }]}>{discountValue}</Text>
          <Text style={[styles.dealOff, { color: accent }]}>OFF</Text>
        </View>
      </View>

      {/* Influencer strip */}
      {influencer && (
        <View style={[styles.infStrip, { backgroundColor: `${accent}08` }]}>
          <View style={[styles.infAvatar, { backgroundColor: accent }]}>
            <Text style={styles.infAvatarText}>{influencer.avatar_initial || influencer.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.infLine}>
            <Text style={styles.infName}>{influencer.name}</Text>
            <Text style={styles.infMeta}> · {dealType === 'shop' ? 'Shop-level deal' : 'Category deal'} · Walk-in & pay</Text>
          </Text>
          {validTill && <Text style={styles.validity}>Till {validTill}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: darkColors.text,
  },
  dealDesc: {
    fontSize: 11,
    color: darkColors.textSecondary,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  dealRight: {
    alignItems: 'center',
  },
  dealValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  dealOff: {
    fontSize: 9,
    fontWeight: '600',
  },
  infStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: darkColors.border,
  },
  infAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infAvatarText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#fff',
  },
  infLine: {
    flex: 1,
    fontSize: 10,
  },
  infName: {
    fontWeight: '700',
    color: darkColors.text,
  },
  infMeta: {
    color: darkColors.textSecondary,
  },
  validity: {
    fontSize: 9,
    color: darkColors.textMuted,
  },
});
