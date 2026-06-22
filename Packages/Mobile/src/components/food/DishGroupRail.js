/**
 * DishGroupRail — Food World 3C-1.
 *
 * The "What are you craving?" rail on the food home (CategoryListScreen, eat).
 * Admin-built dish_groups (mig 115) → image tile + name. Tapping a tile opens
 * DishGroupResultScreen for nearby restaurants serving that group.
 *
 * Self-loading + self-hiding: fetches GET /follower/dish-groups on mount;
 * renders nothing (no header, no rail) when there are no active tiles, so the
 * home's nearby list is unaffected. Toing white + yellow.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function DishGroupRail({ onPressTile, selectedId = null }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    followerApi.getDishGroups?.()
      .then((r) => { if (alive) setGroups((r?.data || r)?.groups || []); })
      .catch(() => { if (alive) setGroups([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Loading → skeleton tiles; empty (after load) → render nothing.
  if (!loading && groups.length === 0) return null;
  const tiles = loading ? Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, _skel: true })) : groups;

  return (
    <View>
      <Text style={styles.header}>What are you craving?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {tiles.map((g) => {
          const on = !g._skel && selectedId === g.id;
          return (
            <Pressable
              key={g.id}
              style={styles.tile}
              disabled={g._skel}
              onPress={() => onPressTile?.(g)}
            >
              <View style={[styles.img, on && styles.imgOn, g._skel && styles.skel]}>
                {!g._skel && (g.image_url
                  ? <Image source={{ uri: g.image_url }} style={styles.imgFill} resizeMode="cover" />
                  : <Text style={styles.fallback}>🍽️</Text>)}
              </View>
              {!g._skel && <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>{g.name}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.displayBold, fontSize: 16, color: T.ink, letterSpacing: -0.3, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  rail: { gap: 14, paddingHorizontal: 16, paddingBottom: 6 },
  tile: { width: 72, alignItems: 'center' },
  img: { width: 72, height: 72, borderRadius: 18, backgroundColor: T.yellowTint, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imgOn: { borderWidth: 2.5, borderColor: T.yellowDeep },
  imgFill: { width: '100%', height: '100%' },
  fallback: { fontSize: 30 },
  skel: { backgroundColor: '#EEF0F3' },
  name: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink, marginTop: 6, textAlign: 'center' },
  nameOn: { color: T.yellowDeep },
});
