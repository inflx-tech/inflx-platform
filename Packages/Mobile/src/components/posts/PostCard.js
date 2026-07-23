/**
 * PostCard — the atom of the new follower app (Post/Concept Stage A).
 * Contract: features/concept-stagea-posts-ui/. Locked tokens (2026-07-23):
 * pure white canvas, full-bleed media, yellow-only accents, system font;
 * media renders at its NATURAL shape clamped 1:1 ↔ 4:5 (cover, nothing cut
 * from the file); price tags visible IN FEED per the creator's tag style
 * ('hidden' = no pins anywhere but the Shop sheet); yellow Shop bar with
 * white text; compact horizontal engagement row (like+save live, comments/
 * share coming soon).
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, Dimensions, StyleSheet, Alert } from 'react-native';

const W = Dimensions.get('window').width;
export const YELLOW = '#F6B11E';

// Locked frame: natural ratio bounded to [1:1 … 4:5]. h/w ∈ [1, 1.25].
export function clampedHeight(width, height, renderW = W) {
  const ratio = width && height ? height / width : 1.25;
  return renderW * Math.min(Math.max(ratio, 1), 1.25);
}

export function Pin({ tag, style: tagStyle, small }) {
  if (tagStyle === 'hidden') return null;
  const minimal = tagStyle === 'minimal';
  return (
    <View style={[st.pin, { left: `${tag.x_pct}%`, top: `${tag.y_pct}%` }]} pointerEvents="none">
      <Text style={[st.pinTxt, small && { fontSize: 9 }]} numberOfLines={1}>
        {minimal ? `₹${tag.offer_price ?? tag.price}` : `${tag.name} · ₹${tag.offer_price ?? tag.price}`}
      </Text>
    </View>
  );
}

export function EngagementRow({ post, onLike, onSave, counts = true, style }) {
  const soon = (what) => Alert.alert(what, 'Coming soon.');
  return (
    <View style={[st.eng, style]}>
      <TouchableOpacity style={st.engBtn} onPress={onLike}>
        <Text style={[st.engIcon, post.liked && { color: '#E0245E' }]}>{post.liked ? '♥' : '♡'}</Text>
        {counts && <Text style={st.engCount}>{post.like_count || ''}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={st.engBtn} onPress={() => soon('Comments')}>
        <Text style={st.engIcon}>💬</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.engBtn} onPress={() => soon('Share')}>
        <Text style={st.engIcon}>↗</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={st.engBtn} onPress={onSave}>
        <Text style={[st.engIcon, post.saved && { color: YELLOW }]}>{post.saved ? '🔖' : '🏷'}</Text>
        {counts && <Text style={st.engCount}>{post.save_count || ''}</Text>}
      </TouchableOpacity>
    </View>
  );
}

export function ShopBar({ count, onPress, compact }) {
  return (
    <TouchableOpacity style={[st.shop, compact && { paddingVertical: 10 }]} activeOpacity={0.9} onPress={onPress}>
      <Text style={st.shopTxt}>🛍  Shop this post</Text>
      <Text style={st.shopCount}>{count} item{count === 1 ? '' : 's'}  ›</Text>
    </TouchableOpacity>
  );
}

export function CreatorRow({ creator, concept, collection, onCreator, compact }) {
  return (
    <View style={[st.crow, compact && { paddingVertical: 6 }]}>
      <TouchableOpacity style={st.crowLeft} onPress={onCreator} activeOpacity={0.8}>
        {creator.avatar
          ? <Image source={{ uri: creator.avatar }} style={st.av} />
          : <View style={[st.av, { backgroundColor: '#EEE' }]} />}
        <View>
          <Text style={st.handle}>{creator.handle}</Text>
          {!!creator.city && <Text style={st.city}>{creator.city}</Text>}
        </View>
      </TouchableOpacity>
      {(concept || collection) && (
        <View style={st.chip}><Text style={st.chipTxt} numberOfLines={1}>{(concept || collection).name}</Text></View>
      )}
      <View style={{ flex: 1 }} />
    </View>
  );
}

/** Feed card: creator row → clamped media (cover slide + pins) → shop bar →
 * engagement → 2-line caption. `post` = one GET /follower/posts item. */
export default function PostCard({ post, onOpen, onShop, onLike, onSave, onCreator }) {
  const cover = post.cover;
  const h = clampedHeight(cover?.width, cover?.height);
  return (
    <View style={st.card}>
      <CreatorRow creator={post.creator} concept={post.concept} collection={post.collection} onCreator={onCreator} />
      <Pressable onPress={onOpen}>
        {cover
          ? <Image source={{ uri: cover.url }} style={{ width: W, height: h }} resizeMode="cover" />
          : <View style={{ width: W, height: W, backgroundColor: '#F4F4F4' }} />}
        {(post.feed_pins || []).map((t, i) => <Pin key={i} tag={t} style={post.tag_style} small />)}
        {post.slide_count > 1 && (
          <View style={st.slideBadge}><Text style={st.slideBadgeTxt}>1/{post.slide_count}</Text></View>
        )}
      </Pressable>
      <ShopBar count={post.product_count} onPress={onShop} compact />
      <EngagementRow post={post} onLike={onLike} onSave={onSave} />
      {!!post.caption && (
        <Text style={st.caption} numberOfLines={2}>
          <Text style={st.captionHandle}>{post.creator.handle} </Text>{post.caption}
        </Text>
      )}
      <View style={st.sep} />
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#FFF' },
  crow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 9 },
  crowLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  av: { width: 32, height: 32, borderRadius: 16 },
  handle: { fontSize: 13, fontWeight: '700', color: '#111' },
  city: { fontSize: 10.5, color: '#999' },
  chip: { backgroundColor: '#FDF3D7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, maxWidth: 150 },
  chipTxt: { fontSize: 10, fontWeight: '700', color: '#7A6210' },
  pin: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, transform: [{ translateX: -24 }, { translateY: -12 }], shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 3, maxWidth: 190 },
  pinTxt: { fontSize: 10, fontWeight: '700', color: '#111' },
  slideBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  slideBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  shop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 14, marginTop: 10, backgroundColor: YELLOW, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  shopTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  shopCount: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '700' },
  eng: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, gap: 14 },
  engBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  engIcon: { fontSize: 20, color: '#111' },
  engCount: { fontSize: 12, fontWeight: '600', color: '#333' },
  caption: { paddingHorizontal: 14, paddingTop: 6, fontSize: 12.5, color: '#222', lineHeight: 17 },
  captionHandle: { fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#F2F2F2', marginTop: 12 },
});
