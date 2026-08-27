import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * CategoryPickerModal — pick one category, from inside a sheet.
 * Contract: features/stage-2-offers-parity (P1)
 *
 * WHY A MODAL AND NOT THE EXISTING SCREEN
 * `BrandCategoryPickerScreen` already does this job and is the right thing when a screen can
 * navigate. The offer builder is a Modal with no navigator in reach, and pushing a route from
 * inside a modal is how a phone ends up with a screen behind a sheet that neither can dismiss.
 *
 * So this is the same tree, the same flattened "Women › Ethnic › Saree" rows, and the same
 * search — presented as a sheet. The **flatten** below is deliberately identical to the one in
 * `BrandAllocationScreen`, because a brand who has picked a category for an allocation should
 * recognise this instantly.
 *
 * It returns BOTH halves — `{ id, name, path }`. The offer config stores the node id AND the
 * label: the server accepts either, and the shopper-side SQL prefers the id and falls back to
 * matching the section by name. Writing one without the other is how an offer silently stops
 * matching anything after somebody renames a category.
 */

/** The tree arrives nested. A flat list with a readable path is what fits a phone. */
function flatten(nodes, prefix = [], out = []) {
  (nodes || []).forEach((n) => {
    const path = [...prefix, n.name];
    out.push({ id: n.id, name: n.name, path: path.join(' › '), product_count: n.product_count });
    if (n.children?.length) flatten(n.children, path, out);
  });
  return out;
}

export default function CategoryPickerModal({ visible, selectedId, onPick, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setErr(null);
    brandApi.getListingTree()
      .then((res) => {
        if (!alive) return;
        if (!res?.success) { setErr(res?.error?.message || 'Could not load your categories.'); return; }
        // `tree` — checked against BrandCategoryPickerScreen and BrandAllocationScreen, both
        // of which read exactly this key. Guessing a fallback key would have hidden a rename.
        setRows(flatten(res.data?.tree || []));
      })
      .catch(e => alive && setErr(e?.message || 'Could not load your categories.'));
    return () => { alive = false; };
  }, [visible]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r => r.path.toLowerCase().includes(needle));
  }, [rows, q]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>Which category?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={19} color={ig.mut} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={s.search}
            value={q}
            onChangeText={setQ}
            placeholder="Search your categories…"
            placeholderTextColor={ig.mut}
          />

          {rows === null && !err && (
            <View style={s.center}><ActivityIndicator color={ig.text} /></View>
          )}

          {!!err && (
            <View style={s.center}>
              <Text style={s.err}>{err}</Text>
            </View>
          )}

          {rows !== null && (
            <FlatList
              data={shown}
              keyExtractor={r => String(r.id)}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={s.empty}>
                  {q ? 'Nothing matches that.' : 'You have no categories yet. An offer can still cover the whole store.'}
                </Text>
              }
              renderItem={({ item }) => {
                const on = selectedId && String(selectedId) === String(item.id);
                return (
                  <TouchableOpacity
                    style={[s.row, on && s.rowOn]}
                    onPress={() => { onPick(item); onClose(); }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.path} numberOfLines={2}>{item.path}</Text>
                      {item.product_count != null && (
                        <Text style={s.count}>
                          {item.product_count} product{Number(item.product_count) === 1 ? '' : 's'}
                        </Text>
                      )}
                    </View>
                    {on && <Icon name="check" size={16} color={ig.green} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export { flatten };

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ig.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 26 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '800', color: ig.text },
  search: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, color: ig.text, marginBottom: 8 },
  center: { paddingVertical: 40, alignItems: 'center' },
  err: { fontSize: 12.5, fontWeight: '700', color: ig.red, textAlign: 'center' },
  empty: { fontSize: 12, fontWeight: '650', color: ig.mut, textAlign: 'center', paddingVertical: 26, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowOn: { backgroundColor: ig.bgSoft },
  path: { fontSize: 12.5, fontWeight: '700', color: ig.text },
  count: { fontSize: 10, fontWeight: '700', color: ig.mut, marginTop: 2 },
});
