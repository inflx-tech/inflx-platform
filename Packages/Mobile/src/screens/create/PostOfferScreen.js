/**
 * PostOfferScreen — P5 (step 4): the offer type first (only types she has, with counts; empty types
 * are hidden), then ONE offer of that type with its deal, product count and end date. An offer ending
 * within 7 days of posting carries the warning the brand saw.
 * Contract: features/shoppable-posts-v2 · rules §4.2, §4.8
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP } from '../../components/create/copyCreate';
import { StepTop, ChoiceCard, Footer, Warn, ErrorLine, useDraft, s as b } from '../../components/create/bitsCreate';

export default function PostOfferScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const { post, options, status, reload } = useDraft(postId, { withOptions: true });
  const [type, setType] = useState(null);
  const [offerId, setOfferId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!options) return;
    const current = options.offers.find(o => o.id === (post && post.offer_id));
    setType(current ? current.offer_type : (options.offer_types[0] || {}).key || null);
    setOfferId(current ? current.id : null);
  }, [options, post]);

  const list = options ? options.offers.filter(o => o.offer_type === type) : [];

  async function next() {
    setBusy(true); setErr('');
    const r = await influencerApi.updatePost(postId, { offer_id: offerId, draft_step: 5 });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    navigation.navigate('PostProducts', { postId });
  }

  return (
    <View style={base.screen} testID="post-offer">
      <Header title={CP.offerTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop own={!!(post && post.own_brand)} step={4} question={CP.kindQ} />
            <View style={base.chips}>
              {options.offer_types.map(t => (
                <Chip key={t.key} label={`${t.label} (${t.count})`} selected={type === t.key} onPress={() => { setType(t.key); setOfferId(null); }} testID={`type-${t.key}`} />
              ))}
            </View>
            {options.offer_types_hidden ? <Text style={b.hint}>{options.offer_types_hidden}</Text> : null}
            {type ? <Text style={b.label}>{CP.pickOne((options.offer_types.find(t => t.key === type) || {}).label || '')}</Text> : null}
            {list.map(o => (
              <ChoiceCard key={o.id} title={o.name} sub={CP.offerLine(o)} selected={offerId === o.id} onPress={() => setOfferId(o.id)} testID={`offer-${o.id}`} />
            ))}
            {list.filter(o => o.ends_soon).map(o => <Warn key={o.id} text={o.ends_soon} testID={`ends-soon-${o.id}`} />)}
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.next} disabled={!offerId || busy} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}
