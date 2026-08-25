import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import { ProductPickerModal } from '../../components/brand/ProductPicker';
import * as draft from '../../utils/campaignDraft';

/**
 * BrandAllocationScreen — what one creator may sell.
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 * Board: 04-preview/mockups/stage2-screens.html panel ⑦ · action ledger #83–#85, #88
 *
 * THE DIFFERENCE THAT HAS TO BE SAID OUT LOUD
 * Store and category scopes are DECLARED, resolved live — a saree added next month is
 * inside the deal without anybody agreeing to it. A hand-picked list never absorbs new
 * stock. That difference is invisible unless the screen states it, and a brand who
 * hand-picks and then adds stock will otherwise wonder why she is not selling it. So each
 * option says what it does to future products BEFORE it is chosen.
 *
 * Allocation is independent of the offer (Part 4 §4.1): what she MAY SELL and what the
 * CUSTOMER SAVES are different questions. They shared one field once, and it meant a
 * creator could not sell at full price on commission alone.
 */
export default function BrandAllocationScreen({ route, navigation }) {
  const { campaignId, setId, agreementId, creatorName, current } = route.params || {};

  const [scope, setScope] = useState(current?.alloc_scope || null);
  const [nodeId, setNodeId] = useState(current?.alloc_category_node_id || null);
  const [nodeName, setNodeName] = useState(current?.alloc_category || null);
  const [productIds, setProductIds] = useState(current?.alloc_product_ids || []);
  const [productRows, setProductRows] = useState([]);
  const [tree, setTree] = useState([]);
  const [storeCount, setStoreCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([brandApi.getListingTree(), brandApi.listProducts()]).then(([t, p]) => {
      if (!alive) return;
      if (t?.success) setTree(flatten(t.data?.tree || []));
      if (p?.success) {
        const rows = p.data?.products || [];
        setStoreCount(rows.filter(r => r.is_active !== false).length);
        setProductRows(rows);
      }
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const countFor = (id) => {
    const n = tree.find(x => x.id === id);
    return n?.product_count != null ? n.product_count : null;
  };

  function save() {
    const alloc =
      scope === 'store' ? { alloc_scope: 'store' }
        : scope === 'category' ? { alloc_scope: 'category', alloc_category_node_id: nodeId, alloc_category: nodeName }
          : { alloc_scope: 'products', alloc_product_ids: productIds };
    draft.setCreatorAllocation(campaignId, setId, agreementId, alloc);
    navigation.goBack();
  }

  const canSave =
    scope === 'store'
    || (scope === 'category' && !!nodeId)
    || (scope === 'products' && productIds.length > 0);

  const summary =
    scope === 'store'
      ? `${creatorName} can sell everything you list, and anything you add later.`
      : scope === 'category' && nodeName
        ? `${creatorName} can sell ${countFor(nodeId) ?? '—'} products, and anything you add to ${nodeName} later.`
        : scope === 'products' && productIds.length
          ? `${creatorName} can sell exactly these ${productIds.length}. New products do not join.`
          : null;

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>What {creatorName} can sell</Text>
          <Text style={s.sub}>PICK HOW MUCH OF YOUR STORE</Text>
        </View>
      </View>

      {loading ? (
        <View style={[s.container, s.center]}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Opt
            on={scope === 'store'} onPress={() => setScope('store')}
            title="Your whole store" chip={storeCount != null ? String(storeCount) : ''}
            body="Everything you list, now and in future. New products join automatically."
          />
          <Opt
            on={scope === 'category'} onPress={() => setScope('category')}
            title="A category" chip={nodeId ? String(countFor(nodeId) ?? '') : ''}
            body="Pick one branch of your catalogue. Everything under it comes with it, including things you add later."
          />
          <Opt
            on={scope === 'products'} onPress={() => setScope('products')}
            title="Specific products" chip={productIds.length ? String(productIds.length) : 'CHOOSE'}
            body="Hand-pick exactly what she may sell. New products do not join automatically."
          />

          {scope === 'category' && (
            <View style={s.sec2}>
              <Text style={s.dh}>Which category</Text>
              {tree.length === 0 ? (
                <Text style={s.help}>
                  Your catalogue has no category tree yet. Pick &quot;your whole store&quot; or hand-pick
                  products instead, and tag your products on the web when you get a chance.
                </Text>
              ) : (
                <View style={s.chips}>
                  {tree.map(n => (
                    <TouchableOpacity
                      key={n.id}
                      style={[s.chip, nodeId === n.id && s.chipOn]}
                      onPress={() => { setNodeId(n.id); setNodeName(n.name); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.chipT, nodeId === n.id && s.chipTOn]}>
                        {n.path}{n.product_count != null ? ` · ${n.product_count}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!!nodeName && (
                <Text style={s.help}>Picking {nodeName} includes everything beneath it.</Text>
              )}
            </View>
          )}

          {scope === 'products' && (
            <View style={s.sec2}>
              <Text style={s.dh}>Which products</Text>
              <TouchableOpacity style={[s.btn, s.btnSec]} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
                <Text style={s.btnSecT}>
                  {productIds.length ? `${productIds.length} chosen · change` : 'Choose products'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!!summary && (
            <View style={s.sec}>
              <View style={s.noteG}>
                <Text style={s.noteGT}>✓ {summary}</Text>
              </View>
            </View>
          )}

          <View style={s.sec}>
            <TouchableOpacity
              style={[s.btn, s.btnPri, !canSave && s.btnOff]}
              disabled={!canSave}
              onPress={save}
              activeOpacity={0.85}
            >
              <Text style={s.btnPriT}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <ProductPickerModal
        visible={pickerOpen}
        multi
        selected={productIds}
        title={`What ${creatorName} can sell`}
        onClose={() => setPickerOpen(false)}
        onDone={(rows) => { setProductIds(rows.map(r => r.id)); setPickerOpen(false); }}
      />
    </View>
  );
}

function Opt({ on, onPress, title, chip, body }) {
  return (
    <TouchableOpacity style={[s.opt, on && s.optOn]} onPress={onPress} activeOpacity={0.8}>
      <View style={s.optHd}>
        <Text style={s.optT}>{title}</Text>
        {!!chip && (
          <View style={[s.optChip, on && s.optChipOn]}>
            <Text style={[s.optChipT, on && s.optChipTOn]}>{chip}</Text>
          </View>
        )}
      </View>
      <Text style={s.optD}>{body}</Text>
    </TouchableOpacity>
  );
}

/**
 * The tree arrives nested. A flat list with a readable path — "Women › Ethnic Wear › Saree"
 * — is what fits a phone, and it is the same shape BrandCategoryPickerScreen already uses,
 * so a brand recognises it from the request composer.
 */
function flatten(nodes, prefix = [], out = []) {
  (nodes || []).forEach((n) => {
    const path = [...prefix, n.name];
    out.push({ id: n.id, name: n.name, path: path.join(' › '), product_count: n.product_count });
    if (n.children?.length) flatten(n.children, path, out);
  });
  return out;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  opt: { marginHorizontal: 14, marginTop: 10, borderWidth: 1, borderColor: ig.line, borderRadius: 12, padding: 12 },
  optOn: { borderColor: ig.text, borderWidth: 1.5, backgroundColor: ig.bgSoft },
  optHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optT: { fontSize: 13.5, fontWeight: '800', color: ig.text },
  optChip: { backgroundColor: ig.lineSoft, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  optChipOn: { backgroundColor: ig.text },
  optChipT: { fontSize: 9, fontWeight: '800', color: ig.mut },
  optChipTOn: { color: ig.bg },
  optD: { fontSize: 11, color: ig.mut, fontWeight: '650', marginTop: 4, lineHeight: 16 },

  sec: { paddingHorizontal: 14, paddingVertical: 11 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: ig.lineSoft, marginTop: 11 },
  dh: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 9 },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 8, lineHeight: 15 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipOn: { backgroundColor: ig.text, borderColor: ig.text },
  chipT: { fontSize: 11, fontWeight: '700', color: ig.text2 },
  chipTOn: { color: ig.bg },

  noteG: { backgroundColor: ig.greenBg, borderRadius: 11, padding: 12 },
  noteGT: { fontSize: 11.5, color: ig.green, fontWeight: '700', lineHeight: 17 },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnSecT: { fontSize: 13, fontWeight: '800', color: ig.text },
  btnOff: { backgroundColor: ig.lineSoft },
});
