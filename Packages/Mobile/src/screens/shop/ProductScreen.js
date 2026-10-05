/**
 * S3 · S4 The product page — a full screen for one product of a post (shopper-walk-fixes · O3).
 * Contract: features/shopper-walk-fixes · board S3, S4, S5 · spec W5–W7, W10
 *
 * She opens it by tapping a product's photo in "Products in this post". It shows everything the
 * brand entered when listing the product, in one fixed order: photos to swipe (the chosen colour's
 * own when it has some), the name and the brand it is listed under, the price after the offer,
 * colour, size with stock, then Brand · Category · every listed detail · Returns, then the
 * description, and who sells it. Nothing INFLX does not hold is drawn: no rating, no reviews, no
 * MRP, no tax line.
 *
 *   a discount or price post   Buy now · Add to bag — the same two actions the size sheet has
 *   a deal post                shopper-deal-orders (board B1–B3) — the server says (`buy_alone`):
 *     can be bought alone      "Buy this alone · ₹1,999" over Buy now · Add to bag (its normal price),
 *                              and "In an offer: Any 3 for ₹2,999 · See offer ›" (bundle, buy more
 *                              save more, a gift offer, a set whose brand allows its pieces alone)
 *     buy one get one          "Buy one, get one free. Pick your free one next." · Get this offer
 *     a set sold only whole    "Sold as a set." · Build your deal
 *                              (See offer, Get this offer and Build your deal open the deal page with
 *                              this product started; an older server sends no `buy_alone`: Build your deal)
 *
 * Leaving it (W10):
 *   Back                        the "Products in this post" sheet is there again, open
 *   Add to bag, then nothing    one vibration, "Go to bag ›" for about a second, then this page
 *                               closes by itself and the sheet does NOT come back
 *   Go to bag ›, Buy now, Build your deal    the sheet stays closed
 *
 * route.params: { postId, productId, post?, data?, surface?, saved?, onHeart?, onBack?, onDone? }
 *   `data` is the deal data the sheet already holds; without it the page asks for it itself.
 *
 * shopper-app-fixes:
 *   N1  A post that has ended says the server's own sentence ("This post is no longer in the shop");
 *       a load that really failed says "Couldn't load" and has Try again.
 *   F14 Opened without the sheet's answer, the heart is what she did this session (engaged).
 *   N2  Buy now as a guest: the sign-in screen is told she is signing in to place her order.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../services/api';
import { track } from '../../services/events';
import { TopBar, Loading, Empty, heartProduct, s as bs } from '../../components/shop/bitsShop';
import {
  BagButton, Photos, ChoicePicker, ProductDetails, AddedLine, AddToBagButton, useAdded, hasChoices, firstColour, inFront, priceFor, K, b,
} from '../../components/shop/orderBits';
import { CO } from '../../components/shop/copyOrder';
import { CS, inr } from '../../components/shop/copyShop';
import { addToBag, noteAddedAlone } from '../../components/shop/bag';
import { shopStore, isSignedIn } from '../../components/shop/shopStore';
import { engaged } from '../../components/shop/engaged';
import { fonts } from '../../theme/tokens';

const W = Dimensions.get('window').width;
const GALLERY = Math.round(W * 1.02);

export default function ProductScreen({ navigation, route }) {
  const params = route.params || {};
  // What she does here is recorded against the page she came from (home, post, play, offers). The
  // server refuses a whole batch for a surface it does not know, so the fallback is one it does.
  const { postId, productId, post = null, data: given = null, surface = 'post' } = params;
  const [data, setData] = useState(given);
  const [status, setStatus] = useState(given ? 'ready' : 'loading');
  const [sel, setSel] = useState({ colour: null, size: null });
  // The sheet says whether it is hearted; opened without it, what she did this session says (F14).
  const [saved, setSaved] = useState(params.saved !== undefined ? !!params.saved : engaged.heartedInPost(postId, productId, false));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ended, setEnded] = useState(null);   // N1: the server's own sentence — the post has left the shop
  const [again, setAgain] = useState(0);      // N1: "Try again"
  const gone = useRef(false);       // the sheet has been told once how she left
  // O6: a second after the add, if she is still here and did nothing, the page closes by itself.
  const flash = useAdded(() => { if (inFront(navigation)) leave(); });

  useEffect(() => {
    if (given) return undefined;
    let alive = true;
    (async () => {
      const r = await followerApi.deal(postId);
      if (!alive) return;
      if (!r || !r.success) {
        // An ended post answers "not found" with its own sentence; anything else is a failed load.
        setEnded(r && r.error && r.error.code === 'NOT_FOUND' && r.error.message ? r.error.message : null);
        setStatus('error');
        return;
      }
      setData(r.data); setStatus('ready');
    })();
    return () => { alive = false; };
  }, [postId, again]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened without the sheet's answer: a guest's heart is read from the phone.
  useEffect(() => {
    if (params.saved !== undefined) return undefined;
    let alive = true;
    (async () => {
      if (await isSignedIn()) return;
      const st2 = await shopStore.get();
      if (alive) setSaved(st2.savedProducts.some((x) => x.product_id === productId && x.post_id === postId));
    })();
    return () => { alive = false; };
  }, [postId, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The phone's own Back (or a swipe) is Back too: the sheet is there again.
  useEffect(() => {
    if (typeof navigation.addListener !== 'function') return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      const type = e && e.data && e.data.action ? e.data.action.type : null;
      if (gone.current || (type !== 'GO_BACK' && type !== 'POP')) return;
      gone.current = true;
      if (params.onBack) params.onBack();
    });
  }, [navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const product = useMemo(() => (data && Array.isArray(data.products) ? data.products.find((x) => x.id === productId) || null : null), [data, productId]);
  const images = useMemo(() => {
    if (!product) return [];
    const c = (product.colours || []).find((x) => x.colour && x.colour === sel.colour);
    if (c && c.images && c.images.length) return c.images;
    return product.images && product.images.filter(Boolean).length ? product.images : [product.image_url];
  }, [product, sel.colour]);

  /** Any way out that is not Back: the sheet must not come back. */
  function done() {
    if (gone.current) return;
    gone.current = true;
    if (params.onDone) params.onDone();
  }
  function back() {
    if (!gone.current) { gone.current = true; if (params.onBack) params.onBack(); }
    navigation.goBack();
  }
  function leave() {
    done();
    navigation.goBack();
  }

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar title=" " onBack={back} right={<BagButton />} /><Loading /></SafeAreaView>;
  if (status === 'error' || !product) {
    const failed = status === 'error' && !ended;      // a real failed load: she can ask again
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title=" " onBack={back} right={<BagButton />} />
        <Empty title={status === 'error' ? ended || CS.loadError : CO.productGone} testID="product-gone"
          action={failed ? CS.retry : null} onAction={() => { setStatus('loading'); setAgain((n) => n + 1); }} />
      </SafeAreaView>
    );
  }

  const isDeal = !!data.deal_page;
  // shopper-deal-orders (B1–B3): on a deal post the server says whether one product may be bought
  // alone, at its normal price. Buy one get one never; a set only when its brand allows it.
  const alone = isDeal && data.buy_alone === true;
  const sub = data.offer ? data.offer.sub_type : null;
  const offerLine = data.offer && data.offer.line ? data.offer.line : null;
  const creator = (data.post && data.post.creator) || (post && post.creator) || null;
  const brand = (data.post && data.post.brand) || (post && post.brand) || null;
  const first = creator && creator.name ? creator.name.split(' ')[0] : '';
  // shopper-app-fixes (F10): a size that has its own price shows it once she chooses that size —
  // what she pays after the offer, as the server worked it out. Before a size is chosen: the product's own.
  const { pays, normal, seen } = priceFor(product, sel);
  const lower = Number(pays) < Number(normal);
  const chip = !isDeal && lower ? ((post && post.offer && post.offer.line) || (data.offer && data.offer.line) || null) : null;
  const counts = isDeal && product.in_deal && data.offer && data.offer.line ? CO.countsToward(data.offer.line) : null;
  const needs = hasChoices(product);
  const ready = !needs || !!sel.size;
  const canBuy = !product.sold_out && ready && !busy;
  const soldBy = CO.soldBy(brand && brand.name, first);
  const line = () => ({
    post_id: postId, product_id: product.id, colour: needs ? (sel.colour || firstColour(product)) : null, size: sel.size, qty: 1, price_seen: seen,
  });

  async function heart() {
    const on = !saved;
    setSaved(on);
    if (params.onHeart) params.onHeart(on);
    if (!(await heartProduct(postId, product.id, on, surface))) { setSaved(!on); if (params.onHeart) params.onHeart(!on); }
  }
  async function add() {
    setBusy(true); setErr(null);
    try {
      await addToBag([line()]);
      if (alone) noteAddedAlone(postId);
      track('add_to_bag', postId, surface, { product_id: product.id });
      flash.start();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  // "Go to bag ›" in that second: this page closes and the bag opens in its place.
  function goToBag() {
    flash.stop();
    leave();
    navigation.navigate('Bag');
  }
  async function buyNow() {
    const lines = [line()];
    flash.stop();
    done();
    const go = () => navigation.navigate('Checkout', { lines, buyNow: true });
    if (await isSignedIn()) go(); else navigation.navigate('FollowerLogin', { onDone: go, reason: 'order' });
  }
  // The offer (See offer ›, Get this offer, Build your deal): the deal page takes this page's
  // place, with this product started, so closing the deal brings her to the post she came from.
  function buildDeal() {
    done();
    navigation.replace('Deal', { postId, start: product.sold_out || !product.in_deal ? null : product.id });
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} testID="product-page">
          <Photos images={images} width={W} height={GALLERY} page testID="product-photos" />
          <View style={st.body}>
            <Text style={st.name} testID="product-name">{product.name}</Text>
            {product.brand_label ? <Text style={st.brand} testID="product-brand">{product.brand_label}</Text> : null}
            <View style={st.priceRow}>
              <Text style={st.price} testID="product-price">
                {inr(pays)}
                {lower ? <Text style={st.struck}>  {inr(normal)}</Text> : null}
              </Text>
              {chip ? <View style={bs.chipOk} testID="product-offer"><Text style={bs.chipOkText}>{chip}</Text></View> : null}
            </View>
            {counts ? <View style={b.effect} testID="product-counts"><Text style={b.effectText}>{counts}</Text></View> : null}
            <ChoicePicker product={product} value={sel} onChange={setSel} testIDPrefix="product" />
            <ProductDetails product={product} returnsLine={data.returns ? data.returns.line : null} testID="product-details" />
            {soldBy ? <Text style={st.soldBy} testID="product-sold-by">{soldBy}</Text> : null}
          </View>
        </ScrollView>
        {/* Back · heart · bag stay in reach over the photo, however far she scrolls. */}
        <View style={st.float} pointerEvents="box-none">
          <TouchableOpacity onPress={back} style={[st.round, st.lift]} testID="back" accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="chevron-left" size={22} color={K.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} pointerEvents="none" />
          <TouchableOpacity onPress={heart} style={[st.round, st.lift]} testID="product-heart" accessibilityRole="button"
            accessibilityState={{ selected: !!saved }} accessibilityLabel={saved ? CO.savedProduct : CO.saveProduct}>
            <Icon name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#C42B2B' : K.ink} />
          </TouchableOpacity>
          <BagButton overlay="light" style={st.lift} />
        </View>
      </View>
      <View style={st.bar}>
        {flash.added ? <AddedLine /> : null}
        {err ? <Text style={b.problem}>{err}</Text> : null}
        {isDeal && !alone ? (
          <>
            {sub === 'bogo' ? <Text style={st.barNote} testID="product-offer-note">{CO.bogoNext}</Text>
              : sub === 'fixed' ? <Text style={st.barNote} testID="product-offer-note">{CO.soldAsSet}</Text> : null}
            <TouchableOpacity style={[b.primary, { marginTop: 0 }]} onPress={buildDeal} testID="product-build-deal" accessibilityRole="button">
              <Text style={b.primaryText}>{sub === 'bogo' ? CO.getThisOffer : CO.buildDeal}</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {alone ? <Text style={st.barLabel} testID="product-buy-alone">{CO.buyAlone(inr(pays))}</Text> : null}
        {!isDeal || alone ? (
          <View style={st.btnRow}>
            <TouchableOpacity disabled={!canBuy} onPress={buyNow} style={[b.secondary, { flex: 1 }, !canBuy && b.primaryDis]} testID="product-buy-now"
              accessibilityRole="button" accessibilityState={{ disabled: !canBuy }}>
              <Text style={b.secondaryText}>{CO.buyNow}</Text>
            </TouchableOpacity>
            <AddToBagButton added={flash.added} disabled={!canBuy} label={product.sold_out ? CO.soldOut : ready ? CO.addToBag : CO.chooseSize}
              onAdd={add} onGoToBag={goToBag} testID="product-add" style={{ flex: 1, marginTop: 0 }} />
          </View>
        ) : null}
        {alone && product.in_deal && offerLine ? (
          <TouchableOpacity style={st.offerStrip} onPress={buildDeal} testID="product-see-offer" accessibilityRole="button"
            accessibilityLabel={`${CO.inAnOffer(offerLine)}. ${CO.seeOffer}`}>
            <Text style={st.offerStripText}>{CO.inAnOffer(offerLine)} · <Text style={st.offerStripLink}>{CO.seeOffer}</Text></Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  body: { paddingHorizontal: 14, paddingTop: 12 },
  name: { fontFamily: fonts.sansBold, fontSize: 17, lineHeight: 21, color: K.ink },
  brand: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  price: { fontFamily: fonts.sansBold, fontSize: 18, color: K.ink },
  struck: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink3, textDecorationLine: 'line-through' },
  soldBy: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 14 },
  float: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  round: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center' },
  lift: { elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  bar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: K.border, gap: 8, backgroundColor: '#fff' },
  btnRow: { flexDirection: 'row', gap: 10 },
  barLabel: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink },
  barNote: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2 },
  offerStrip: { backgroundColor: K.warnSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  offerStripText: { fontFamily: fonts.sansBold, fontSize: 12, color: K.warn },
  offerStripLink: { textDecorationLine: 'underline' },
});
