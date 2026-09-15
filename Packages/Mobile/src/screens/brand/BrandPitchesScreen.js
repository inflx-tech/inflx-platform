/**
 * Item 8 — the pitches a brand receives (T5).
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * Her numbers are on the card, because that is the first thing a brand decides
 * on. Grouped by whose move it is, exactly like every other list in the product.
 *
 * A number nobody has measured shows a dash. Never a zero: "0 followers" and
 * "we haven't looked yet" are different facts, and only one of them is a reason
 * to say no.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { GroupHeader5 } from '../../components/invitations/bits5';
import { PitchCard8 } from '../../components/pitch/bits8';
import { C8 } from '../../components/pitch/copy8';

export default function BrandPitchesScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.pitchInbox();
    if (!r || !r.success) { setStatus('error'); return; }
    setData(r.data);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (card) => {
    if (card.negotiation && card.negotiation.open) navigation.navigate('BrandPitchThread', { pitchId: card.id });
    else navigation.navigate('BrandPitch', { pitchId: card.id });
  };

  if (status === 'loading') return <View style={s.page}><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={s.page}><LoadError onRetry={load} /></View>;

  if (!data.total) {
    return <View style={s.page} testID="pitch-inbox-empty"><EmptyState title={C8.brand.emptyTitle} body={C8.brand.emptyBody} /></View>;
  }

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.body}>
        {(data.order || []).map((key) => {
          const g = (data.groups || {})[key];
          if (!g || !g.count) return null;
          return (
            <View key={key} testID={`pitch-group-${key}`}>
              <GroupHeader5 title={g.title} count={g.count} />
              {g.rows.map((card) => (
                <PitchCard8 key={card.id} card={card} side="brand" onPress={() => open(card)} />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.bg },
  body: { padding: 16, paddingBottom: 40 },
});
