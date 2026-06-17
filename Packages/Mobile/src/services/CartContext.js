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

const CartContext = createContext({
  cart: { brandId: null, brandName: null, items: [], tracking: null, offer: null, creatorHandle: null },
  addItem: () => ({ ok: false }),
  forceReplaceWith: () => {},
  updateQty: () => {},
  removeItem: () => {},
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
  return {
    product_id: item.id,
    line_key: `${item.id}::${variant_sku || ''}`,
    name: item.name,
    price: Number(price) || 0,
    image_url,
    variant_sku,
    variant_label,
    qty: 1,
  };
}
const lineMatches = (i, key) => i.line_key === key || i.product_id === key;

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ brandId: null, brandName: null, items: [], tracking: null, offer: null, creatorHandle: null });
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

    // Cross-brand detection — per contracts-v1.3 §1 cart_scope: "brand"
    // behavior contract. Caller must show confirmation modal then call
    // forceReplaceWith if user accepts.
    if (cart.brandId && cart.brandId !== brandId) {
      return {
        ok: false,
        requiresConfirmation: true,
        currentBrandName: cart.brandName,
        newBrandName: brandName,
      };
    }

    // Same brand (or empty cart) — add normally (merge by line_key so a different
    // size/colour of the same product is its own line).
    setCart(prev => {
      const line = normalizeLine(item);
      const existingIdx = prev.items.findIndex(i => i.line_key === line.line_key);
      const items = existingIdx >= 0
        ? prev.items.map((it, i) => i === existingIdx ? { ...it, qty: it.qty + 1 } : it)
        : [...prev.items, line];
      return {
        brandId, brandName, items,
        tracking: tracking || prev.tracking,
        offer: extra?.offer ?? prev.offer ?? null,
        creatorHandle: extra?.creatorHandle ?? prev.creatorHandle ?? null,
      };
    });
    return { ok: true };
  }, [cart.brandId, cart.brandName]);

  const forceReplaceWith = useCallback((item, brandId, brandName, tracking, extra) => {
    setCart({
      brandId,
      brandName,
      tracking: tracking || null,
      offer: extra?.offer ?? null,
      creatorHandle: extra?.creatorHandle ?? null,
      items: [normalizeLine(item)],
    });
  }, []);

  // key = line_key (preferred) OR product_id (back-compat for restaurant callers).
  const updateQty = useCallback((key, qty) => {
    setCart(prev => {
      if (qty <= 0) {
        const items = prev.items.filter(i => !lineMatches(i, key));
        if (items.length === 0) return { brandId: null, brandName: null, items: [], tracking: null, offer: null, creatorHandle: null };
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
    setCart({ brandId: null, brandName: null, items: [], tracking: null, offer: null, creatorHandle: null });
  }, []);

  return (
    <CartContext.Provider value={{ cart, addItem, forceReplaceWith, updateQty, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
