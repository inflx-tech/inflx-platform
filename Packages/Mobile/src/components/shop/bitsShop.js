/**
 * The shopper app's shared parts (follower-app-v2 · boards F2–F12): the top bar, the circles, the
 * post card, Shop this post, the 2 × 2 tiles, the video block, the sign-in sheet.
 *
 * Every purchase goes through a post (P1), so every post carries Shop this post. Liking and
 * commenting need sign-in; saving and following work for guests and stay on the phone (5.2).
 * Ordering (shopper-ordering, v1.13 §6): Shop this post has Add (a simple post → the size sheet,
 * O1/O2) or Build your deal (a deal post → its deal page, D1); the bag sits in the top bar.
 *
 * shopper-walk-fixes (board V1, V3, S1, S2, S5): a video in a feed never takes the tap; a tile of a
 * video shows the video's own picture; the sheet is "Products in this post" — a grid of three with
 * a bag icon on each product (quick add) and the photo opening the product page; "Build your deal"
 * is decided by the server's `deal_page`, never guessed.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList, Modal, ScrollView, Share, StyleSheet, Dimensions,
  ActivityIndicator, Pressable,
} from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { track } from '../../services/events';
import { CS, inr, initialsOf, fmtCount } from './copyShop';
import { shopStore, isSignedIn, toggleSavePostLocal, toggleSaveProductLocal } from './shopStore';
import { engaged } from './engaged';
import ShopVideo, { videoStill } from './ShopVideo';
import { useFeedSound } from './feedSound';
import { BagButton, SizeSheet, useAdded, useNavSafe } from './orderBits';
import { CO, dayLabel } from './copyOrder';
import { addToBag, peekBag, subscribeBagCount, noteAddedAlone } from './bag';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const C = { ...T, ink: '#1A1A17', dark: '#111111' };
const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;
const TILE3 = Math.floor((W - 28 - 16) / 3);        // a grid of three inside the sheet (S1)

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
 * A post's video (4.7): the player on phones with the new app build, otherwise the video's picture
 * with "Update INFLX to play videos" — see ShopVideo.
 */
export function VideoView(props) {
  return <ShopVideo {...props} />;
}

/**
 * A video in a feed card (shopper-feed-sound-comments-sheet · board S1): silent until she turns
 * the sound on with the button at its bottom-left. One choice for every feed video (feedSound).
 * V1 still holds — no pause layer, and the video itself takes no tap, so a tap anywhere but the
 * button reaches the card and the card opens it full screen in Play.
 */
function FeedVideo({ post, height, active, surface }) {
  const [sound, setSound] = useFeedSound();
  return <VideoView post={post} height={height} active={active} surface={surface} muted={!sound} soundToggle soundAt="bottom-left" onSoundChange={setSound} />;
}

function Slides({ post, width, height, active, surface }) {
  const [i, setI] = useState(0);
  const media = post.media || [];
  if (post.media_kind === 'video') return <FeedVideo post={post} height={height} active={active} surface={surface} />;
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
 *
 * shopper-app-fixes (F14): what she has done to this post since the app opened (`engaged`) is read
 * first — before the copy of the post this screen was handed, which is as old as the feed it came
 * from — and every card and reel of the same post follows it. So a like or a bookmark she has just
 * given shows on the next screen, and on the one she comes back to.
 */
export function usePostActions(post, { surface, onNeedSignIn }) {
  const done = engaged.post(post.id) || {};
  const [liked, setLiked] = useState(done.liked !== undefined ? !!done.liked : !!(post.mine && post.mine.liked));
  const [likes, setLikes] = useState(done.likes !== undefined ? done.likes : (post.counts && post.counts.likes) || 0);
  const [saved, setSaved] = useState(done.saved !== undefined ? !!done.saved : !!(post.mine && post.mine.saved));
  // shopper-feed-sound-comments-sheet: the comments now open over this card, so the number on it
  // follows what the sheet last read (and what she has just written) instead of the feed's copy.
  const [comments, setComments] = useState(done.comments !== undefined ? done.comments : (post.counts && post.counts.comments) || 0);

  useEffect(() => engaged.subscribe((id, now) => {
    if (id !== post.id) return;
    if (now.liked !== undefined) setLiked(!!now.liked);
    if (now.likes !== undefined) setLikes(now.likes);
    if (now.saved !== undefined) setSaved(!!now.saved);
    if (now.comments !== undefined) setComments(now.comments);
  }), [post.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (await isSignedIn()) return;
      const st = await shopStore.get();
      // What she did a moment ago (engaged) is newer than what the phone had when this was read.
      if (alive && (engaged.post(post.id) || {}).saved === undefined) setSaved(st.savedPosts.includes(post.id));
    })();
    return () => { alive = false; };
  }, [post.id]);

  const like = useCallback(async () => {
    if (!(await isSignedIn())) { onNeedSignIn && onNeedSignIn(); return; }
    const on = !liked;
    const was = likes;
    // Shown at once, on every card of this post (they all listen to `engaged`).
    engaged.setPost(post.id, { liked: on, likes: Math.max(0, was + (on ? 1 : -1)) });
    track(on ? 'like' : 'unlike', post.id, surface);
    const res = on ? await followerApi.like(post.id) : await followerApi.unlike(post.id);
    if (res && res.success) engaged.setPost(post.id, { likes: res.data.likes });
    else engaged.setPost(post.id, { liked: !on, likes: was });
  }, [liked, likes, post.id, surface, onNeedSignIn]);

  const save = useCallback(async () => {
    const on = !saved;
    engaged.setPost(post.id, { saved: on });
    track(on ? 'save' : 'unsave', post.id, surface);
    if (await isSignedIn()) {
      const res = on ? await followerApi.save(post.id) : await followerApi.unsave(post.id);
      if (!res || !res.success) engaged.setPost(post.id, { saved: !on });
    } else {
      await toggleSavePostLocal(post.id, on);
    }
  }, [saved, post.id, surface]);

  const share = useCallback(async () => {
    track('share', post.id, surface);
    try { await Share.share({ message: `${post.title || CS.shopThisPost} · ${post.creator ? post.creator.name : ''}\n${post.share_url}` }); } catch { /* dismissed */ }
  }, [post, surface]);

  return { liked, likes, saved, comments, like, save, share };
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
          <View style={s.actRow}><Icon name="comment-outline" size={18} color={C.ink} /><Text style={s.act} testID={`post-comments-n-${post.id}`}>{fmtCount(a.comments)}</Text></View>
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

/* ───────────────────────────────────────────── F3 Products in this post (S1, S2) */

/**
 * Does this post open a deal page ("Build your deal")? The server says (`deal_page`); a discount or
 * price post never does. Once the deal data has arrived, it is the one that says. An older server
 * answer has no `deal_page`: then it is a deal only when `offer.kind` names one — never guessed
 * from `offer.type`, which is a display name ("Discount") and made every discount post flash
 * "Build your deal" until the deal data came (O1).
 */
export function isDealPost(post, deal) {
  if (deal) return !!deal.deal_page;
  if (!post) return false;
  if (typeof post.deal_page === 'boolean') return post.deal_page;
  return !!(post.offer && post.offer.kind) && post.offer.kind !== 'discount';
}

/**
 * The ♡ on a product: it is kept with its post, so it keeps the post's offer (5.8). A guest's stays
 * on the phone. Resolves false when her account could not keep it, so the heart can go back.
 * What was kept is remembered for the session (F14), so the sheet shows it the next time it opens.
 */
export async function heartProduct(postId, productId, on, surface) {
  track(on ? 'save_product' : 'unsave_product', postId, surface, { product_id: productId });
  if (await isSignedIn()) {
    const res = on ? await followerApi.saveProduct({ product_id: productId, post_id: postId }) : await followerApi.unsaveProduct(productId);
    if (!res || !res.success) return false;
  } else {
    await toggleSaveProductLocal({ product_id: productId, post_id: postId }, on);
  }
  engaged.setHeart(productId, on, { post_id: postId });
  return true;
}

/** Has the list been scrolled to (nearly) its end? For the pages whose posts sit in a scrolling page (N5). */
export function nearEnd(e, within = 600) {
  const n = e && e.nativeEvent;
  if (!n || !n.layoutMeasurement || !n.contentOffset || !n.contentSize) return false;
  return n.layoutMeasurement.height + n.contentOffset.y >= n.contentSize.height - within;
}

/** One product of the grid: the photo opens its page; the heart saves it; the bag icon adds it. */
function ProductTile({ p, saved, inBagSize, onOpen, onHeart, onBag }) {
  return (
    <View style={s.pt} testID={`shop-tile-${p.id}`}>
      <View>
        <TouchableOpacity onPress={onOpen} activeOpacity={0.9} testID={`shop-product-${p.id}`} accessibilityLabel={p.name}>
          {p.image_url ? <Image source={{ uri: p.image_url }} style={s.ptImg} resizeMode="cover" /> : <View style={s.ptImg} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={onHeart} style={s.ptHeart} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} testID={`shop-heart-${p.id}`}
          accessibilityState={{ selected: !!saved }} accessibilityLabel={saved ? CO.savedProduct : CO.saveProduct}>
          <Icon name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? '#C42B2B' : C.ink} />
        </TouchableOpacity>
        {p.in_stock ? (
          <TouchableOpacity onPress={onBag} style={s.ptBag} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID={`shop-add-${p.id}`}
            accessibilityRole="button" accessibilityLabel={CO.addProduct(p.name)}>
            <Icon name="shopping-outline" size={15} color={C.ink} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={s.ptName} numberOfLines={2}>{p.name}</Text>
      <Text style={s.ptPrice}>
        <Text style={{ fontFamily: fonts.sansBold, color: C.ink }}>{inr(p.shopper_price)}</Text>
        {p.struck ? <Text style={s.struck}>  {inr(p.price)}</Text> : null}
      </Text>
      {!p.in_stock ? <Text style={s.oos}>{CS.outOfStock}</Text> : null}
      {inBagSize !== undefined ? <Text style={s.inBag} testID={`in-bag-${p.id}`}>{CO.inYourBag(inBagSize)}</Text> : null}
    </View>
  );
}

export function ShopSheet({ post, visible, onClose, surface }) {
  const nav = useNavSafe();
  const [hearts, setHearts] = useState({});
  const [deal, setDeal] = useState(null);           // the deal page's data: colours, sizes, stock (D1, O1)
  const [dealFailed, setDealFailed] = useState(false);
  const [ended, setEnded] = useState(null);         // N1: the server's own sentence — the post has left the shop
  const [again, setAgain] = useState(0);            // N1: "Try again" asks for the deal data once more
  const [sizing, setSizing] = useState(null);       // the id of the product in the size sheet (O1)
  const [inBag, setInBag] = useState({});           // product id → the size of it in her bag (O2)
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [away, setAway] = useState(false);          // her product page is open over this screen (O3)
  const awayRef = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  // O6: a second after the add, if she did nothing, the size sheet and this sheet both close and
  // she is on the post she was on.
  const flash = useAdded(() => { flash.reset(); setSizing(null); close.current(); });
  useEffect(() => subscribeBagCount(setCount), []);
  useEffect(() => {
    if (!post) return undefined;
    let alive = true;
    setDeal(null); setDealFailed(false); setEnded(null); setInBag({});
    awayRef.current = false; setAway(false);
    (async () => {
      const on = {};
      if (await isSignedIn()) for (const id of (post.mine && post.mine.saved_products) || []) on[id] = true;
      else {
        const st = await shopStore.get();
        for (const x of st.savedProducts) if (x.post_id === post.id) on[x.product_id] = true;
      }
      // F14: `post.mine` is as old as the feed this post came from. What she hearted (or took
      // off) since the app opened is the newer word.
      for (const p of post.products || []) on[p.id] = engaged.heartedInPost(post.id, p.id, on[p.id]);
      if (alive) setHearts(on);
    })();
    if (visible) {
      if (followerApi.deal) {
        followerApi.deal(post.id)
          .then((r) => {
            if (!alive) return;
            if (r && r.success) setDeal(r.data);
            // N1: an ended post answers "not found" with its own sentence — that is not a failed load.
            else if (r && r.error && r.error.code === 'NOT_FOUND' && r.error.message) setEnded(r.error.message);
            else setDealFailed(true);
          })
          .catch(() => { if (alive) setDealFailed(true); });
      }
      // An add closes this sheet now, so "✓ In your bag" is read from her bag each time it opens.
      (async () => {
        const mine = {};
        for (const l of await peekBag()) if (l.post_id === post.id && l.product_id && l.role !== 'gift') mine[l.product_id] = l.size || '';
        if (alive) setInBag((m) => ({ ...mine, ...m }));
      })().catch(() => {});
    }
    return () => { alive = false; };
  }, [post, visible, again]);
  // She left the product page some way other than Back (an order placed, say): nothing stays open.
  useEffect(() => {
    if (!nav || typeof nav.addListener !== 'function') return undefined;
    return nav.addListener('focus', () => {
      if (!awayRef.current) return;
      awayRef.current = false; setAway(false);
      close.current();
    });
  }, [nav]);

  if (!post) return null;
  async function heart(p) {
    const on = !hearts[p.id];
    setHearts((h) => ({ ...h, [p.id]: on }));
    if (!(await heartProduct(post.id, p.id, on, surface))) setHearts((h) => ({ ...h, [p.id]: !on }));
  }
  const first = post.creator ? post.creator.name.split(' ')[0] : '';
  const isDeal = isDealPost(post, deal);
  // shopper-deal-orders (B4): may one product of this deal post be bought alone? The server says —
  // in the deal data once it has come, on the post's card before that. An older server says
  // nothing: then the bag icon opens the deal page, as it always did.
  const alone = isDeal && (deal ? deal.buy_alone === true : post.buy_alone === true);
  const offer = (deal && deal.offer) || post.offer || null;
  const dealLine = offer ? offer.line || offer.deal || null : null;
  const dealHow = offer ? offer.how || null : null;
  const dealTill = offer && offer.ends_on ? CO.till(dayLabel(offer.ends_on).replace(/^\w+, /, '')) : null;
  const full = (p) => (deal && deal.products.find((x) => x.id === p.id)) || { ...p, colours: [], images: [p.image_url] };
  const sized = sizing ? post.products.find((p) => p.id === sizing) : null;
  const sizingProduct = sized ? full(sized) : null;
  function openDeal(startProductId) {
    onClose();
    if (nav) nav.navigate('Deal', { postId: post.id, start: startProductId || null });
  }
  // The bag icon on a product: the size sheet (the quick add) — also on a deal post whose
  // products can be bought alone (B4). Buy one get one, and a set sold only whole, open the deal
  // page with that product started.
  function add(p) {
    track('tap_product', post.id, surface, { product_id: p.id });
    if (isDeal && !alone) openDeal(p.id); else setSizing(p.id);
  }
  // "Or get it in the offer ›" in the size sheet: the deal page, with the product she was sizing started.
  function offerFromSizing() {
    const id = sizing;
    flash.reset(); setSizing(null);
    openDeal(id);
  }
  // The photo: the product's own page (S3, S4). This sheet steps aside without being closed, so
  // Back brings her to it, open, on the page she came from.
  function openProduct(p) {
    track('tap_product', post.id, surface, { product_id: p.id });
    if (!nav) return;
    awayRef.current = true; setAway(true);
    nav.navigate('ShopProduct', {
      postId: post.id, productId: p.id, post, data: deal, surface, saved: !!hearts[p.id],
      onHeart: (on) => setHearts((h) => ({ ...h, [p.id]: !!on })),
      onBack: () => { awayRef.current = false; setAway(false); },
      onDone: () => { awayRef.current = false; setAway(false); close.current(); },
    });
  }
  function closeSizing() {
    if (flash.added) { flash.reset(); setSizing(null); onClose(); return; }      // already added: nothing left open
    setSizing(null);
  }
  async function addSized(sel) {
    const p = sizingProduct;
    setBusy(true);
    try {
      await addToBag([{ post_id: post.id, product_id: p.id, colour: sel.colour, size: sel.size, qty: 1, price_seen: sel.price_seen != null ? sel.price_seen : p.price }]);
      if (alone) noteAddedAlone(post.id);
      track('add_to_bag', post.id, surface, { product_id: p.id });
      setInBag((m) => ({ ...m, [p.id]: sel.size || '' }));
      flash.start();
    } finally { setBusy(false); }
  }
  function goToBag() {
    flash.reset(); setSizing(null); onClose();
    if (nav) nav.navigate('Bag');
  }
  async function buyNow(sel) {
    const p = sizingProduct;
    const lines = [{ post_id: post.id, product_id: p.id, colour: sel.colour, size: sel.size, qty: 1, price_seen: sel.price_seen != null ? sel.price_seen : p.price }];
    flash.reset(); setSizing(null); onClose();
    if (!nav) return;
    const go = () => nav.navigate('Checkout', { lines, buyNow: true });
    if (await isSignedIn()) go(); else nav.navigate('FollowerLogin', { onDone: go, reason: 'order' });
  }
  // N1 — the post has left the shop: the sheet says so in the server's words, and offers nothing to buy.
  if (ended) {
    return (
      <Modal visible={visible && !away} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={s.dim} onPress={onClose} testID="shop-sheet-dim">
          <Pressable style={s.sheet} onPress={() => {}} testID="shop-sheet">
            <View style={s.grab} />
            <View style={s.rowBetween}>
              <Text style={s.sheetTitle}>{CS.shopTitle}</Text>
              <TouchableOpacity onPress={onClose} style={s.xBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="shop-sheet-close"
                accessibilityRole="button" accessibilityLabel={CS.close}>
                <Icon name="close" size={18} color={C.ink2} />
              </TouchableOpacity>
            </View>
            <Text style={s.giftLine} testID="shop-sheet-ended">{ended}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }
  return (
    <>
      <Modal visible={visible && !sizing && !away} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={s.dim} onPress={onClose} testID="shop-sheet-dim">
          <Pressable style={s.sheet} onPress={() => {}} testID="shop-sheet">
            <View style={s.grab} />
            <View style={s.rowBetween}>
              <Text style={s.sheetTitle}>{CS.shopTitle}</Text>
              <TouchableOpacity onPress={onClose} style={s.xBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="shop-sheet-close"
                accessibilityRole="button" accessibilityLabel={CS.close}>
                <Icon name="close" size={18} color={C.ink2} />
              </TouchableOpacity>
            </View>
            <View style={s.rowBetween}>
              <Text style={[s.mut, s.oneLine]} numberOfLines={1} ellipsizeMode="tail" testID="shop-sheet-who">
                {CS.sheetWho(post.products.length, first, post.brand && post.brand.name)}
              </Text>
              {!isDeal && post.offer && post.offer.line ? <View style={s.chipOk}><Text style={s.chipOkText}>{post.offer.line}</Text></View> : null}
            </View>
            {isDeal && (dealLine || dealHow) ? (
              <View style={s.dealBox} testID="deal-intro">
                {dealLine ? <Text style={s.dealLine}>{dealLine}</Text> : null}
                {dealHow || dealTill ? <Text style={s.dealHow}>{[dealHow, dealTill].filter(Boolean).join(' ')}</Text> : null}
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: Math.round(H * 0.46) }}>
              <View style={s.g3} testID="shop-grid">
                {post.products.map((p) => (
                  <ProductTile key={p.id} p={full(p).sold_out ? { ...p, in_stock: false } : p} saved={!!hearts[p.id]} inBagSize={inBag[p.id]}
                    onOpen={() => openProduct(p)} onHeart={() => heart(p)} onBag={() => add(p)} />
                ))}
              </View>
            </ScrollView>
            {post.gift_line ? <Text style={s.giftLine}>{post.gift_line}</Text> : null}
            {!isDeal && post.offer && post.offer.how ? <Text style={s.hint}>{post.offer.how}</Text> : null}
            <Text style={s.hint}>{CS.noCodeNeeded(first)} {CS.heartKeepsOffer}</Text>
            {/* N1 — the sizes and stock could not be fetched: say so here, with a way to ask again. */}
            {dealFailed && !deal ? (
              <View style={s.rowBetween} testID="shop-sheet-failed">
                <Text style={[s.oos, s.oneLine]}>{CS.loadError}</Text>
                <TouchableOpacity onPress={() => setAgain((n) => n + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="shop-sheet-retry" accessibilityRole="button">
                  <Text style={s.retry}>{CS.retry}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {isDeal ? <PrimaryBtn label={CO.buildDeal} onPress={() => openDeal(null)} testID="build-deal" />
              : count > 0 ? <PrimaryBtn label={CO.goToBag(count)} onPress={() => { onClose(); if (nav) nav.navigate('Bag'); }} testID="go-to-bag" secondary /> : null}
          </Pressable>
        </Pressable>
      </Modal>
      {/* The sizes come with the deal data: until it has arrived nothing can be added without one. */}
      <SizeSheet post={post} product={sizingProduct} visible={!!sizingProduct} onClose={closeSizing} onAdd={addSized} onBuyNow={buyNow}
        busy={busy} waiting={!deal && !dealFailed} problem={!deal && dealFailed ? CS.loadError : null} added={flash.added} onGoToBag={goToBag}
        offerLink={alone && dealLine ? { text: CO.orInOffer(dealLine), onPress: offerFromSizing } : null} />
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

/**
 * One post in a grid. A photo post shows its photo. A video post shows a picture taken from the
 * video itself (V3), with the ▶ mark; only a video that has none shows its first product's photo.
 */
export function Tile({ post, onPress, testID }) {
  const media = (post.media || [])[0];
  const img = post.media_kind === 'video' ? videoStill(post)
    : media ? media.url : (post.products && post.products[0] ? post.products[0].image_url : null);
  return (
    <TouchableOpacity style={s.tile} onPress={onPress} testID={testID}>
      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" testID={testID ? `${testID}-img` : undefined} /> : null}
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
  // S2: the deal and how it works, said to the shopper, above the grid.
  dealBox: { backgroundColor: T.primarySoft, borderRadius: 14, padding: 10, gap: 3 },
  dealLine: { fontFamily: fonts.sansBold, fontSize: 14, color: C.ink },
  dealHow: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: C.ink2, lineHeight: 16 },
  inBag: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#1A7A3D', marginTop: 1 },
  // S1: a grid of three — large photo (4:5), the heart top-right, the round bag button bottom-right.
  xBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  oneLine: { flex: 1, minWidth: 0 },
  g3: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  pt: { width: TILE3, gap: 2 },
  ptImg: { width: TILE3, height: Math.round(TILE3 * 1.25), borderRadius: 10, backgroundColor: '#EFEFEA' },
  ptHeart: { position: 'absolute', right: 5, top: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
  ptBag: { position: 'absolute', right: 5, bottom: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  ptName: { fontFamily: fonts.sansBold, fontSize: 11.5, lineHeight: 14.5, color: C.ink, marginTop: 2 },
  ptPrice: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: C.ink2 },
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
  retry: { fontFamily: fonts.sansBold, fontSize: 12.5, color: C.ink, textDecorationLine: 'underline' },
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
