/**
 * Item 3 — small shared pieces: live status chip, the three-number stat row, avatar stack,
 * handle tags, checkbox row, product card/grid, post grid (empty), image carousel.
 * Contract: features/item3-discovery-profiles-groups
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, FlatList, Dimensions } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Tag, EmptyState } from '../settings/primitives';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { fmtCompact, fmtPct, C3 } from './copy3';
import { groupIndian } from '../settings/copy';

/** Open (green) · Not taking invitations (grey) · Not open to your brand (red) · Blocked by you (grey). */
export function StatusChip3({ status, blockedByYou, brandSide, testID }) {
  const map = brandSide ? C3.findBrands.chips : C3.discover.chips;
  // Item 8: a cooldown and an unmeasured number are WAITING, not refusals.
  // Colouring them like "you don't match" would tell her the wrong thing.
  const tone = status === 'OK' ? T.state.active
    : status === 'NOT_MATCHING' ? T.state.declined
      : status === 'COOLDOWN' || status === 'BEING_MEASURED' ? T.state.waiting
        : T.state.ended;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} testID={testID}>
      {status ? <View style={[st.chip, { backgroundColor: tone.bg }]}><Text style={[st.chipText, { color: tone.fg }]}>{map[status] || status}</Text></View> : null}
      {blockedByYou ? <View style={[st.chip, { backgroundColor: T.state.ended.bg }]}><Text style={[st.chipText, { color: T.state.ended.fg }]}>{C3.discover.chips.blocked}</Text></View> : null}
    </View>
  );
}

export function StatTriple({ instagram, youtube, engagement, compact }) {
  const items = [[fmtCompact(instagram), 'Instagram'], [fmtCompact(youtube), 'YouTube'], [fmtPct(engagement), 'Engagement']];
  return (
    <View style={st.stats}>
      {items.map(([v, l]) => (
        <View key={l} style={st.stat}>
          <Text style={[st.statV, compact && { fontSize: 14 }]}>{v}</Text>
          <Text style={st.statL}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

export function AvatarStack({ people = [], extra = 0, size = 28 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {people.slice(0, 4).map((p, i) => (
        <View key={p.id || i} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: T.bg, borderRadius: size }}>
          <Avatar name={p.name} url={p.avatarUrl} size={size} />
        </View>
      ))}
      {extra > 0 ? <Text style={st.extra}>+{extra}</Text> : null}
    </View>
  );
}

/** A handle as a tag that opens the app / site. */
export function HandleTag({ kind, handle }) {
  if (!handle) return null;
  const url = kind === 'ig' ? `https://instagram.com/${handle}` : `https://youtube.com/@${handle}`;
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link" testID={`handle-${kind}`}>
      <Tag label={kind === 'ig' ? handle : `@${handle}`} />
    </TouchableOpacity>
  );
}

export function CheckboxRow({ checked, disabled, onPress, children, testID }) {
  return (
    <TouchableOpacity style={[st.checkRow, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled} activeOpacity={0.7}
      accessibilityRole="checkbox" accessibilityState={{ checked: !!checked, disabled: !!disabled }} testID={testID}>
      <View style={[st.box, checked && st.boxOn]}>{checked ? <Text style={st.tick}>✓</Text> : null}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

export function ProductCard({ product, onPress, width }) {
  return (
    <TouchableOpacity style={[st.product, { width }]} onPress={onPress} activeOpacity={0.85} testID={`product-${product.id}`}>
      <View style={st.productImgWrap}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={st.productImg} /> : <View style={[st.productImg, { backgroundColor: T.surface }]} />}
        {product.outOfStock ? <View style={st.oos}><Text style={st.oosText}>{C3.overview.outOfStock}</Text></View> : null}
      </View>
      <Text style={st.productName} numberOfLines={2}>{product.name}</Text>
      <Text style={st.productPrice}>{product.price != null ? `₹${groupIndian(product.price)}` : ''}</Text>
    </TouchableOpacity>
  );
}

export function ProductGrid({ products, onOpen }) {
  const width = (Dimensions.get('window').width - 18 * 2 - 12) / 2;
  return (
    <View style={st.grid}>
      {products.map(p => <ProductCard key={p.id} product={p} width={width} onPress={() => onOpen && onOpen(p)} />)}
    </View>
  );
}

/** Item 13 fills this. Today it renders the empty state with the given copy. */
export function PostGrid({ posts = [], emptyTitle, emptyBody }) {
  if (!posts.length) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return <View style={st.grid}>{posts.map(p => <View key={p.id} style={st.postCell} />)}</View>;
}

export function ImageCarousel({ images = [] }) {
  const [idx, setIdx] = useState(0);
  const w = Dimensions.get('window').width;
  if (!images.length) return <View style={[st.carousel, { width: w, backgroundColor: T.surface }]} />;
  return (
    <View>
      <FlatList data={images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(u, i) => `${i}`}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / w))}
        renderItem={({ item }) => <Image source={{ uri: item }} style={[st.carousel, { width: w }]} resizeMode="cover" />} />
      {images.length > 1 ? (
        <View style={st.dots}>{images.map((_, i) => <View key={i} style={[st.dot, i === idx && st.dotOn]} />)}</View>
      ) : null}
    </View>
  );
}

export const st = StyleSheet.create({
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginRight: 6, marginBottom: 4 },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 11.5 },
  stats: { flexDirection: 'row', marginTop: 8 },
  stat: { flex: 1 },
  statV: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  statL: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, marginTop: 1 },
  extra: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2, marginLeft: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: T.bg },
  boxOn: { backgroundColor: T.ink, borderColor: T.ink },
  tick: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.sansBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  product: { marginBottom: 14 },
  productImgWrap: { position: 'relative' },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: T.surface },
  oos: { position: 'absolute', top: 8, left: 8, backgroundColor: T.state.ended.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  oosText: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, color: T.state.ended.fg },
  productName: { fontFamily: fonts.sansMedium, fontSize: 13, color: T.ink, marginTop: 6 },
  productPrice: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginTop: 2 },
  postCell: { width: '32%', aspectRatio: 1, backgroundColor: T.surface, borderRadius: 8, marginBottom: 6 },
  carousel: { height: 320 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.border, marginHorizontal: 3 },
  dotOn: { backgroundColor: T.ink },
});
