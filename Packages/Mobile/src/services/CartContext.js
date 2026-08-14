import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * CartContext — single source of truth for the follower's in-progress cart.
 *
 * Per spec section 3 + isolated decision #1: React Context with AsyncStorage
 * backing. Persists across session, cleared on cross-brand confirm.
 *
 * cart_scope: "brand" enforcement (per contracts-v1.3 §1 behavior contract):
 * the addItem helper detects cross-brand adds and EXPECTS the caller to have
 * obtained user confirmation. Silent replacement is forbidden — addItem
 * itself doesn't show a modal (that's a UI concern), but it returns a
 * `requiresConfirmation` signal so the caller (RestaurantDetailScreen's
 * "Add to Order" handler) can render the modal at the add-intent layer.
 *
 * Cross-session persistence is deferred to v2 per contracts-v1 §8 open
 * question 5 — but since AsyncStorage backs us, cross-session resume falls
 * out for free (state survives app close). No work needed to remove later
 * if v2 decides differently.
 */

const STORAGE_KEY = 'inflx_cart_v1';

const EMPTY_CART = {
  brandId: null, brandName: null, items: [], tracking: null,
  offer: null, creatorHandle: null,
  // Food 3C-3 — brand-direct store offers surfaced for the in-cart offer-picker
  // (storeOffers = what the brand published) and appliedOffer = the one the
  // follower chose (carries brand_offer_id → placeOrder).
  storeOffers: [], appliedOffer: null,
  // follower-creator-attribution Slice 2 — the creator code applied at checkout
  // (the resolve-coupon response). Stamps a 'code' claim on the creator's
  // allocated lines for that brand; cleared via clearCreatorCode.
  appliedCode: null,
};

const CartContext = createContext({
  cart: EMPTY_CART,
  addItem: () => ({ ok: false }),
  forceReplaceWith: () => {},
  updateQty: () => {},
  removeItem: () => {},
  replaceLine: () => {},
  applyOffer: () => {},
  clearOffer: () => {},
  applyCreatorCode: () => ({ ok: false }),
  clearCreatorCode: () => {},
  clear: () => {},
});

// Normalise an item from either shape: restaurant menu-item {price:{amount}, cover:{image_url}}
// OR a follower product {price:<number>, image_url}. A line is keyed by product + variant SKU
// so the same product in two sizes is two distinct cart lines.
function normalizeLine(item) {
  const price = item.price?.amount ?? (typeof item.price === 'number' ? item.price : parseFloat(item.price)) ?? 0;
  const image_url = item.cover?.image_url ?? item.image_url ?? null;
  const variant_sku = item.variant_sku ?? null;
  const variant_label = item.variant_label ?? null;
  // Food 3C-2 — dish customisation (variation + add-ons + note). The line_key
  // includes a customisation signature so two differently-built same-dish lines
  // stay distinct; identical builds merge. Carries the ids placeOrder resolves.
  const variation = item.variation && item.variation.item_id ? { item_id: item.variation.item_id } : null;
  const selectedAddons = Array.isArray(item.selected_addons)
    ? item.selected_addons.map((a) => ({ item_id: a.item_id })).filter((a) => a.item_id) : [];
  const sig = [variation?.item_id || '', ...selectedAddons.map((a) => a.item_id).sort()].join('|');
  // Food 3C-3 — per-dish MRP (mig 118) carried so the cart can show the struck
  // price + sum "Item savings (MRP)". Display only; backend re-prices.
  const mrp = item.mrp != null && Number(item.mrp) > 0 ? Number(item.mrp) : null;
  return {
    product_id: item.id,
    line_key: `${item.id}::${variant_sku || ''}::${sig}`,
    name: item.name,
    price: Number(price) || 0,
    mrp,
    image_url,
    variant_sku,
    variant_label,
    variation,
    selected_addons: selectedAddons,
    // Display-only customisation labels (placeOrder resolves by item_id).
    variation_name: item.variation_name || null,
    addon_names: Array.isArray(item.addon_names) ? item.addon_names : [],
    note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : null,
    qty: Number(item.qty) > 0 ? Number(item.qty) : 1,
  };
}
const lineMatches = (i, key) => i.line_key === key || i.product_id === key;

// follower-creator-attribution Slice 1 — the per-line creator CLAIM. Built from
// the `tracking` carried by a creator-store/link add; organic adds → null.
// The claim rides on the LINE (not the cart) so a multi-creator cart credits
// each creator only for the items they drove.
function buildClaim(tracking, extra) {
  if (!tracking?.campaign_influencer_id) return null;
  return {
    campaign_influencer_id: tracking.campaign_influencer_id,
    campaign_id: tracking.campaign_id || null,
    set_id: tracking.set_id || null,
    offer_id: tracking.offer_id || null,
    source: tracking.source || 'link',
    creator_handle: tracking.influencer_handle || tracking.creator_handle || extra?.creatorHandle || null,
  };
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.items) setCart(parsed);
        }
      } catch (e) {
        console.warn('[Cart] hydrate failed:', e.message);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist on change (after hydrate to avoid clobbering with the empty default)
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart)).catch(e =>
      console.warn('[Cart] persist failed:', e.message)
    );
  }, [cart, hydrated]);

  // extra (optional): { offer, creatorHandle } — carried for the cart's discount
  // line + the "via @creator" attribution that earns the influencer commission.
  const addItem = useCallback((item, brandId, brandName, tracking, extra) => {
    if (!item?.id || !brandId) return { ok: false, reason: 'invalid_item' };

    // Cart "kind" decides the cross-brand rule:
    //   food → ONE restaurant per cart (you can't deliver from two kitchens).
    //   shop → MULTI-BRAND allowed (fashion/furniture/beauty/… like Amazon).
    // Decide by the INCOMING add's kind, falling back to the cart's tag — so a
    // pre-existing (untagged) cart isn't wrongly treated as food. A shop add
    // therefore NEVER triggers the cross-brand prompt, even on a legacy cart.
    const incomingKind = extra?.cartKind || 'food';
    const kind = cart.items.length ? (cart.kind || incomingKind) : incomingKind;

    // Single-brand restriction is FOOD-ONLY. Caller shows the confirm modal then
    // calls forceReplaceWith if accepted (contracts-v1.3 §1, now food-scoped).
    if (incomingKind === 'food' && cart.brandId && cart.brandId !== brandId) {
      return {
        ok: false,
        requiresConfirmation: true,
        currentBrandName: cart.brandName,
        newBrandName: brandName,
      };
    }

    // Add normally (merge by line_key + brand so a different size/brand is its own line).
    const claim = buildClaim(tracking, extra);
    setCart(prev => {
      const base = normalizeLine(item);
      // line_key includes the claiming creator so the SAME product via two
      // different creators (or creator vs organic) stays two distinct lines.
      const lineKey = `${base.line_key}::${claim?.campaign_influencer_id || ''}`;
      // Slice 0 (features/follower-event-log) — post_id sits on the LINE, not
      // inside the claim, because a post can drive a sale with no campaign
      // behind it (an own-store product needs no collaboration). Putting it in
      // the claim would silently lose exactly that case. Not part of line_key:
      // the same product added from two posts merges, first post wins.
      const line = {
        ...base, line_key: lineKey, brand_id: brandId, brand_name: brandName, claim,
        post_id: extra?.postId || null,
      };
      const existingIdx = prev.items.findIndex(i => i.line_key === lineKey && (i.brand_id || brandId) === brandId);
      const items = existingIdx >= 0
        ? prev.items.map((it, i) => i === existingIdx ? { ...it, qty: it.qty + line.qty } : it)
        : [...prev.items, line];
      return {
        ...prev,
        kind,
        // Primary brand stays the FIRST brand (food = the only one; shop = the lead).
        brandId: prev.brandId || brandId, brandName: prev.brandName || brandName,
        items,
        tracking: tracking || prev.tracking,
        offer: extra?.offer ?? prev.offer ?? null,
        creatorHandle: extra?.creatorHandle ?? prev.creatorHandle ?? null,
        storeOffers: extra?.storeOffers ?? prev.storeOffers ?? [],
      };
    });
    return { ok: true };
  }, [cart.brandId, cart.brandName, cart.kind, cart.items.length]);

  const forceReplaceWith = useCallback((item, brandId, brandName, tracking, extra) => {
    const claim = buildClaim(tracking, extra);
    const base = normalizeLine(item);
    setCart({
      ...EMPTY_CART,
      kind: extra?.cartKind || 'food',
      brandId,
      brandName,
      tracking: tracking || null,
      offer: extra?.offer ?? null,
      creatorHandle: extra?.creatorHandle ?? null,
      storeOffers: extra?.storeOffers ?? [],
      items: [{ ...base, line_key: `${base.line_key}::${claim?.campaign_influencer_id || ''}`, brand_id: brandId, brand_name: brandName, claim }],
    });
  }, []);

  // Food 3C-3 — edit a customised line in place: drop the old line_key, add the
  // rebuilt one (merges if the new build collides with another line). Same brand.
  const replaceLine = useCallback((oldKey, item) => {
    setCart(prev => {
      const line = normalizeLine(item);
      const kept = prev.items.filter(i => i.line_key !== oldKey);
      const existingIdx = kept.findIndex(i => i.line_key === line.line_key);
      const items = existingIdx >= 0
        ? kept.map((it, i) => i === existingIdx ? { ...it, qty: it.qty + line.qty } : it)
        : [...kept, line];
      return { ...prev, items };
    });
  }, []);

  // Food 3C-3 — apply / clear a brand store offer (offer-picker → brand_offer_id).
  const applyOffer = useCallback((offer) => {
    setCart(prev => ({ ...prev, appliedOffer: offer || null }));
  }, []);
  const clearOffer = useCallback(() => {
    setCart(prev => ({ ...prev, appliedOffer: null }));
  }, []);

  // follower-creator-attribution Slice 2 — apply a resolved creator code: stamp a
  // 'code' claim on the creator's ALLOCATED lines for that brand. A line already
  // claimed via link is NOT overridden (link wins, last-click). Returns
  // { ok, matched } so the caller can warn when nothing in the cart matches.
  const applyCreatorCode = useCallback((resolved) => {
    if (!resolved?.campaign_influencer_id) return { ok: false, reason: 'invalid' };
    const allocated = new Set(resolved.allocated_product_ids || []);
    const eligible = (it) => it.brand_id === resolved.brand_id && allocated.has(it.product_id) && !it.claim;
    const matched = cart.items.filter(eligible).length;
    if (!matched) return { ok: false, reason: 'no_match' };
    setCart(prev => ({
      ...prev,
      appliedCode: resolved,
      items: prev.items.map(it => {
        if (!eligible(it)) return it;
        return {
          ...it,
          claim: {
            campaign_influencer_id: resolved.campaign_influencer_id,
            campaign_id: resolved.campaign_id || null,
            set_id: resolved.set_id || null,
            offer_id: resolved.offer_id || null,
            source: 'code',
            creator_handle: resolved.creator_handle || null,
            coupon_code: resolved.coupon_code || null,
          },
          // re-key so the now-claimed line groups with its creator (last segment
          // of line_key is the claiming CI; was '' while organic).
          line_key: it.line_key.replace(/::[^:]*$/, `::${resolved.campaign_influencer_id}`),
        };
      }),
    }));
    return { ok: true, matched };
  }, [cart.items]);

  const clearCreatorCode = useCallback(() => {
    setCart(prev => ({
      ...prev,
      appliedCode: null,
      items: prev.items.map(it => (it.claim?.source === 'code')
        ? { ...it, claim: null, line_key: it.line_key.replace(/::[^:]*$/, '::') }
        : it),
    }));
  }, []);

  // key = line_key (preferred) OR product_id (back-compat for restaurant callers).
  const updateQty = useCallback((key, qty) => {
    setCart(prev => {
      if (qty <= 0) {
        const items = prev.items.filter(i => !lineMatches(i, key));
        if (items.length === 0) return EMPTY_CART;
        return { ...prev, items };
      }
      return {
        ...prev,
        items: prev.items.map(i => lineMatches(i, key) ? { ...i, qty } : i),
      };
    });
  }, []);

  const removeItem = useCallback((key) => {
    updateQty(key, 0);
  }, [updateQty]);

  const clear = useCallback(() => {
    setCart(EMPTY_CART);
  }, []);

  return (
    <CartContext.Provider value={{ cart, addItem, forceReplaceWith, updateQty, removeItem, replaceLine, applyOffer, clearOffer, applyCreatorCode, clearCreatorCode, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
