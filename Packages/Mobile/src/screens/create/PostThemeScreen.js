/**
 * PostThemeScreen — P9 (step 6): the 27 theme tags in four groups. At least 1, at most 1 per group:
 * tapping another tag in the same group swaps it. The tags belong to this post only.
 * Contract: features/shoppable-posts-v2 · rules §4.5
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP } from '../../components/create/copyCreate';
import { StepTop, Footer, ErrorLine, useDraft, s as b } from '../../components/create/bitsCreate';

export default function PostThemeScreen({ navigation, route }) {
  const { postId, fix } = route.params || {};
  const { post, options, status, reload } = useDraft(postId, { withOptions: true });
  const [picked, setPicked] = useState({});   // group → tag id
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!post) return;
    const m = {};
    for (const t of post.theme_tags) m[t.group] = t.id;
    setPicked(m);
  }, [post]);

  const ids = Object.values(picked).filter(Boolean);
  const tap = (group, id) => setPicked(v => ({ ...v, [group]: v[group] === id ? null : id }));

  async function next() {
    setBusy(true); setErr('');
    const r = await influencerApi.updatePost(postId, fix ? { theme_tag_ids: ids } : { theme_tag_ids: ids, draft_step: 7 });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    if (fix) navigation.goBack(); else navigation.navigate('PostMedia', { postId });
  }

  return (
    <View style={base.screen} testID="post-theme">
      <Header title={CP.themeTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StepTop step={fix ? null : 6} question={CP.themeTitle} />
            <Text style={b.hint}>{CP.themeHint}</Text>
            {options.theme_tags.map(g => (
              <View key={g.group} style={{ marginTop: 10 }} testID={`group-${g.group}`}>
                <Text style={b.label}>{CP.groups[g.group]} · {picked[g.group] ? `1 ${CP.groupPicked}` : CP.optional}</Text>
                <View style={base.chips}>
                  {g.tags.map(t => <Chip key={t.id} label={t.name} selected={picked[g.group] === t.id} onPress={() => tap(g.group, t.id)} testID={`tag-${t.name}`} />)}
                </View>
              </View>
            ))}
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.nextN(ids.length, ids.length === 1 ? 'tag' : 'tags')} disabled={busy || !ids.length} busy={busy} onPress={next} />
        </>
      )}
    </View>
  );
}
