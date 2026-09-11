/**
 * CollabsScreen — F1: the creator's Collabs tab. Four segments with their empty states
 * (invitations and pitches arrive with items 5 and 8) and the "Pitch a brand" card that
 * opens Find brands. Contract: features/item3-discovery-profiles-groups · prompt §6.6 F1
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { EmptyState, PrimaryButton } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { s as base } from '../brand/BrandPitchSettingsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import useRouteToast from '../../hooks/useRouteToast';
import { C3 } from '../../components/discovery/copy3';

const F = C3.collabs;

export default function CollabsScreen({ navigation, route }) {
  const [segment, setSegment] = useState(F.segments[0]);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);
  const [title, body] = F.empty[segment] || F.empty.Invites;
  return (
    <View style={base.screen} testID="collabs">
      <View style={{ paddingTop: 54, paddingHorizontal: 18 }}>
        <Text style={s.title}>Collabs</Text>
        <SegmentedControl segments={F.segments} value={segment} onChange={setSegment} testID="collabs-segments" />
      </View>
      <View style={{ padding: 18 }}>
        <View style={s.card} testID="pitch-card">
          <Text style={s.cardTitle}>{F.cardTitle}</Text>
          <Text style={s.cardBody}>{F.cardBody}</Text>
          <View style={{ marginTop: 12 }}><PrimaryButton label={F.cardButton} onPress={() => navigation.navigate('FindBrands')} testID="find-brands" /></View>
        </View>
        <EmptyState title={title} body={body} />
      </View>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, marginBottom: 10 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 16 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  cardBody: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, marginTop: 4 },
});
