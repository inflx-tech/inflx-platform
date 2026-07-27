import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/* Product picker (features/brand-mobile-offers, A7). Lets the mobile offer
   builders select products for BOGO / bundle offers — the piece that previously
   forced volume/BOGO/bundle creation onto the web dashboard.
   `multi` = pick several (bundle needs >= 2). */
export default function ProductPickerSheet({ visible, multi, selected = [], onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(selected);

  useEffect(() => {
    if (!visible) return;
    setPicked(selected);
    setLoading(true);
    brandApi.listProducts()
      .then(res => { if (res?.success) setItems(res.data?.products || res.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [visible]);

  const isOn = (id) => picked.some(p => p.id === id);
  function toggle(p) {
    const row = { id: p.id, name: p.name || p.title || 'Product' };
    if (multi) setPicked(prev => (isOn(p.id) ? prev.filter(x => x.id !== p.id) : [...prev, row]));
    else setPicked([row]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={s.sheet}>
          <Text style={s.title}>{multi ? 'Pick products' : 'Pick a product'}</Text>
          <Text style={s.meta}>{multi ? `${picked.length} selected` : 'Tap to select'}</Text>

          {loading ? (
            <ActivityIndicator color={ig.text} style={{ marginVertical: 24 }} />
          ) : items.length === 0 ? (
            <Text style={s.empty}>No products yet. Add products from your web dashboard, then build the offer here.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(p) => String(p.id)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[s.row, isOn(item.id) && s.rowOn]} onPress={() => toggle(item)}>
                  <Text style={[s.rowTxt, isOn(item.id) && s.rowTxtOn]} numberOfLines={1}>
                    {item.name || item.title || 'Product'}
                  </Text>
                  {isOn(item.id) ? <Text style={s.check}>✓</Text> : null}
                </TouchableOpacity>
              )}
            />
          )}

          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.ghost]} onPress={onClose}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.fill, picked.length === 0 && { opacity: 0.4 }]}
              disabled={picked.length === 0}
              onPress={() => onDone(picked)}
            >
              <Text style={s.fillTxt}>Use {multi && picked.length ? `(${picked.length})` : ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ig.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 26 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  meta: { fontSize: 11.5, color: ig.mut, marginTop: 2, marginBottom: 10 },
  empty: { fontSize: 12.5, color: ig.mut, lineHeight: 18, paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: ig.line, borderRadius: 10, padding: 12, marginBottom: 7 },
  rowOn: { borderColor: ig.text },
  rowTxt: { flex: 1, fontSize: 13, color: ig.text2 },
  rowTxtOn: { fontWeight: '800', color: ig.text },
  check: { fontSize: 14, fontWeight: '900', color: ig.text },
  actions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  ghost: { borderWidth: 1, borderColor: ig.line },
  ghostTxt: { fontSize: 13, fontWeight: '700', color: ig.text },
  fill: { backgroundColor: ig.text },
  fillTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
