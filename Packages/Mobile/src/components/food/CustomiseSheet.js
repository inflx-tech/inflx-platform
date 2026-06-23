/**
 * CustomiseSheet — Food World 3C-2 (Toing img2). The ＋ popup.
 *
 * Bottom sheet driven by product.addon_groups (getProductDetail):
 *   - a VARIATION group (is_variation, single-select) SETS the base price
 *   - ADD-ON groups (multi) stack +price, "select up to max_select", Select All
 * Live total = base (variation price, else product.price) + Σ add-ons, × qty.
 * On Add → onAdd(line) with { id,name,image_url, price(unit), variation:{item_id},
 * selected_addons:[{item_id}], note, qty } — the shape placeOrder resolves
 * server-side (Phase 1).
 *
 * Props: visible, product, onClose, onAdd(line).
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable, Modal, StyleSheet, TextInput } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

const isVegFlag = (v) => v === 'veg' || v === 'Veg' || v === true;

// `initial` (Food 3C-3) — when editing an existing cart line, pre-fill the sheet
// with the line's current build: { variationId, addonIds:[id], qty, note }.
export default function CustomiseSheet({ visible, product, onClose, onAdd, initial = null }) {
  const groups = Array.isArray(product?.addon_groups) ? product.addon_groups : [];
  const variationGroup = useMemo(() => groups.find((g) => g.is_variation) || null, [groups]);
  const addonGroups = useMemo(() => groups.filter((g) => !g.is_variation), [groups]);

  const [variationId, setVariationId] = useState(null);
  const [addonIds, setAddonIds] = useState(() => new Set());
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState({}); // group_id → show all

  // Default selections when the sheet opens / product changes. An `initial`
  // build (edit mode) overrides the per-group defaults.
  useEffect(() => {
    if (!visible) return;
    const vg = groups.find((g) => g.is_variation) || null;
    if (initial) {
      setVariationId(initial.variationId ?? (vg ? (vg.items.find((i) => i.is_default) || vg.items[0])?.id : null) ?? null);
      setAddonIds(new Set(Array.isArray(initial.addonIds) ? initial.addonIds : []));
      setQty(initial.qty > 0 ? initial.qty : 1);
      setNote(initial.note || '');
      setExpanded({});
      return;
    }
    const def = vg ? (vg.items.find((i) => i.is_default) || vg.items[0]) : null;
    setVariationId(def ? def.id : null);
    const pre = new Set();
    groups.filter((g) => !g.is_variation).forEach((g) => g.items.forEach((i) => { if (i.is_default) pre.add(i.id); }));
    setAddonIds(pre);
    setQty(1); setNote(''); setExpanded({});
  }, [visible, product?.id]);

  const itemById = useMemo(() => {
    const m = new Map();
    groups.forEach((g) => g.items.forEach((i) => m.set(i.id, { ...i, group: g })));
    return m;
  }, [groups]);

  const base = variationId && itemById.get(variationId) ? itemById.get(variationId).price : (parseFloat(product?.price) || 0);
  const addonsTotal = [...addonIds].reduce((s, id) => s + (itemById.get(id)?.price || 0), 0);
  const unit = base + addonsTotal;
  const total = unit * qty;

  const toggleAddon = (group, id) => {
    setAddonIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); return n; }
      // enforce max_select within this group
      const inGroup = group.items.filter((i) => n.has(i.id)).length;
      const max = group.max_select || group.items.length;
      if (inGroup >= max) return n; // at cap — ignore
      n.add(id); return n;
    });
  };
  const selectAll = (group) => {
    setAddonIds((prev) => {
      const n = new Set(prev);
      const max = group.max_select || group.items.length;
      const ids = group.items.slice(0, max).map((i) => i.id);
      const allOn = ids.every((id) => n.has(id));
      ids.forEach((id) => { if (allOn) n.delete(id); else n.add(id); });
      return n;
    });
  };

  const canAdd = !variationGroup || !!variationId; // required variation must be chosen
  const submit = () => {
    if (!canAdd) return;
    onAdd?.({
      id: product.id,
      name: product.name,
      image_url: product.image_url,
      price: unit,
      mrp: product?.mrp != null ? product.mrp : null,
      variation: variationId ? { item_id: variationId } : null,
      selected_addons: [...addonIds].map((id) => ({ item_id: id })),
      note: note.trim() || null,
      qty,
      // Display-only labels for the cart summary (placeOrder resolves by id).
      variation_name: variationId ? (itemById.get(variationId)?.name || null) : null,
      addon_names: [...addonIds].map((id) => itemById.get(id)?.name).filter(Boolean),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable onPress={onClose} style={s.xclose}><Text style={s.xtxt}>✕</Text></Pressable>
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={s.thumb}>
              {product?.image_url ? <Image source={{ uri: product.image_url }} style={s.thumbImg} /> : <Text style={{ fontSize: 22 }}>🍽️</Text>}
            </View>
            <Text style={s.name} numberOfLines={2}>{product?.name}</Text>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            {variationGroup && (
              <Group group={variationGroup} sub={`Select 1 · sets the price`} required>
                {variationGroup.items.map((it) => (
                  <Row key={it.id} item={it} kind="radio" on={variationId === it.id} onPress={() => setVariationId(it.id)} />
                ))}
              </Group>
            )}

            {addonGroups.map((g) => {
              const showAll = expanded[g.id];
              const list = showAll ? g.items : g.items.slice(0, 5);
              return (
                <Group key={g.id} group={g}
                  sub={`Select upto ${g.max_select || g.items.length}`}
                  onSelectAll={() => selectAll(g)}>
                  {list.map((it) => (
                    <Row key={it.id} item={it} kind="check" plus on={addonIds.has(it.id)} onPress={() => toggleAddon(g, it.id)} />
                  ))}
                  {g.items.length > 5 && !showAll && (
                    <Pressable onPress={() => setExpanded((e) => ({ ...e, [g.id]: true }))}>
                      <Text style={s.more}>+{g.items.length - 5} more</Text>
                    </Pressable>
                  )}
                </Group>
              );
            })}

            {/* Per-dish cooking note (Food 3C-3) */}
            <View style={s.noteWrap}>
              <Text style={s.noteLbl}>Add a note (optional)</Text>
              <TextInput
                style={s.noteInput}
                placeholder="e.g. less spicy, no onion…"
                placeholderTextColor={T.hint}
                value={note}
                onChangeText={setNote}
                maxLength={200}
                multiline
              />
            </View>
            <View style={{ height: 10 }} />
          </ScrollView>

          <View style={s.foot}>
            <View style={s.qty}>
              <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={s.qtyBtn}><Text style={s.qtyTxt}>−</Text></Pressable>
              <Text style={s.qtyN}>{qty}</Text>
              <Pressable onPress={() => setQty((q) => q + 1)} style={s.qtyBtn}><Text style={s.qtyTxt}>+</Text></Pressable>
            </View>
            <Pressable onPress={submit} style={[s.add, !canAdd && { opacity: 0.5 }]} disabled={!canAdd}>
              <Text style={s.addTxt}>Add Item · ₹{Math.round(total)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Group({ group, sub, required, onSelectAll, children }) {
  return (
    <View>
      <View style={s.grpHd}>
        <View style={{ flex: 1 }}>
          <Text style={s.grpName}>{group.name}{required ? <Text style={s.req}>  REQUIRED</Text> : null}</Text>
          {sub ? <Text style={s.grpSub}>{sub}</Text> : null}
        </View>
        {onSelectAll ? <Pressable onPress={onSelectAll}><Text style={s.selall}>Select All</Text></Pressable> : null}
      </View>
      <View style={s.gcard}>{children}</View>
    </View>
  );
}

function Row({ item, kind, plus, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={s.row}>
      <View style={[s.vd, !isVegFlag(item.veg_flag) && item.veg_flag ? s.vdnv : null]} />
      <Text style={s.rowNm} numberOfLines={1}>{item.name}</Text>
      {item.price > 0 ? <Text style={s.rowPr}>{plus ? '+ ' : ''}₹{Math.round(item.price)}</Text> : null}
      {kind === 'radio'
        ? <View style={[s.rad, on && s.radOn]} />
        : <View style={[s.box, on && s.boxOn]}>{on ? <Text style={s.boxTick}>✓</Text> : null}</View>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', justifyContent: 'flex-end' },
  xclose: { position: 'absolute', alignSelf: 'center', bottom: '90%', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(60,60,60,0.85)', alignItems: 'center', justifyContent: 'center' },
  xtxt: { color: '#fff', fontSize: 16 },
  sheet: { backgroundColor: T.pageBg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: T.pinkTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  name: { flex: 1, fontSize: 16, fontFamily: fonts.displayBold, color: T.ink },
  body: { paddingBottom: 4 },
  grpHd: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  grpName: { fontSize: 16, fontFamily: fonts.displayBold, color: T.ink },
  req: { fontSize: 10, color: T.pink, fontFamily: fonts.monoBold },
  grpSub: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, marginTop: 1 },
  selall: { fontSize: 13, color: T.veg, fontFamily: fonts.sansBold },
  gcard: { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f2f4' },
  vd: { width: 15, height: 15, borderWidth: 1.6, borderColor: T.veg, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  vdnv: { borderColor: T.nonVeg },
  rowNm: { flex: 1, fontSize: 15, color: T.ink, fontFamily: fonts.sansMedium },
  rowPr: { fontSize: 14, color: T.ink, fontFamily: fonts.sansSemiBold },
  rad: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cfd3d8' },
  radOn: { borderColor: T.yellowDeep, borderWidth: 7 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cfd3d8', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: T.veg, borderColor: T.veg },
  boxTick: { color: '#fff', fontSize: 13, fontWeight: '800' },
  more: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: T.ink, fontFamily: fonts.sansBold },
  noteWrap: { paddingHorizontal: 16, paddingTop: 18 },
  noteLbl: { fontSize: 14, fontFamily: fonts.displayBold, color: T.ink, marginBottom: 8 },
  noteInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: T.line, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: T.ink, fontFamily: fonts.sansRegular, minHeight: 44, textAlignVertical: 'top' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: T.line },
  qty: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.pink, borderRadius: 26 },
  qtyBtn: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  qtyTxt: { color: T.pink, fontSize: 20, fontFamily: fonts.displayBold },
  qtyN: { width: 28, textAlign: 'center', color: T.pink, fontSize: 16, fontFamily: fonts.displayBold },
  add: { flex: 1, backgroundColor: T.veg, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addTxt: { color: '#fff', fontSize: 15, fontFamily: fonts.sansBold },
});
