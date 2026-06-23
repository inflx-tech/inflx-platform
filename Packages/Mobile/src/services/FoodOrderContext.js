import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { followerApi } from './api';
import { useCart } from './CartContext';
import DishDetailSheet from '../components/food/DishDetailSheet';
import CustomiseSheet from '../components/food/CustomiseSheet';

/**
 * FoodOrderProvider — Food 3C-3. Hosts the dish-add popups APP-WIDE so any
 * discovery surface (home Type A rail, Type B nested dishes, etc.) opens the
 * SAME DishDetailSheet / CustomiseSheet the storefront uses.
 *
 * openDish(product, brand, navigation, mode):
 *   mode 'detail' → image/name tap → DishDetailSheet (ADD).
 *   mode 'add'    → ＋ tap → CustomiseSheet if the dish has add-ons, else add direct.
 * On ADD (with OR without add-ons), the item enters the persistent cart AND we
 * navigate INTO that restaurant's storefront so the follower can keep adding
 * (founder flow, 2026-06-23).
 *
 * The storefront (RestaurantDetailScreen) keeps its OWN in-screen sheets — this
 * provider only drives the discovery surfaces, so there's no double-add.
 */

const FoodOrderContext = createContext({ openDish: () => {} });

function directLine(p) {
  return { id: p.id, name: p.name, image_url: p.image_url, price: p.price, mrp: p.mrp != null ? p.mrp : null, qty: 1 };
}

export function FoodOrderProvider({ children }) {
  const { addItem, forceReplaceWith } = useCart();
  const [detail, setDetail] = useState(null);       // product for DishDetailSheet
  const [customise, setCustomise] = useState(null); // product for CustomiseSheet
  const ctxRef = useRef({ brand: null, navigation: null });

  const goStore = useCallback(() => {
    const { brand, navigation } = ctxRef.current;
    if (brand?.id && navigation) {
      navigation.navigate('BrandStore', { brandId: brand.id, name: brand.name, tracking: null });
    }
  }, []);

  // Add to cart (cross-brand guarded) then land in the storefront.
  const commit = useCallback((line) => {
    const { brand } = ctxRef.current;
    if (!brand?.id) return;
    const extra = { storeOffers: brand.store_offers || [] };
    const res = addItem(line, brand.id, brand.name, null, extra);
    if (res?.requiresConfirmation) {
      Alert.alert('Start a new cart?',
        `Your cart has items from ${res.currentBrandName}. Replace them with items from ${res.newBrandName}?`,
        [{ text: 'Keep cart', style: 'cancel' },
         { text: 'Replace', style: 'destructive', onPress: () => { forceReplaceWith(line, brand.id, brand.name, null, extra); goStore(); } }]);
      return;
    }
    goStore();
  }, [addItem, forceReplaceWith, goStore]);

  const openDish = useCallback(async (product, brand, navigation, mode = 'detail') => {
    if (!product?.id || !brand?.id) return;
    ctxRef.current = { brand, navigation };
    let full = product;
    try {
      const r = await followerApi.getProductDetail?.(product.id);
      if (r?.success && r.data?.product) full = { ...product, ...r.data.product };
    } catch { /* fall back to the card data */ }
    const hasAddons = Array.isArray(full.addon_groups) && full.addon_groups.length > 0;
    if (mode === 'detail') { setDetail(full); return; }
    if (hasAddons) setCustomise(full);
    else commit(directLine(full));
  }, [commit]);

  // DishDetailSheet ADD → customise if add-ons, else add direct.
  const onDetailAdd = useCallback((product) => {
    const hasAddons = Array.isArray(product.addon_groups) && product.addon_groups.length > 0;
    setDetail(null);
    if (hasAddons) setCustomise(product);
    else commit(directLine(product));
  }, [commit]);

  const onCustomiseAdd = useCallback((line) => {
    setCustomise(null);
    commit(line);
  }, [commit]);

  return (
    <FoodOrderContext.Provider value={{ openDish }}>
      {children}
      <DishDetailSheet
        visible={!!detail}
        product={detail}
        onClose={() => setDetail(null)}
        onAdd={onDetailAdd}
      />
      <CustomiseSheet
        visible={!!customise}
        product={customise}
        onClose={() => setCustomise(null)}
        onAdd={onCustomiseAdd}
      />
    </FoodOrderContext.Provider>
  );
}

export function useFoodOrder() {
  return useContext(FoodOrderContext);
}
