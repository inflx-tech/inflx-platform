import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

/**
 * ViaCreatorChip — "via @handle" soft pill with a mini avatar. The creator-vibe
 * trust line that says "a person you follow surfaced this". Renders nothing
 * without a handle/name (defensive).
 *
 * Props: creator { handle, name, avatar } | (handle, name, avatar)
 *        tone: 'soft' (default, on light card) | 'glass' (on a gradient/image)
 */
export default function ViaCreatorChip({ creator, handle, name, avatar, tone = 'soft' }) {
  const h = handle || creator?.handle;
  const n = name || creator?.name;
  const a = avatar || creator?.avatar;
  const label = h ? `@${h}` : n;
  if (!label) return null;

  const glass = tone === 'glass';
  return (
    <View style={[styles.chip, glass && styles.chipGlass]}>
      <View style={styles.avatar}>
        {a ? <Image source={{ uri: a }} style={styles.avatarImg} />
           : <Text style={styles.avatarTxt}>{(n || h || '?')[0]}</Text>}
      </View>
      <Text style={[styles.txt, glass && styles.txtGlass]} numberOfLines={1}>via {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: C.soft, borderRadius: 20,
    paddingVertical: 3, paddingLeft: 3, paddingRight: 9,
  },
  chipGlass: { backgroundColor: 'rgba(255,255,255,0.82)' },
  avatar: {
    width: 16, height: 16, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#E6CFA6', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { fontSize: 8, fontWeight: '800', color: C.brownDark, fontFamily: fonts.displayBlack },
  txt: { fontSize: 9, fontWeight: '800', color: '#5E4631', fontFamily: fonts.monoBold },
  txtGlass: { color: '#4A3A2A' },
});
