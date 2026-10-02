/**
 * Item 8 — her pitches (T13, T14).
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * Three live states and five endings, each a plain sentence that answers the
 * only three questions she has: how long they have, what happens next, and
 * when she may try again.
 *
 * Every one of those sentences is written by the server and rendered here as
 * given. A screen that composed its own would eventually say something the
 * server disagreed with, and the disagreement would be about a deadline or a
 * cooldown — exactly the two things she must be able to trust.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { PitchCard8 } from '../../components/pitch/bits8';
import { C8 } from '../../components/pitch/copy8';
import { Header } from '../brand/BrandPitchSettingsScreen';

export default function MyPitchesScreen({ navigation, route }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.myPitches();
    if (!r || !r.success) { setStatus('error'); return; }
    setData(r.data);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** A pitch with an open thread opens the conversation; anything else opens itself. */
  const open = (card) => {
    if (card.negotiation && card.negotiation.open) navigation.navigate('PitchThread', { pitchId: card.id });
    else navigation.navigate('MyPitch', { pitchId: card.id });
  };

  // ui-walk-fixes D3 — this list is drawn two ways. Inside the Collabs tab it is a segment under
  // that page's own title (no `route` is passed). Opened as a screen of its own — where she lands
  // after sending a pitch — it has no bottom tabs, so it carries the title bar and the way back,
  // in every state (item 8 board T14 draws this bar).
  const bar = route ? <Header title={C8.mine.tab} onBack={() => navigation.goBack()} /> : null;

  if (status === 'loading') return <View style={s.page}>{bar}<Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={s.page}>{bar}<LoadError onRetry={load} /></View>;

  const g = data.groups || {};
  const empty = !data.total;

  return (
    <View style={s.page}>
      {bar}
      <ScrollView contentContainerStyle={s.body}>
        {empty ? (
          <EmptyState title={C8.mine.emptyTitle} body={C8.mine.emptyBody} />
        ) : (
          <>
            <Group title={C8.mine.waiting} rows={g.waiting} onPress={open} testID="pitches-waiting" />
            <Group title={C8.mine.agreed} rows={g.agreed} onPress={open} testID="pitches-agreed" />
            <Group title={C8.mine.ended} rows={g.ended} onPress={open} testID="pitches-ended" />
          </>
        )}
      </ScrollView>
      {toast}
    </View>
  );
}

function Group({ title, rows, onPress, testID }) {
  if (!rows || !rows.length) return null;
  return (
    <View testID={testID}>
      <Text style={s.head}>{title}</Text>
      {rows.map((card) => (
        <PitchCard8 key={card.id} card={card} side="creator" onPress={() => onPress(card)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.bg },
  body: { padding: 16, paddingBottom: 40 },
  head: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 0.9, color: T.ink3, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
});
