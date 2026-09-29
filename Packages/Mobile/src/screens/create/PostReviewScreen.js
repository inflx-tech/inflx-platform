/**
 * PostReviewScreen — P11 (step 8): the caption, and what the post carries — the four things shoppers
 * filter by. Category, offer and price band are worked out by the server; theme is hers. Sending goes
 * to INFLX, not the brand. For a sent-back post (fix: true) the parts she may change (founder Q2)
 * open from here, and the button is "Fix and send again".
 * Contract: features/shoppable-posts-v2 · rules §4.6
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP } from '../../components/create/copyCreate';
import { Footer, ErrorLine, useDraft, s as b } from '../../components/create/bitsCreate';

function Fact({ label, value, note, onEdit, testID }) {
  return (
    <View style={r.fact} testID={testID}>
      <Text style={r.factLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <Text style={r.factValue}>{value}</Text>
        {note ? <Text style={r.factNote}>{note}</Text> : null}
      </View>
      {onEdit ? <TouchableOpacity onPress={onEdit} testID={`${testID}-edit`}><Text style={r.edit}>{CP.edit}</Text></TouchableOpacity> : null}
    </View>
  );
}

export default function PostReviewScreen({ navigation, route }) {
  const { postId, fix } = route.params || {};
  const { post, status, reload } = useDraft(postId);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (post) setCaption(post.caption || ''); }, [post]);

  async function send() {
    setBusy(true); setErr('');
    const saved = await influencerApi.updatePost(postId, { caption });
    if (!saved.success) { setBusy(false); setErr(saved.error?.message || ''); return; }
    const r = await influencerApi.submitPost(postId);
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    navigation.navigate('PostStatus', { postId, justSent: true });
  }

  const go = (name) => navigation.navigate(name, { postId, fix: true });
  const f = post && post.facets;
  return (
    <View style={base.screen} testID="post-review">
      <Header title={CP.reviewTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {post.media.map((m, i) => (
                <View key={m.id} style={r.slide}>
                  {post.media_kind === 'image' ? <Image source={{ uri: m.url }} style={r.img} /> : <Text style={r.video}>▶</Text>}
                  <Text style={r.n}>{i + 1}</Text>
                </View>
              ))}
            </ScrollView>
            {fix ? <TouchableOpacity onPress={() => go('PostMedia')} testID="edit-media"><Text style={r.edit}>{CP.edit} · {CP.mediaTitle}</Text></TouchableOpacity> : null}
            <Text style={b.label}>{CP.caption}</Text>
            <TextInput value={caption} onChangeText={setCaption} multiline maxLength={2000} placeholder={CP.captionPlaceholder}
              placeholderTextColor={T.ink3} style={r.caption} testID="caption" />
            <Text style={b.label}>{CP.howFound}</Text>
            <Fact label={CP.fCategory} value={f.category ? f.category.join(', ') : '—'} note={CP.fromProducts} testID="fact-category" />
            <Fact label={CP.fOffer} value={f.offer || CP.priceWord} note={f.offer ? CP.fromOffer : null} testID="fact-offer" />
            <Fact label={CP.fPrice} value={f.price_band || '—'} note={f.top_price != null ? CP.costliest(f.top_price) : null} testID="fact-price" />
            <Fact label={CP.fTheme} value={f.theme || '—'} onEdit={fix ? () => go('PostTheme') : null} testID="fact-theme" />
            <Fact label={CP.fFor} value={`${post.collaboration.brand_name} · ${post.collaboration.campaign_name} · ${post.collaboration.set_name}`} testID="fact-for" />
            <Fact label={CP.fProducts} value={String(post.products.length)} note={post.products.map(p => p.name).slice(0, 3).join(' · ')}
              onEdit={fix ? () => go(post.kind === 'price' ? 'PostPrice' : 'PostProducts') : null} testID="fact-products" />
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={fix ? CP.sendAgain : CP.send} disabled={busy} busy={busy} onPress={send} testID="send" />
        </>
      )}
    </View>
  );
}

const r = StyleSheet.create({
  slide: { width: 110, height: 138, borderRadius: 10, backgroundColor: T.surface, marginRight: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  video: { fontSize: 26, color: T.ink2 },
  n: { position: 'absolute', left: 6, top: 6, fontFamily: fonts.sansBold, fontSize: 11, color: T.bg, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  caption: { borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 10, minHeight: 80, textAlignVertical: 'top', fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink },
  fact: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  factLabel: { width: 84, fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink3 },
  factValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  factNote: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 2 },
  edit: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, textDecorationLine: 'underline', marginLeft: 8, marginBottom: 6 },
});
