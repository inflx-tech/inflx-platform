import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * StockStoreScreen — influencer shelves products into their store.
 * Contract: features/influencer-store-stocking-ui.
 *
 * Lists products the creator is ALLOWED to stock (active products of brands they're
 * contracted with — the contract-gate is enforced server-side), grouped by brand,
 * each with a Stock / Stocked toggle. Backed by:
 *   GET    /influencers/me/store/stockable   (catalog + stocked flag)
 *   GET    /influencers/me/store/items        (id ↔ product_id, for unstock)
 *   POST   /influencers/me/store/items        (shelve)
 *   DELETE /influencers/me/store/items/:id     (remove)
 */

const CATEGORY_EMOJI = {
  restaurant: '🍽️', salon: '💇', car_rental: '🚗', bike_rental: '🏍️',
  fashion: '👗', fashion_walkin: '👗', fashion_online: '👕', bakery: '🧁', florist: '💐',
};
const emojiFor = (c) => CATEGORY_EMOJI[c] || '🛍️';

export default function StockStoreScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [itemIdByProduct, setItemIdByProduct] = useState({});
  const [brandCount, setBrandCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState({}); // product_id → true while toggling

  const load = useCallback(async () => {
    try {
      const [stockRes, mineRes] = await Promise.all([
        influencerApi.getStockable(),
        influencerApi.getMyStoreItems(),
      ]);
      const sd = stockRes.data || stockRes;
      const md = mineRes.data || mineRes;
      setItems(sd.items || []);
      setBrandCount(sd.contracted_brand_count || 0);
      const map = {};
      (md.items || []).forEach(it => { map[it.product_id] = it.id; });
      setItemIdByProduct(map);
    } catch (e) {
      console.error('[StockStore] Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const toggle = useCallback(async (item) => {
    const pid = item.product_id;
    if (busy[pid]) return;
    setBusy(b => ({ ...b, [pid]: true }));
    const wasStocked = item.stocked;
    // optimistic
    setItems(list => list.map(x => x.product_id === pid ? { ...x, stocked: !wasStocked } : x));
    try {
      if (wasStocked) {
        const id = itemIdByProduct[pid];
        if (id) await influencerApi.unstockItem(id);
        setItemIdByProduct(m => { const n = { ...m }; delete n[pid]; return n; });
      } else {
        const res = await influencerApi.stockItem({ product_id: pid });
        const created = (res.data || res)?.item;
        if (created?.id) setItemIdByProduct(m => ({ ...m, [pid]: created.id }));
      }
    } catch (e) {
      // revert on failure
      setItems(list => list.map(x => x.product_id === pid ? { ...x, stocked: wasStocked } : x));
      console.error('[StockStore] toggle failed:', e.message);
    } finally {
      setBusy(b => { const n = { ...b }; delete n[pid]; return n; });
    }
  }, [busy, itemIdByProduct]);

  if (loading) {
    return <View style={[s.root, s.center]}><ActivityIndicator size="large" color={P.yellow} /></View>;
  }

  // group by brand
  const groups = {};
  items.forEach(it => {
    (groups[it.brand_id] = groups[it.brand_id] || { name: it.brand_name, category: it.brand_category, items: [] }).items.push(it);
  });
  const groupList = Object.values(groups);
  const stockedCount = items.filter(i => i.stocked).length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Stock my store</Text>
          <Text style={s.sub}>{stockedCount} shelved · {brandCount} contracted brand{brandCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.yellow} />}
      >
        {groupList.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🤝</Text>
            <Text style={s.emptyTitle}>No contracted brands yet</Text>
            <Text style={s.emptyText}>You can stock products once you're contracted with a brand through a campaign.</Text>
          </View>
        ) : groupList.map((g, gi) => (
          <View key={gi} style={s.group}>
            <Text style={s.groupName}>{emojiFor(g.category)}  {g.name}</Text>
            {g.items.map(it => (
              <View key={it.product_id} style={s.row}>
                <View style={s.thumb}><Text style={{ fontSize: 20 }}>{emojiFor(it.brand_category)}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.pName} numberOfLines={1}>{it.product_name}</Text>
                  <Text style={s.pMeta} numberOfLines={1}>{it.section ? `${it.section} · ` : ''}{fmtMoney ? fmtMoney(it.price) : `₹${it.price}`}</Text>
                </View>
                <TouchableOpacity
                  style={[s.btn, it.stocked && s.btnOn]}
                  onPress={() => toggle(it)}
                  disabled={!!busy[it.product_id]}
                >
                  <Text style={[s.btnTxt, it.stocked && s.btnTxtOn]}>
                    {busy[it.product_id] ? '…' : it.stocked ? '✓ Stocked' : '+ Stock'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border },
  back: { fontSize: 22, color: P.ink },
  title: { fontSize: 18, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  sub: { fontSize: 11, color: P.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansMedium },
  group: { marginTop: 16, paddingHorizontal: 16 },
  groupName: { fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 8, fontFamily: fonts.displayBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 10, marginBottom: 8 },
  thumb: { width: 42, height: 42, borderRadius: 9, backgroundColor: P.yellowPale, alignItems: 'center', justifyContent: 'center' },
  pName: { fontSize: 13, fontWeight: '700', color: P.ink, fontFamily: fonts.sansBold },
  pMeta: { fontSize: 11, color: P.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansMedium },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: P.yellow, backgroundColor: 'transparent' },
  btnOn: { backgroundColor: P.yellow },
  btnTxt: { fontSize: 11, fontWeight: '800', color: P.yellow, fontFamily: fonts.sansBold },
  btnTxtOn: { color: P.ink },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: P.ink, marginBottom: 4 },
  emptyText: { fontSize: 12, color: P.muted, textAlign: 'center' },
});
