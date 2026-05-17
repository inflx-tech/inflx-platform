import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { lightColors, fonts } from '../../theme/tokens';
import CreatorChip from './CreatorChip';

/**
 * SagarStrip — horizontal creator endorsement strip.
 *
 * Named after the canonical INFLX example creator (Sagar @sagar.eats),
 * this component renders a scroll-x row of curated picks attributed
 * to a single creator. Used at the top of restaurant detail screens,
 * brand stores, and discovery surfaces.
 *
 * Header: "★ <CreatorName>'s picks" / left, "See all" right.
 * Body:   horizontal scroll of item tiles (photo + name + price).
 *
 * Props:
 *   creator  — { handle, name, verified, avatar }
 *   items    — array of { id, name, price, image_url, accent? }
 *   onItemPress — (item) => void
 *   onSeeAll    — () => void
 *   title       — override title; default "<handle>'s picks"
 */

export default function SagarStrip({ creator, items = [], onItemPress, onSeeAll, title }) {
  if (!creator || items.length === 0) return null;

  const headerTitle = title
    || `★ ${creator.name ? `${creator.name}'s` : `@${creator.handle || 'creator'}'s`} picks`;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{headerTitle}</Text>
          <CreatorChip
            handle={creator.handle}
            name={creator.name}
            verified={creator.verified}
            size="sm"
          />
        </View>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map(it => (
          <Pressable key={it.id} style={styles.tile}
                     onPress={onItemPress ? () => onItemPress(it) : null}>
            <View style={styles.imgWrap}>
              {it.image_url
                ? <Image source={{ uri: it.image_url }} style={styles.img} />
                : <View style={[styles.img, styles.imgFallback]}>
                    <Text style={styles.imgEmoji}>🍽️</Text>
                  </View>}
            </View>
            <Text numberOfLines={1} style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemPrice}>₹{Math.round(it.price || 0)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: lightColors.ink,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: lightColors.yellowDeep,
  },

  row: { paddingHorizontal: 16, gap: 10 },
  tile: { width: 112 },
  imgWrap: {
    width: 112,
    height: 112,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: lightColors.surface,
  },
  img: { width: '100%', height: '100%' },
  imgFallback: { alignItems: 'center', justifyContent: 'center' },
  imgEmoji: { fontSize: 36 },

  itemName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: lightColors.ink,
    marginTop: 6,
  },
  itemPrice: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: lightColors.ink,
    marginTop: 1,
  },
});
