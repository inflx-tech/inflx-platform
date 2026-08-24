import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandProductPickerScreen — pick the exact products a creator would promote.
 * Contract: features/collab-terms-by-aim (item 8)
 *
 * The founder: "also what they should promote, here you need to add products also, we have
 * now only entire store, category, apart from this add individual product also as an
 * option."
 *
 * WHY THIS MATTERS BEYOND CONVENIENCE:
 * "Their whole store" and "a category" both keep absorbing new arrivals — a saree added
 * next month is inside the deal without anybody agreeing to it. A hand-picked list never
 * does. That difference was invisible while the only options were the two broad ones.
 *
 * Same shape as BrandPlacePicker: a callback in the route params, so the composer keeps
 * its state and nothing has to be threaded back through navigation.
 */

const money = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);

export default function BrandProductPickerScreen({ route, navigation }) {
  const { selected: initial = [], onDone } = route.params || {};
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set(initial));

  useEffect(() => {
    brandApi.listProducts().then(res => {
      setLoading(false);
      if (res.success) setRows(res.data?.products || res.data || []);
    });
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r => String(r.name || '').toLowerCase().includes(needle));
  }, [rows, q]);

  function toggle(id) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function done() {
    const ids = [...picked];
    // The NAMES travel with the ids on purpose. A handshake is a record of what was agreed
    // on the day: if a product is renamed or removed later, the agreement should still say
    // what was offered rather than showing a creator "3 specific products" and nothing else.
    const names = ids
      .map(id => (rows.find(r => r.id === id) || {}).name)
      .filter(Boolean);
    if (typeof onDone === 'function') onDone(ids, names);
    navigation.goBack();
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.close} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>Pick products</Text>
          <Text style={s.navSub}>
            {picked.size === 0 ? 'Nothing chosen yet' : `${picked.size} chosen`}
          </Text>
        </View>
      </View>

      <View style={s.searchWrap}>
        <Icon name="magnify" size={16} color={ig.mut2} />
        <TextInput
          style={s.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search your products"
          placeholderTextColor={ig.mut2}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={ig.mut2} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => {
            const on = picked.has(item.id);
            return (
              <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => toggle(item.id)}>
                <View style={[s.box, on && s.boxOn]}>
                  {on && <Icon name="check" size={13} color={ig.bg} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.meta}>
                    {money(item.price)}
                    {item.is_active === false ? '  ·  not live in your store' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="package-variant" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>
                {q ? 'No products match that' : 'You have no products yet'}
              </Text>
              <Text style={s.emptyS}>
                {q
                  ? 'Try a shorter search.'
                  : 'Add products on the web dashboard, then you can name exactly which ones a creator promotes.'}
              </Text>
            </View>
          }
          contentContainerStyle={shown.length === 0 ? { flexGrow: 1 } : { paddingBottom: 96 }}
        />
      )}

      {picked.size > 0 && (
        <View style={s.bar}>
          <Text style={s.barN}>{picked.size} chosen</Text>
          <TouchableOpacity style={s.barBtn} onPress={done} activeOpacity={0.85}>
            <Text style={s.barT}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  close: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 11, color: ig.mut, marginTop: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 11,
    borderWidth: 1, borderColor: ig.line, borderRadius: 9,
  },
  search: { flex: 1, fontSize: 13, color: ig.text, paddingVertical: 9 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: ig.lineSoft,
  },
  box: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: ig.line,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: ig.text, borderColor: ig.text },
  name: { fontSize: 13.5, fontWeight: '700', color: ig.text },
  meta: { fontSize: 11, color: ig.mut, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 7 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4 },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },
  bar: {
    position: 'absolute', left: 14, right: 14, bottom: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: ig.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  barN: { flex: 1, fontSize: 12.5, fontWeight: '700', color: ig.bg },
  barBtn: { backgroundColor: ig.bg, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  barT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
});
