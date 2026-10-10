/**
 * PostTypeScreen — P4 (step 3): offer post or price post. An option this collaboration can't offer
 * shows greyed with the reason.
 * Contract: features/shoppable-posts-v2 · rules §4.2
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP } from '../../components/create/copyCreate';
import { O20 } from '../../components/ownbrand/copy20';
import { StepTop, ChoiceCard, Footer, ErrorLine, useDraft } from '../../components/create/bitsCreate';

export default function PostTypeScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const { post, options, status, reload } = useDraft(postId, { withOptions: true });
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (post && post.kind) setKind(post.kind); }, [post]);

  async function next() {
    setBusy(true); setErr('');
    const r = await influencerApi.updatePost(postId, { post_kind: kind, draft_step: kind === 'offer' ? 4 : 5 });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    navigation.navigate(kind === 'offer' ? 'PostOffer' : 'PostPrice', { postId });
  }

  return (
    <View style={base.screen} testID="post-type">
      <Header title={CP.newTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop own={!!(post && post.own_brand)} step={3} question={CP.typeQ} />
            <ChoiceCard title={CP.offerPost} sub={options.kinds.offer.available ? CP.offerPostSub : options.kinds.offer.why}
              meta={options.kinds.offer.available ? (post.own_brand ? O20.offerCount(options.kinds.offer.count) : CP.offerPostCount(options.kinds.offer.count)) : null}
              disabled={!options.kinds.offer.available} selected={kind === 'offer'} onPress={() => setKind('offer')} testID="kind-offer" />
            <ChoiceCard title={CP.pricePost} sub={options.kinds.price.available ? CP.pricePostSub : options.kinds.price.why}
              meta={options.kinds.price.available ? CP.pricePostCount(options.kinds.price.count) : null}
              disabled={!options.kinds.price.available} selected={kind === 'price'} onPress={() => setKind('price')} testID="kind-price" />
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.next} disabled={!kind || busy} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}
