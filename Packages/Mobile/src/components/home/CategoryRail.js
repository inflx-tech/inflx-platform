/**
 * CategoryRail — the "What's on your mind?" craving rail, now a PLACEABLE
 * section (shelf_type 'category_rail', rule 'world_categories'). Renders a
 * world's sub-category tiles (Home Builder). Tapping a tile toggles an in-page
 * craving filter (handled by the host screen). Can be marked sticky in admin.
 *
 * Props: items [{key,name,icon,image_url}], title, selectedKey, onPress(item).
 */

import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

export default function CategoryRail({ items = [], title = "What's on your mind?", selectedKey = null, onPress }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <View style={s.wrap}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 8 }}>
        {items.map((c) => {
          const sel = selectedKey != null && selectedKey === c.key;
          return (
            <TouchableOpacity key={c.key} style={s.cat} activeOpacity={0.8} onPress={() => onPress?.(c)}>
              <View style={[s.imgBox, sel && s.imgBoxOn]}>
                {c.image_url
                  ? <Image source={{ uri: c.image_url }} style={s.img} resizeMode="contain" />
                  : <Text style={s.emoji}>{c.icon || '🍽️'}</Text>}
              </View>
              <Text style={[s.name, sel && s.nameOn]} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: T.white, paddingTop: 8, paddingBottom: 12, paddingLeft: 14 },
  title: { fontSize: 16, color: T.ink, fontFamily: fonts.displayBold, marginBottom: 11 },
  cat: { alignItems: 'center', width: 74 },
  imgBox: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 33 },
  imgBoxOn: { borderWidth: 2.5, borderColor: T.yellowDeep },
  img: { width: 66, height: 66 },
  emoji: { fontSize: 42 },
  name: { fontSize: 11, color: T.ink, fontFamily: fonts.sansMedium, marginTop: 6, textAlign: 'center' },
  nameOn: { color: T.yellowDeep, fontFamily: fonts.sansBold },
});
