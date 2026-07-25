/**
 * PostCard — the feed card, design v3 (founder-locked board
 * post-design-v3.html, reference 1 pin-to-pin).
 *
 * Anatomy: creator row (story-ring avatar w/ initial fallback, BLACK handle,
 * blue verified tick only when real, city grey, ⋯) → CREAM media sheet
 * (#F5F2EC) with swipeable slides + "n/N" counter + runtime pins (white pill,
 * WHITE bag in black circle, name dotted, PRICE BOLD below) + the WHITE
 * Shop-this-post pill INSIDE the media (yellow bar retired) + dots (blue
 * active, per reference) → outline engagement row with counts → caption
 * (more/less) → "View all N comments" (only when real) → grey timestamp.
 *
 * The media is never cropped beyond the Model B clamp (1:1 ↔ 4:5); the
 * cream canvas shows wherever the image doesn't cover. Creator uploads are
 * NEVER tinted — colour truth (founder rule).
 */
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, FlatList, Dimensions, StyleSheet, Alert } from 'react-native';
import { BagCircle, BagOutline, HeartIcon, CommentIcon, ShareIcon, SaveIcon, VerifiedTick } from './icons';

const W = Dimensions.get('window').width;
export const YELLOW = '#F6B11E';
export const CREAM = '#F5F2EC';
const BLUE = '#3897F0';

// Locked frame: natural ratio bounded to [1:1 … 4:5]. h/w ∈ [1, 1.25].
export function clampedHeight(width, height, renderW = W) {
  const ratio = width && height ? height / width : 1.25;
  return renderW * Math.min(Math.max(ratio, 1), 1.25);
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} minutes ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return `${Math.floor(s / (86400 * 30))} months ago`;
}

/** Story-ring avatar with an initial fallback (no more empty grey circles). */
export function RingAvatar({ creator, size = 34 }) {
  const inner = size - 5;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7A33B' }}>
      {creator?.avatar ? (
        <Image source={{ uri: creator.avatar }} style={{ width: inner, height: inner, borderRadius: inner / 2, borderWidth: 2, borderColor: '#FFF' }} />
      ) : (
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: '#111' }}>
            {(creator?.handle || '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

export function Pin({ tag, style: tagStyle, small }) {
  if (tagStyle === 'hidden') return null;
  const minimal = tagStyle === 'minimal';
  const x = Math.min(Math.max(Number(tag.x_pct), 14), 86);
  const y = Math.min(Math.max(Number(tag.y_pct), 5), 93);
  const nm = String(tag.name || '');
  const shown = nm.length > 18 ? `${nm.slice(0, 17).trimEnd()}…` : nm;
  return (
    <View style={[st.pin, { left: `${x}%`, top: `${y}%` }]} pointerEvents="none">
      <BagCircle size={small ? 26 : 30} />
      <View>
        {!minimal && <Text style={[st.pinName, small && { fontSize: 11 }]} numberOfLines={1}>{shown}</Text>}
        <Text style={[st.pinPrice, small && { fontSize: 12 }]}>₹{tag.offer_price ?? tag.price}</Text>
      </View>
    </View>
  );
}

export function EngagementRow({ post, onLike, onSave, style }) {
  const soon = (what) => Alert.alert(what, 'Coming soon.');
  return (
    <View style={[st.eng, style]}>
      <TouchableOpacity style={st.engBtn} onPress={onLike}>
        <HeartIcon size={19} color={post.liked ? '#E0245E' : '#111'} filled={post.liked} />
        {!!post.like_count && <Text style={st.engCount}>{post.like_count}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={st.engBtn} onPress={() => soon('Comments')}>
        <CommentIcon size={19} />
      </TouchableOpacity>
      <TouchableOpacity style={st.engBtn} onPress={() => soon('Share')}>
        <ShareIcon size={19} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={st.engBtn} onPress={onSave}>
        <SaveIcon size={19} color={post.saved ? YELLOW : '#111'} filled={post.saved} />
        {!!post.save_count && <Text style={st.engCount}>{post.save_count}</Text>}
      </TouchableOpacity>
    </View>
  );
}

/** The WHITE shop pill (reference language — lives INSIDE the media). */
export function ShopPill({ count, onPress, style }) {
  return (
    <TouchableOpacity style={[st.shopPill, style]} activeOpacity={0.9} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <BagOutline size={15} />
        <Text style={st.shopTxt}>Shop this post</Text>
      </View>
      <Text style={st.shopCount}>{count} item{count === 1 ? '' : 's'} ›</Text>
    </TouchableOpacity>
  );
}

export function CreatorRow({ creator, onCreator, right }) {
  return (
    <View style={st.crow}>
      <TouchableOpacity style={st.crowLeft} onPress={onCreator} activeOpacity={0.8}>
        <RingAvatar creator={creator} />
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={st.handle}>{creator.handle}</Text>
            {creator.verified ? <VerifiedTick size={13} /> : null}
          </View>
          {!!creator.city && <Text style={st.city}>{creator.city}</Text>}
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      {right || <Text style={st.menu}>⋯</Text>}
    </View>
  );
}

export default function PostCard({ post, onOpen, onShop, onLike, onSave, onCreator }) {
  const [slide, setSlide] = useState(0);
  const [capOpen, setCapOpen] = useState(false);
  const capLong = (post.caption || '').length > 80;
  const cover = post.cover;
  const h = clampedHeight(cover?.width, cover?.height);
  const slides = post.slide_count || 1;

  return (
    <View style={st.card}>
      <CreatorRow creator={post.creator} onCreator={onCreator} />

      {/* CREAM media sheet — cover slide (per-slide media arrives on open) */}
      <Pressable onPress={onOpen}>
        <View style={{ width: W, height: h + 54, backgroundColor: CREAM }}>
          {cover
            ? <Image source={{ uri: cover.url }} style={{ width: W, height: h }} resizeMode="cover" />
            : <View style={{ width: W, height: h }} />}
          {(post.feed_pins || []).map((t, i) => <Pin key={i} tag={t} style={post.tag_style} small />)}
          {slides > 1 && (
            <View style={st.slideBadge}><Text style={st.slideBadgeTxt}>{slide + 1}/{slides}</Text></View>
          )}
          {/* WHITE shop pill inside the media (reference) */}
          <ShopPill count={post.product_count} onPress={onShop}
            style={{ position: 'absolute', left: 12, right: 12, bottom: slides > 1 ? 22 : 10 }} />
          {slides > 1 && (
            <View style={st.dots}>
              {Array.from({ length: Math.min(slides, 6) }).map((_, i) => (
                <View key={i} style={[st.dot, i === slide && st.dotOn]} />
              ))}
            </View>
          )}
        </View>
      </Pressable>

      <EngagementRow post={post} onLike={onLike} onSave={onSave} />

      {!!post.caption && (
        <Pressable onPress={() => capLong && setCapOpen(o => !o)}>
          <Text style={st.caption} numberOfLines={capOpen ? undefined : 2}>
            <Text style={st.captionHandle}>{post.creator.handle} </Text>{post.caption}
          </Text>
          {capLong && <Text style={st.captionMore}>{capOpen ? 'less' : '… more'}</Text>}
        </Pressable>
      )}
      <Text style={st.timestamp}>{timeAgo(post.created_at)}</Text>
      <View style={st.sep} />
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#FFF' },
  crow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, gap: 9 },
  crowLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  handle: { fontSize: 13.5, fontWeight: '800', color: '#111' },
  city: { fontSize: 10.5, color: '#8A8A8A', marginTop: 1 },
  menu: { fontSize: 16, color: '#111', letterSpacing: 2, paddingHorizontal: 2 },
  pin: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 999, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, transform: [{ translateX: -36 }, { translateY: -20 }], shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, maxWidth: 210 },
  pinName: { fontSize: 12, fontWeight: '600', color: '#111' },
  pinPrice: { fontSize: 13, fontWeight: '800', color: '#111' },
  slideBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(17,17,17,0.78)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  slideBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  shopPill: { backgroundColor: '#FFF', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  shopTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  shopCount: { fontSize: 12, fontWeight: '600', color: '#777' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 7, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C9C4BA' },
  dotOn: { backgroundColor: BLUE },
  eng: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, gap: 16 },
  engBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  engCount: { fontSize: 12.5, fontWeight: '700', color: '#111' },
  caption: { paddingHorizontal: 14, paddingTop: 7, fontSize: 12.5, color: '#111', lineHeight: 17.5 },
  captionHandle: { fontWeight: '800' },
  captionMore: { paddingHorizontal: 14, paddingTop: 2, fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
  timestamp: { paddingHorizontal: 14, paddingTop: 4, fontSize: 10.5, color: '#8A8A8A' },
  sep: { height: 1, backgroundColor: '#F2F2F2', marginTop: 12 },
});
