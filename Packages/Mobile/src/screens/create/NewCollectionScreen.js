/**
 * NewCollectionScreen — P18 / P19: a name, then her posts OR products, and nothing more. Posts: her
 * live posts, any brand. Products: grouped by collaboration, because the collaboration decides the
 * offer and her commission on each product (M6). Also adds items to an existing collection (P20).
 * Contract: features/shoppable-posts-v2 · rules §4.11 · founder Q5
 *
 * ui-walk-fixes (board C): the page is a FormScroll — the name or search box being typed in stays
 * in view above the button strip, and with the keypad open the first tap on a post or product
 * picks it (a plain scroller spent that tap closing the keypad). The strip was already part of
 * the column here (the Create tab's Footer never floated), so nothing else changes.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll } from '../../components/shell/FormScroll';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP } from '../../components/create/copyCreate';
import { Footer, ErrorLine, s as b } from '../../components/create/bitsCreate';
import { ProductPick } from './PostProductsScreen';

export default function NewCollectionScreen({ navigation, route }) {
  const { collectionId, kind: fixedKind } = route.params || {};
  const adding = !!collectionId;
  const [name, setName] = useState('');
  const [kind, setKind] = useState(fixedKind || 'posts');
  const [opts, setOpts] = useState({});
  const [status, setStatus] = useState('loading');
  const [picked, setPicked] = useState([]);   // posts: ids · products: `${ciId}:${productId}`
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await influencerApi.collectionOptions(kind);
    if (!r.success) { setStatus('error'); return; }
    setOpts(o => ({ ...o, [kind]: r.data })); setStatus('ready');
  }, [kind]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (key) => setPicked(v => (v.includes(key) ? v.filter(x => x !== key) : [...v, key]));
  const items = () => (kind === 'posts'
    ? picked.map(id => ({ post_id: id }))
    : picked.map(k => { const [ci, id] = k.split(':'); return { product_id: id, campaign_influencer_id: ci }; }));

  async function create() {
    setBusy(true); setErr('');
    const r = adding
      ? await influencerApi.updateCollection(collectionId, { add: items() })
      : await influencerApi.createCollection({ name, kind, items: items() });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    if (adding) navigation.goBack(); else navigation.replace('Collection', { collectionId: r.data.collection.id });
  }

  const data = opts[kind];
  const needle = q.trim().toLowerCase();
  return (
    <View style={base.screen} testID="new-collection">
      <Header title={adding ? (kind === 'posts' ? CP.addPosts : CP.addProducts) : CP.newCollectionTitle} onBack={() => navigation.goBack()} />
      <FormScroll contentContainerStyle={{ padding: 16 }} testID="new-collection-scroll">
        {!adding ? (
          <>
            <Text style={b.label}>{CP.name} *</Text>
            <TextInput value={name} onChangeText={setName} maxLength={60} style={inp} testID="collection-name" />
            <Text style={b.label}>{CP.whatGoesIn}</Text>
            <View style={base.chips}>
              <Chip label={CP.myPosts} selected={kind === 'posts'} onPress={() => { setKind('posts'); setPicked([]); }} testID="kind-posts" />
              <Chip label={CP.productsTab} selected={kind === 'products'} onPress={() => { setKind('products'); setPicked([]); }} testID="kind-products" />
            </View>
          </>
        ) : null}
        {status === 'loading' || !data ? <Skeleton rows={3} /> : status === 'error' ? <LoadError onRetry={load} /> : kind === 'posts' ? (
          <>
            {data.posts.length ? data.posts.map(p => (
              <ProductPick key={p.id} p={{ id: p.id, name: `${p.title} · ${p.brand_name}`, image_url: p.cover, price: null, shopper_price: null }}
                on={picked.includes(p.id)} onPress={() => toggle(p.id)} testID={`pick-post-${p.id}`} />
            )) : <Text style={b.hint}>{CP.noLivePosts}</Text>}
            <Text style={b.hint}>{CP.onlyLive}</Text>
          </>
        ) : (
          <>
            <TextInput value={q} onChangeText={setQ} placeholder={CP.searchProducts} placeholderTextColor={T.ink3} style={inp} testID="search" />
            {data.groups.map(g => (
              <View key={g.campaign_influencer_id}>
                <Text style={b.label}>{g.brand_name} · {g.campaign_name} · {g.set_name}</Text>
                {g.products.filter(p => !needle || p.name.toLowerCase().includes(needle)).map(p => {
                  const key = `${g.campaign_influencer_id}:${p.id}`;
                  return <ProductPick key={key} p={{ ...p, name: `${p.name} · ${p.line}`, price: null, shopper_price: null }} on={picked.includes(key)} onPress={() => toggle(key)} testID={`pick-product-${p.id}`} />;
                })}
              </View>
            ))}
          </>
        )}
        <ErrorLine text={err} />
      </FormScroll>
      <Footer label={CP.createN(picked.length, kind)} disabled={busy || !picked.length || (!adding && !name.trim())} busy={busy} onPress={create} testID="create" />
    </View>
  );
}

const inp = { borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink, marginBottom: 8 };
