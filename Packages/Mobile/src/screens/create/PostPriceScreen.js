/**
 * PostPriceScreen — P8 (steps 4–5): a price post. Only her products without offers. A price band
 * (the five set by INFLX) and categories only filter the list; the post's real band is worked out
 * from its products. At least 1 product. Also used to fix a sent-back price post.
 * Contract: features/shoppable-posts-v2 · rules §4.2, §4.4, §4.6
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP } from '../../components/create/copyCreate';
import { StepTop, Footer, ErrorLine, useDraft, s as b } from '../../components/create/bitsCreate';
import { ProductPick } from './PostProductsScreen';

const inBand = (band, price) => !band || (band.max_price != null ? price <= band.max_price : price >= band.min_price);

/** The categories her products sit in: each parent path with its leaves (Men › Topwear → Shirts, T-shirts). */
export function categoryGroups(products) {
  const groups = new Map();
  for (const p of products) {
    const path = p.path || [];
    if (!path.length) continue;
    const leaf = path[path.length - 1];
    const parent = path.slice(0, -1).map(n => n.name).join(' › ') || leaf.name;
    const g = groups.get(parent) || { parent, leaves: new Map() };
    g.leaves.set(leaf.id, leaf.name);
    groups.set(parent, g);
  }
  return [...groups.values()].map(g => ({ parent: g.parent, leaves: [...g.leaves.entries()].map(([id, name]) => ({ id, name })) }));
}

export default function PostPriceScreen({ navigation, route }) {
  const { postId, fix } = route.params || {};
  const { post, options, status, reload } = useDraft(postId, { withOptions: true });
  const [bandId, setBandId] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!post || !options) return;
    const st = post.draft_state || {};
    setBandId(st.band_id || (options.price_bands[1] || options.price_bands[0] || {}).id || null);
    setLeaves(st.leaf_ids || []);
    setPicked(post.products.map(x => x.id));
  }, [post, options]);

  const band = options ? options.price_bands.find(x => x.id === bandId) : null;
  const groups = useMemo(() => (options ? categoryGroups(options.price_products) : []), [options]);
  const shown = options ? options.price_products.filter(p => inBand(band, p.price) && (!leaves.length || leaves.includes(p.leaf_id))) : [];
  const toggle = (id) => setPicked(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));
  const toggleLeaf = (id) => setLeaves(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));

  async function next() {
    setBusy(true); setErr('');
    const body = { product_ids: picked, draft_state: { band_id: bandId, leaf_ids: leaves } };
    const r = await influencerApi.updatePost(postId, fix ? body : { ...body, draft_step: 6 });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    if (fix) navigation.goBack(); else navigation.navigate('PostTheme', { postId });
  }

  return (
    <View style={base.screen} testID="post-price">
      <Header title={CP.priceTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop step={fix ? null : 4} question={CP.band} />
            <View style={base.chips}>
              {options.price_bands.map(x => <Chip key={x.id} label={x.label} selected={bandId === x.id} onPress={() => setBandId(x.id)} testID={`band-${x.label}`} />)}
            </View>
            {band ? <Text style={b.hint}>{CP.bandHint(band.label)}</Text> : null}
            <Text style={b.label}>{CP.category}</Text>
            {groups.map(g => (
              <View key={g.parent} style={{ marginBottom: 6 }}>
                <Text style={b.rowMeta}>{g.parent}</Text>
                <View style={[base.chips, { marginTop: 6 }]}>
                  {g.leaves.map(l => <Chip key={l.id} label={l.name} selected={leaves.includes(l.id)} onPress={() => toggleLeaf(l.id)} testID={`leaf-${l.name}`} />)}
                </View>
              </View>
            ))}
            {shown.length ? shown.map(p => (
              <ProductPick key={p.id} p={p} on={picked.includes(p.id)} onPress={() => toggle(p.id)} testID={`pick-${p.id}`} />
            )) : <Text style={b.hint}>{CP.noneInBand}</Text>}
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.nextN(picked.length, picked.length === 1 ? 'product' : 'products')} disabled={busy || !picked.length} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}
