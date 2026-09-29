/**
 * MyPostsScreen — P14 "Your posts": Live · In review · Sent back · Removed · Drafts. Each row carries
 * its offer (or "Price post") and what it earned; removed posts keep their earnings history; a draft
 * carries on where she stopped and can be deleted.
 * Contract: features/shoppable-posts-v2 · rules §4.2, §4.9
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Chip } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { CP, STATE_LABEL } from '../../components/create/copyCreate';
import { routeFor, s as b } from '../../components/create/bitsCreate';
import { PostRow } from './CreateHomeScreen';

const TABS = [
  { key: 'live', label: STATE_LABEL.live, match: ['live', 'approved'] },
  { key: 'in_review', label: STATE_LABEL.in_review, match: ['in_review'] },
  { key: 'sent_back', label: STATE_LABEL.sent_back, match: ['sent_back'] },
  { key: 'removed', label: STATE_LABEL.removed, match: ['removed'] },
  { key: 'draft', label: CP.drafts, match: ['draft'] },
];

export default function MyPostsScreen({ navigation, route }) {
  const [tab, setTab] = useState((route && route.params && route.params.tab) || 'live');
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    const r = await influencerApi.myShoppablePosts();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const t = TABS.find(x => x.key === tab);
  const count = (x) => x.match.reduce((n, k) => n + ((d && d.counts[k]) || 0), 0);
  const rows = d ? d.posts.filter(p => t.match.includes(p.state)) : [];
  return (
    <View style={base.screen} testID="my-posts">
      <Header title={CP.yourPostsTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={base.chips}>
            {TABS.map(x => <Chip key={x.key} label={`${x.label} ${count(x)}`} selected={tab === x.key} onPress={() => setTab(x.key)} testID={`tab-${x.key}`} />)}
          </View>
          {rows.length ? rows.map(p => (
            <PostRow key={p.id} post={p} onPress={() => { const r = routeFor(p); navigation.navigate(r.name, r.params); }} />
          )) : <Text style={b.hint}>{CP.emptyState(t.label)}</Text>}
        </ScrollView>
      )}
    </View>
  );
}
