/**
 * Item 19 — the two full lists a Home section opens: "Needs you, all" (BH2 / CH2) and
 * "Waiting on others, all" (BH3 / CH3). One screen for both lists and both apps.
 *
 * route.params: side 'brand' | 'creator', list 'needs' | 'waiting' (set by the navigator).
 * Needs you is in the server's order (H8); the line under the title says what that order is.
 * Waiting on others is split by who is being waited for; the split is the server's `group`.
 * Contract: features/item19-home
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandApi, influencerApi } from '../../services/api';
import { setHomeCount, getHomeCount } from '../../services/homeCount';
import { EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import SegmentedControl from '../../components/shell/SegmentedControl';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { H19 } from '../../components/home/copy19';
import { NeedCard19, s } from '../../components/home/bits19';
import { openRow } from '../../components/home/open19';

export default function HomeListScreen({ navigation, route }) {
  const side = route?.params?.side === 'creator' ? 'creator' : 'brand';
  const list = route?.params?.list === 'waiting' ? 'waiting' : 'needs';
  const api = side === 'creator' ? influencerApi : brandApi;
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);
  const [group, setGroup] = useState(null);

  const load = useCallback(async () => {
    const r = await api.getHomeList(list);
    if (!r || !r.success || !r.data || !Array.isArray(r.data.rows)) { setStatus((st) => (st === 'ready' ? 'ready' : 'error')); return; }
    setD(r.data);
    setStatus('ready');
    if (list === 'needs') setHomeCount({ ...getHomeCount(), needs: r.data.total });
  }, [api, list]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const title = list === 'waiting' ? H19.waiting : H19.needs;
  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={back} /><LoadError onRetry={() => { setStatus('loading'); load(); }} /></View>;

  // Waiting: one segment per group that has rows, labelled with its count.
  const groups = list === 'waiting' ? (d.groups || []).filter((g) => g.count > 0) : [];
  const labels = groups.map((g) => H19.groupTab(g.key, g.count));
  const active = groups.find((g) => g.key === group) || groups[0] || null;
  const rows = list === 'waiting' && active ? d.rows.filter((r) => r.group === active.key) : d.rows;
  const empty = list === 'waiting' ? H19.emptyWaiting : H19.emptyNeeds;

  return (
    <View style={base.screen} testID={`home-list-${list}`}>
      <Header title={title} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 40 }}>
        {list === 'needs' && d.rows.length ? <Text style={s.hint} testID="needs-order">{H19.order[side]}</Text> : null}
        {groups.length > 1 ? (
          <View style={{ marginBottom: 12 }}>
            <SegmentedControl segments={labels} value={H19.groupTab(active.key, active.count)} testID="waiting-groups"
              onChange={(label) => setGroup(groups[labels.indexOf(label)].key)} />
          </View>
        ) : null}
        {rows.length
          ? rows.map((row, i) => <NeedCard19 key={row.id} row={row} side={side} onPress={() => openRow(navigation, side, row)} testID={`row-${i}`} />)
          : <EmptyState title={empty.title} body={empty.body} />}
      </ScrollView>
    </View>
  );
}
