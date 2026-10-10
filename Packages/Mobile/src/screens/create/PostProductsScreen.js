/**
 * PostProductsScreen — P6 / P7 (step 5): products from the chosen offer's pool, by the offer's own
 * rule (4.3): Discount/BOGO/Volume any, at least 1 (discount prices as shoppers pay them); pick-any
 * and mix & match at least the pick count; a fixed bundle adds every product for her; a free gift
 * picks from the buy pool and the gift shows by itself. Also used to fix a sent-back post.
 * Contract: features/shoppable-posts-v2 · rules §4.3
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Image } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP, rupeesP } from '../../components/create/copyCreate';
import { StepTop, Footer, ErrorLine, useDraft, s as b } from '../../components/create/bitsCreate';

export function ProductPick({ p, on, onPress, testID }) {
  const cut = p.shopper_price != null && p.shopper_price < p.price;
  return (
    <TouchableOpacity style={b.row} onPress={onPress} testID={testID} accessibilityState={{ checked: !!on }}>
      <View style={[b.box, on && b.boxOn]}>{on ? <Text style={b.boxTick}>✓</Text> : null}</View>
      {p.image_url ? <Image source={{ uri: p.image_url }} style={b.thumb} /> : <View style={b.thumb} />}
      <Text style={b.rowName} numberOfLines={2}>{p.name}</Text>
      {p.price != null ? <Text style={b.rowMeta}>{cut ? rupeesP(p.shopper_price) : rupeesP(p.price)}{' '}</Text> : null}
      {cut ? <Text style={[b.rowMeta, b.strike]}>{rupeesP(p.price)}</Text> : null}
    </TouchableOpacity>
  );
}

export default function PostProductsScreen({ navigation, route }) {
  const { postId, fix } = route.params || {};
  const { post, options, status, reload } = useDraft(postId, { withOptions: true });
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (post) setPicked(post.products.map(x => x.id)); }, [post]);

  const pool = options && options.pool;
  const rule = pool ? pool.rule : { min: 1 };
  const toggle = (id) => setPicked(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));

  async function next() {
    setBusy(true); setErr('');
    const r = await influencerApi.updatePost(postId, fix ? { product_ids: picked } : { product_ids: picked, draft_step: 6 });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    if (fix) navigation.goBack(); else navigation.navigate('PostTheme', { postId });
  }

  return (
    <View style={base.screen} testID="post-products">
      <Header title={CP.pickTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' || !pool ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop own={!!(post && post.own_brand)} step={fix ? null : 5} question={`${pool.name} · ${CP.products(pool.count)}`} />
            {rule.auto ? (
              <View style={b.warn} testID="fixed-all">
                <Text style={[b.rowName, { marginBottom: 4 }]}>{CP.fixedAll(pool.count)}</Text>
                <Text style={b.hint}>{CP.fixedSub}</Text>
              </View>
            ) : (
              <>
                <Text style={b.label} testID="picked">{CP.picked(picked.length)}{picked.length >= rule.min ? ' ✓' : ''}</Text>
                <Text style={b.hint}>{CP.pickAtLeast(rule.min)}</Text>
              </>
            )}
            {rule.gift_words ? <View style={b.warn} testID="gift-words"><Text style={b.warnText}>{rule.gift_words}</Text></View> : null}
            {pool.products.map(p => (
              <ProductPick key={p.id} p={p} on={picked.includes(p.id)} onPress={rule.auto ? undefined : () => toggle(p.id)} testID={`pick-${p.id}`} />
            ))}
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={rule.auto ? CP.next : CP.nextN(picked.length, picked.length === 1 ? 'product' : 'products')}
            disabled={busy || picked.length < rule.min} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}
