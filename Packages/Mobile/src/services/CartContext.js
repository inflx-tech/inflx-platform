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
  cart: { brandId: null, brandName: null, items: [], tracking: null },
  addItem: () => ({ ok: false }),
  forceReplaceWith: () => {},
  updateQty: () => {},
  removeItem: () => {},
  clear: () => {},
});

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ brandId: null, brandName: null, items: [], tracking: null });
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

  const addItem = useCallback((item, brandId, brandName, tracking) => {
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

    // Same brand (or empty cart) — add normally
    setCart(prev => {
      const existingIdx = prev.items.findIndex(i => i.product_id === item.id);
      const items = existingIdx >= 0
        ? prev.items.map((it, i) => i === existingIdx ? { ...it, qty: it.qty + 1 } : it)
        : [...prev.items, { product_id: item.id, name: item.name, price: item.price?.amount ?? 0, image_url: item.cover?.image_url, qty: 1 }];
      return { brandId, brandName, items, tracking: tracking || prev.tracking };
    });
    return { ok: true };
  }, [cart.brandId, cart.brandName]);

  const forceReplaceWith = useCallback((item, brandId, brandName, tracking) => {
    setCart({
      brandId,
      brandName,
      tracking: tracking || null,
      items: [{ product_id: item.id, name: item.name, price: item.price?.amount ?? 0, image_url: item.cover?.image_url, qty: 1 }],
    });
  }, []);

  const updateQty = useCallback((productId, qty) => {
    setCart(prev => {
      if (qty <= 0) {
        const items = prev.items.filter(i => i.product_id !== productId);
        if (items.length === 0) return { brandId: null, brandName: null, items: [], tracking: null };
        return { ...prev, items };
      }
      return {
        ...prev,
        items: prev.items.map(i => i.product_id === productId ? { ...i, qty } : i),
      };
    });
  }, []);

  const removeItem = useCallback((productId) => {
    updateQty(productId, 0);
  }, [updateQty]);

  const clear = useCallback(() => {
    setCart({ brandId: null, brandName: null, items: [], tracking: null });
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
