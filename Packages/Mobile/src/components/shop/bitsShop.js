/**
 * The shopper app's shared parts (follower-app-v2 · boards F2–F12): the top bar, the circles, the
 * post card, Shop this post, the 2 × 2 tiles, the video block, the sign-in sheet.
 *
 * Every purchase goes through a post (P1), so every post carries Shop this post. Liking and
 * commenting need sign-in; saving and following work for guests and stay on the phone (5.2).
 * Ordering (shopper-ordering, v1.13 §6): Shop this post has Add (a simple post → the size sheet,
 * O1/O2) or Build your deal (a deal post → its deal page, D1); the bag sits in the top bar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList, Modal, ScrollView, Share, StyleSheet, Dimensions,
  ActivityIndicator, Pressable,
} from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { track } from '../../services/events';
import { CS, inr, initialsOf, fmtCount } from './copyShop';
import { shopStore, isSignedIn, toggleSavePostLocal, toggleSaveProductLocal } from './shopStore';
import ShopVideo from './ShopVideo';
import { BagButton, SizeSheet, useNavSafe } from './orderBits';
import { CO } from './copyOrder';
import { addToBag, subscribeBagCount } from './bag';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const C = { ...T, ink: '#1A1A17', dark: '#111111' };
const W = Dimensions.get('window').width;

/* ───────────────────────────────────────────── top bar */

export function TopBar({ title, onBack, onSearch, dark, right }) {
  return (
    <View style={[s.top, dark && { backgroundColor: C.dark }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[s.ic, dark && s.icDark]} accessibilityLabel="Back" testID="back">
          <Icon name="chevron-left" size={22} color={dark ? '#fff' : C.ink} />
        </TouchableOpacity>
      ) : null}
      <Text style={[title ? s.title : s.wordmark, dark && { color: '#fff' }]} numberOfLines={1}>{title || CS.wordmark}</Text>
      {right}
      {onSearch ? <BagButton dark={dark} /> : null}
      {onSearch ? (
        <TouchableOpacity onPress={onSearch} style={[s.ic, dark && s.icDark]} accessibilityLabel="Search or enter a post code" testID="open-search">
          <Icon name="magnify" size={19} color={dark ? '#fff' : C.ink} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ───────────────────────────────────────────── avatars and circles (F2, F7, F9) */

export function Avatar({ uri, name, size = 28, square }) {
  const r = square ? Math.round(size * 0.29) : size / 2;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, backgroundColor: '#E9E8E2' }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: '#FFE7A3', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: Math.max(9, size * 0.36), color: C.ink }}>{initialsOf(name)}</Text>
    </View>
  );
}

export function Circle({ name, uri, ring, square, onPress, testID }) {
  return (
    <TouchableOpacity style={s.cir} onPress={onPress} testID={testID} accessibilityLabel={`${name}${ring ? ', new posts' : ''}`}>
      <View style={[s.cirRing, ring && s.cirRingOn, square && { borderRadius: 16 }]}>
        <Avatar uri={uri} name={name} size={48} square={square} />
      </View>
      <Text style={s.cirName} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

export function CircleRow({ label, items, square, onPress, testIDPrefix }) {
  if (!items || !items.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.rowLbl}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 10 }}>
        {items.map((x) => (
          <Circle key={x.id} name={x.name} uri={x.avatar || x.logo} ring={x.ring} square={square} onPress={() => onPress(x)} testID={`${testIDPrefix}-${x.id}`} />
        ))}
      </ScrollView>
    </View>
  );
}

/* ───────────────────────────────────────────── media */

/**
 * A post's video (4.7): the player on phones with the new app build, otherwise the product photo
 * with "Update INFLX to play videos" — see ShopVideo.
 */
export function VideoView(props) {
  return <ShopVideo {...props} />;
}

function Slides({ post, width, height, active, surface }) {
  const [i, setI] = useState(0);
  const media = post.media || [];
  if (post.media_kind === 'video') return <VideoView post={post} height={height} active={active} surface={surface} muted />;
  if (media.length <= 1) {
    return media[0] ? <Image source={{ uri: media[0].url }} style={{ width, height, backgroundColor: '#E9E8E2' }} resizeMode="cover" />
      : <View style={{ width, height, backgroundColor: '#E9E8E2' }} />;
  }
  return (
    <View>
      <FlatList
        data={media} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => m.id}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <Image source={{ uri: item.url }} style={{ width, height, backgroundColor: '#E9E8E2' }} resizeMode="cover" />}
      />
      <View style={s.dots}>{media.map((m, k) => <View key={m.id} style={[s.dot, k === i && s.dotOn]} />)}</View>
    </View>
  );
}

/* ───────────────────────────────────────────── engagement: likes, saves, share */

/**
 * The like / save state of one post on this phone. Likes need sign-in; a guest's save stays on
 * the phone (5.2). Returns handlers that record what she did (5.14).
 */
export function usePostActions(post, { surface, onNeedSignIn }) {
  const [liked, setLiked] = useState(!!(post.mine && post.mine.liked));
  const [likes, setLikes] = useState((post.counts && post.counts.likes) || 0);
  const [saved, setSaved] = useState(!!(post.mine && post.mine.saved));

  useEffect(() => {
    let alive = true;
    (async () => {
      if (await isSignedIn()) return;
      const st = await shopStore.get();
      if (alive) setSaved(st.savedPosts.includes(post.id));
    })();
    return () => { alive = false; };
  }, [post.id]);

  const like = useCallback(async () => {
    if (!(await isSignedIn())) { onNeedSignIn && onNeedSignIn(); return; }
    const on = !liked;
    setLiked(on); setLikes((n) => Math.max(0, n + (on ? 1 : -1)));
    track(on ? 'like' : 'unlike', post.id, surface);
    const res = on ? await followerApi.like(post.id) : await followerApi.unlike(post.id);
    if (res && res.success) setLikes(res.data.likes);
    else { setLiked(!on); setLikes((n) => Math.max(0, n + (on ? -1 : 1))); }
  }, [liked, post.id, surface, onNeedSignIn]);

  const save = useCallback(async () => {
    const on = !saved;
    setSaved(on);
    track(on ? 'save' : 'unsave', post.id, surface);
    if (await isSignedIn()) {
      const res = on ? await followerApi.save(post.id) : await followerApi.unsave(post.id);
      if (!res || !res.success) setSaved(!on);
    } else {
      await toggleSavePostLocal(post.id, on);
    }
  }, [saved, post.id, surface]);

  const share = useCallback(async () => {
    track('share', post.id, surface);
    try { await Share.share({ message: `${post.title || CS.shopThisPost} · ${post.creator ? post.creator.name : ''}\n${post.share_url}` }); } catch { /* dismissed */ }
  }, [post, surface]);

  return { liked, likes, saved, like, save, share };
}

/* ───────────────────────────────────────────── the post card (F2, F4) */

export function PostCard({ post, surface, position, onOpen, onShop, onComments, onCreator, onBrand, onNeedSignIn, active = false, width = W - 28 }) {
  const a = usePostActions(post, { surface, onNeedSignIn });
  const height = Math.round(width * 1.25);
  const n = post.products ? post.products.length : 0;
  const where = [post.brand && post.brand.name, post.brand && post.brand.city].filter(Boolean).join(' · ');
  return (
    <View style={s.post} testID={`post-${post.id}`}>
      <View style={s.ph}>
        <TouchableOpacity onPress={() => { track('tap_creator', post.id, surface); onCreator(post.creator); }} testID={`post-creator-${post.id}`}>
          <Avatar uri={post.creator && post.creator.avatar} name={post.creator && post.creator.name} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.phName} onPress={() => { track('tap_creator', post.id, surface); onCreator(post.creator); }}>{post.creator ? post.creator.name : ''}</Text>
          <Text style={s.phSub} onPress={() => { track('tap_brand', post.id, surface); onBrand(post.brand); }} testID={`post-brand-${post.id}`}>{where}</Text>
        </View>
      </View>
      <Pressable onPress={() => { track('open', post.id, surface, { position }); onOpen(post); }} testID={`post-open-${post.id}`}>
        <Slides post={post} width={width} height={height} active={active} surface={surface} />
        {post.offer && post.offer.badge ? <View style={s.badge}><Text style={s.badgeText}>{post.offer.badge}</Text></View> : null}
        <TouchableOpacity style={s.shopBtn} onPress={() => { track('tap_shop', post.id, surface, { position }); onShop(post); }} testID={`post-shop-${post.id}`}>
          <Text style={s.shopText}>{post.media_kind === 'video' ? CS.shopThisVideo : CS.shopThisPost} · {CS.items(n)}</Text>
          <Text style={s.shopText}>›</Text>
        </TouchableOpacity>
      </Pressable>
      <View style={s.acts}>
        <TouchableOpacity onPress={a.like} testID={`post-like-${post.id}`} accessibilityState={{ selected: !!a.liked }}>
          <View style={s.actRow}><Icon name={a.liked ? 'heart' : 'heart-outline'} size={19} color={a.liked ? '#C42B2B' : C.ink} /><Text style={s.act}>{fmtCount(a.likes)}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onComments(post)} testID={`post-comments-${post.id}`}>
          <View style={s.actRow}><Icon name="comment-outline" size={18} color={C.ink} /><Text style={s.act}>{fmtCount(post.counts ? post.counts.comments : 0)}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={a.share} testID={`post-share-${post.id}`}>
          <View style={s.actRow}><Icon name="share-outline" size={20} color={C.ink} /><Text style={s.act}>{fmtCount(post.counts ? post.counts.shares : 0)}</Text></View>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={a.save} testID={`post-save-${post.id}`} accessibilityState={{ selected: !!a.saved }} accessibilityLabel={a.saved ? 'Saved' : 'Save'}>
          <View style={s.actRow}><Icon name={a.saved ? 'bookmark' : 'bookmark-outline'} size={20} color={C.ink} />{a.saved ? <Text style={[s.act, { color: C.ink }]}>Saved</Text> : null}</View>
        </TouchableOpacity>
      </View>
      {post.caption ? (
        <Text style={s.caption} numberOfLines={2}><Text style={{ fontFamily: fonts.sansBold, color: C.ink }}>{post.creator ? post.creator.name.split(' ')[0] : ''} </Text>{post.caption}</Text>
      ) : null}
    </View>
  );
}

/* ───────────────────────────────────────────── F3 Shop this post */

export function ShopSheet({ post, visible, onClose, surface }) {
  const nav = useNavSafe();
  const [hearts, setHearts] = useState({});
  const [deal, setDeal] = useState(null);           // the deal page's data: colours, sizes, stock (D1, O1)
  const [sizing, setSizing] = useState(null);       // the product in the size sheet (O1)
  const [inBag, setInBag] = useState({});           // product id → size just added (O2)
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeBagCount(setCount), []);
  useEffect(() => {
    if (!post) return;
    let alive = true;
    setDeal(null); setInBag({});
    (async () => {
      const on = {};
      if (await isSignedIn()) for (const id of (post.mine && post.mine.saved_products) || []) on[id] = true;
      else {
        const st = await shopStore.get();
        for (const x of st.savedProducts) if (x.post_id === post.id) on[x.product_id] = true;
      }
      if (alive) setHearts(on);
    })();
    if (visible && followerApi.deal) {
      followerApi.deal(post.id).then((r) => { if (alive && r && r.success) setDeal(r.data); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [post, visible]);

  if (!post) return null;
  async function heart(p) {
    const on = !hearts[p.id];
    setHearts((h) => ({ ...h, [p.id]: on }));
    track(on ? 'save_product' : 'unsave_product', post.id, surface, { product_id: p.id });
    if (await isSignedIn()) {
      const res = on ? await followerApi.saveProduct({ product_id: p.id, post_id: post.id }) : await followerApi.unsaveProduct(p.id);
      if (!res || !res.success) setHearts((h) => ({ ...h, [p.id]: !on }));
    } else {
      await toggleSaveProductLocal({ product_id: p.id, post_id: post.id }, on);
    }
  }
  const first = post.creator ? post.creator.name.split(' ')[0] : '';
  const isDeal = !!(deal ? deal.deal_page : (post.offer && post.offer.type && post.offer.type !== 'discount'));
  const full = (p) => (deal && deal.products.find((x) => x.id === p.id)) || { ...p, colours: [], images: [p.image_url] };
  function openDeal(startProductId) {
    onClose();
    if (nav) nav.navigate('Deal', { postId: post.id, start: startProductId || null });
  }
  function add(p) {
    track('tap_product', post.id, surface, { product_id: p.id });
    if (isDeal) openDeal(p.id); else setSizing(full(p));
  }
  async function addSized(sel) {
    setBusy(true);
    try {
      await addToBag([{ post_id: post.id, product_id: sizing.id, colour: sel.colour, size: sel.size, qty: 1, price_seen: sizing.price }]);
      track('add_to_bag', post.id, surface, { product_id: sizing.id });
      setInBag((m) => ({ ...m, [sizing.id]: sel.size || '' }));
      setSizing(null);
    } finally { setBusy(false); }
  }
  async function buyNow(sel) {
    const lines = [{ post_id: post.id, product_id: sizing.id, colour: sel.colour, size: sel.size, qty: 1, price_seen: sizing.price }];
    setSizing(null); onClose();
    if (!nav) return;
    const go = () => nav.navigate('Checkout', { lines, buyNow: true });
    if (await isSignedIn()) go(); else nav.navigate('FollowerLogin', { onDone: go });
  }
  return (
    <>
      <Modal visible={visible && !sizing} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={s.dim} onPress={onClose} testID="shop-sheet-dim">
          <Pressable style={s.sheet} onPress={() => {}} testID="shop-sheet">
            <View style={s.grab} />
            <View style={[s.rowBetween]}>
              <Text style={s.sheetTitle}>{CS.shopTitle}</Text>
              {post.offer && post.offer.line ? <View style={s.chipOk}><Text style={s.chipOkText}>{post.offer.line}</Text></View> : null}
            </View>
            <Text style={s.mut}>{[post.creator && post.creator.name, post.brand && post.brand.name].filter(Boolean).join(' · ')}</Text>
            {isDeal && deal ? (
              <View style={s.dealBox} testID="deal-intro">
                {deal.offer && deal.offer.how ? <Text style={s.dealHow}>{deal.offer.how}</Text> : null}
                <Text style={s.mut}>{CO.dealCounts(deal.products.length, deal.gifts.length)}</Text>
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: 340 }}>
              {post.products.map((p) => (
                <TouchableOpacity key={p.id} style={s.pline} onPress={() => add(p)} activeOpacity={0.9} testID={`shop-product-${p.id}`}>
                  {p.image_url ? <Image source={{ uri: p.image_url }} style={s.pthumb} /> : <View style={s.pthumb} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.pname} numberOfLines={2}>{p.name}</Text>
                    <Text style={s.pprice}>
                      <Text style={{ fontFamily: fonts.sansBold, color: C.ink }}>{inr(p.shopper_price)}</Text>
                      {p.struck ? <Text style={s.struck}>  {inr(p.price)}</Text> : null}
                    </Text>
                    {!p.in_stock ? <Text style={s.oos}>{CS.outOfStock}</Text> : null}
                    {inBag[p.id] !== undefined ? <Text style={s.inBag} testID={`in-bag-${p.id}`}>{CO.inYourBag(inBag[p.id])}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => heart(p)} style={s.heartBtn} testID={`shop-heart-${p.id}`} accessibilityState={{ selected: !!hearts[p.id] }} accessibilityLabel={hearts[p.id] ? 'Saved with this post' : 'Save with this post'}>
                    <Icon name={hearts[p.id] ? 'heart' : 'heart-outline'} size={22} color={hearts[p.id] ? '#C42B2B' : C.ink} />
                  </TouchableOpacity>
                  {p.in_stock ? (
                    <TouchableOpacity onPress={() => add(p)} style={s.addBtn} testID={`shop-add-${p.id}`}><Text style={s.addText}>{CO.add}</Text></TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {post.gift_line ? <Text style={s.giftLine}>{post.gift_line}</Text> : null}
            {!isDeal && post.offer && post.offer.how ? <Text style={s.hint}>{post.offer.how}</Text> : null}
            <Text style={s.hint}>{CS.noCodeNeeded(first)} {CS.heartKeepsOffer}</Text>
            {isDeal ? <PrimaryBtn label={CO.buildDeal} onPress={() => openDeal(null)} testID="build-deal" />
              : count > 0 ? <PrimaryBtn label={CO.goToBag(count)} onPress={() => { onClose(); if (nav) nav.navigate('Bag'); }} testID="go-to-bag" secondary /> : null}
          </Pressable>
        </Pressable>
      </Modal>
      <SizeSheet post={post} product={sizing} visible={!!sizing} onClose={() => setSizing(null)} onAdd={addSized} onBuyNow={buyNow} busy={busy} />
    </>
  );
}

/* ───────────────────────────────────────────── sign-in sheet (F6) */

export function SignInSheet({ visible, onClose, onSignIn }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}} testID="sign-in-sheet">
          <View style={s.grab} />
          <Text style={s.sheetTitle}>{CS.signInTitle}</Text>
          <Text style={s.mut}>{CS.signInBody}</Text>
          <PrimaryBtn label={CS.signInCta} onPress={onSignIn} testID="sign-in-cta" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function PrimaryBtn({ label, onPress, disabled, testID, secondary }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} testID={testID}
      style={[s.btn, secondary ? s.btnSec : s.btnPri, disabled && s.btnDis]} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}>
      <Text style={[s.btnText, disabled && { color: T.disabledText }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ───────────────────────────────────────────── 2 × 2 tiles (F7, F9) */

export function Tile({ post, onPress, testID }) {
  const img = post.media_kind === 'image' && post.media[0] ? post.media[0].url : (post.products[0] ? post.products[0].image_url : null);
  return (
    <TouchableOpacity style={s.tile} onPress={onPress} testID={testID}>
      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {post.media_kind === 'video' ? <View style={s.tileVid}><Icon name="play" size={12} color="#fff" /></View> : null}
      {post.offer && post.offer.badge ? <View style={s.tileBadge}><Text style={s.tileBadgeText} numberOfLines={1}>{post.offer.badge}</Text></View>
        : post.facets && post.facets.price_band ? <View style={s.tileBadge}><Text style={s.tileBadgeText} numberOfLines={1}>{post.facets.price_band}</Text></View> : null}
    </TouchableOpacity>
  );
}

export function TileGrid({ posts, onOpen, testIDPrefix = 'tile' }) {
  const rows = [];
  for (let i = 0; i < posts.length; i += 2) rows.push(posts.slice(i, i + 2));
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <View key={r[0].id} style={{ flexDirection: 'row', gap: 6 }}>
          {r.map((p, k) => <Tile key={p.id} post={p} onPress={() => onOpen(p, posts)} testID={`${testIDPrefix}-${p.id}`} />)}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────────────────────── small states */

export function Loading({ dark }) {
  return <View style={[s.center, { padding: 40 }]}><ActivityIndicator color={dark ? '#fff' : C.ink} /></View>;
}

export function Empty({ title, sub, action, onAction, testID, dark }) {
  return (
    <View style={[s.empty, dark && { borderColor: '#333' }]} testID={testID}>
      <Text style={[s.emptyTitle, dark && { color: '#fff' }]}>{title}</Text>
      {sub ? <Text style={[s.mut, { textAlign: 'center' }, dark && { color: '#aaa' }]}>{sub}</Text> : null}
      {action ? <PrimaryBtn label={action} onPress={onAction} secondary /> : null}
    </View>
  );
}

export function Chip({ label, on, onPress, testID }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, on && s.chipOn]} testID={testID} accessibilityState={{ selected: !!on }}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const s = StyleSheet.create({
  dealBox: { backgroundColor: '#FFF3C4', borderRadius: 12, padding: 10, marginTop: 8, marginBottom: 4 },
  dealHow: { fontFamily: fonts.sansBold, fontSize: 12.5, color: '#6B5A00', marginBottom: 2 },
  addBtn: { borderWidth: 1.5, borderColor: '#1A1A17', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 4 },
  addText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: '#1A1A17' },
  inBag: { fontFamily: fonts.sansBold, fontSize: 11.5, color: '#1A7A3D', marginTop: 3 },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, backgroundColor: '#fff' },
  wordmark: { flex: 1, fontFamily: fonts.sansBold, fontSize: 18, letterSpacing: -0.4, color: C.ink },
  title: { flex: 1, fontFamily: fonts.sansBold, fontSize: 16, color: C.ink },
  ic: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  icDark: { borderColor: '#333' },
  icText: { fontSize: 17, color: C.ink, fontFamily: fonts.sansBold },
  rowLbl: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase' },
  cir: { width: 56, alignItems: 'center', gap: 3 },
  cirRing: { borderRadius: 30, padding: 2, borderWidth: 2, borderColor: C.border },
  cirRingOn: { borderColor: C.primary, borderWidth: 2.5 },
  cirName: { fontFamily: fonts.sansMedium, fontSize: 10, color: C.ink2, maxWidth: 56 },
  post: { borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  ph: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  phName: { fontFamily: fonts.sansBold, fontSize: 12.5, color: C.ink },
  phSub: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: C.ink2 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 10.5 },
  shopBtn: { position: 'absolute', bottom: 8, left: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' },
  shopText: { fontFamily: fonts.sansBold, fontSize: 12, color: C.ink },
  acts: { flexDirection: 'row', gap: 14, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2, alignItems: 'center' },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  act: { fontFamily: fonts.sansBold, fontSize: 12, color: C.ink2 },
  caption: { paddingHorizontal: 10, paddingBottom: 10, fontFamily: fonts.sansRegular, fontSize: 12, color: C.ink2 },
  dots: { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: '#fff' },
  playMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  vidTitle: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 13, textAlign: 'center' },
  vidSub: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.sansRegular, fontSize: 11.5, textAlign: 'center', marginTop: 2 },
  dim: { flex: 1, backgroundColor: 'rgba(26,26,23,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 18, gap: 10 },
  grab: { width: 36, height: 4, borderRadius: 4, backgroundColor: '#D9D8D1', alignSelf: 'center' },
  sheetTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: C.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  chipOk: { backgroundColor: T.state.active.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  chipOkText: { color: T.state.active.fg, fontFamily: fonts.sansBold, fontSize: 11 },
  mut: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink2 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: C.ink2 },
  pline: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  pthumb: { width: 40, height: 50, borderRadius: 8, backgroundColor: '#EFEFEA' },
  pname: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: C.ink },
  pprice: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink2, marginTop: 1 },
  struck: { textDecorationLine: 'line-through', color: C.ink3, fontSize: 11 },
  oos: { fontFamily: fonts.sansBold, fontSize: 11, color: T.danger, marginTop: 1 },
  heartBtn: { padding: 6 },
  heart: { fontSize: 18, color: C.ink },
  giftLine: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: C.ink },
  soon: { backgroundColor: C.surface, borderRadius: 12, padding: 10 },
  soonText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: C.ink2 },
  btn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnPri: { backgroundColor: C.primary },
  btnSec: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.ink },
  btnDis: { backgroundColor: T.disabledBg, borderColor: T.disabledBg },
  btnText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: C.ink },
  tile: { flex: 1, aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E9E8E2' },
  tileVid: { position: 'absolute', right: 6, top: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  tileVidText: { color: '#fff', fontSize: 10 },
  tileBadge: { position: 'absolute', left: 6, bottom: 6, right: 6, alignSelf: 'flex-start' },
  tileBadgeText: { alignSelf: 'flex-start', fontFamily: fonts.sansBold, fontSize: 9.5, color: C.ink, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, borderRadius: 14, padding: 18, alignItems: 'center', gap: 8, margin: 14 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: C.ink },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff' },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: C.ink2 },
});
