/**
 * PostCollabScreen — P3 (step 2): which collaboration. Each row says what she can sell, her posting
 * date, how many posts are done, and what she earns. Next makes the draft (every step saves from here).
 * Contract: features/shoppable-posts-v2 · rules §4.2, §4.8
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP } from '../../components/create/copyCreate';
import { StepTop, ChoiceCard, Footer, ErrorLine, s as b } from '../../components/create/bitsCreate';

export default function PostCollabScreen({ navigation, route }) {
  const { brandId } = route.params || {};
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('loading');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await influencerApi.postCollaborations(brandId);
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.collaborations); setStatus('ready');
    const open = r.data.collaborations.filter(x => x.open);
    if (open.length === 1) setPicked(open[0].id);
  }, [brandId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function next() {
    setBusy(true); setErr('');
    const r = await influencerApi.createPost(picked);
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    navigation.navigate('PostType', { postId: r.data.post.id });
  }

  return (
    <View style={base.screen} testID="post-collab">
      <Header title={CP.newTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop step={2} question={CP.collabQ} />
            {rows.map(c => (
              <ChoiceCard key={c.id} title={`${c.campaign_name} · ${c.set_name}`} sub={c.open ? CP.collabLine(c) : c.closed_why}
                meta={c.open ? CP.collabDone(c) : null} selected={picked === c.id} disabled={!c.open}
                onPress={() => setPicked(c.id)} testID={`collab-${c.id}`} />
            ))}
            <Text style={b.hint}>{CP.collabHint}</Text>
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.next} disabled={!picked || busy} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}
