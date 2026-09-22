/**
 * CollabsScreen — F1: the creator's Collabs tab. Item 5 fills the Invites tab (I11, I15) and
 * moves ended invitations to Done after seven days; Active arrives with item 7 and Pitches with
 * item 8. The "Pitch a brand" card sits on the Pitches tab.
 * Contract: features/item3-discovery-profiles-groups (F1) · features/item5-invitations (I11, I15)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { EmptyState, PrimaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton } from '../../components/settings/feedback';
import { s as base } from '../brand/BrandPitchSettingsScreen';
import SegmentedControl from '../../components/shell/SegmentedControl';
import MyPitchesScreen from './MyPitchesScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { C3 } from '../../components/discovery/copy3';
import { LoadErrorList } from '../../components/discovery/DiscoverList';
import { InvitationCard5 } from '../../components/invitations/bits5';
import { C5 } from '../../components/invitations/copy5';

const F = C3.collabs;
// Item 7: Active is real now — a collaboration leaves Invites the moment both
// names are on the agreement. Contract: features/item7-agreement
const TAB_PARAM = { Invites: 'invites', Active: 'active', Done: 'done' };

// Item 8 — the Pitches segment is her own list now, not a card pointing at the
// brand directory. Contract: features/item8-pitch

export default function CollabsScreen({ navigation, route }) {
  const [segment, setSegment] = useState(route?.params?.segment || F.segments[0]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    const tab = TAB_PARAM[segment];
    if (!tab) { setStatus('ready'); setRows([]); return; }
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myInvitations(tab);
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.rows || []); setStatus('ready');
  }, [segment]);
  useFocusEffect(useCallback(() => { setStatus('loading'); load(); }, [load]));

  const [title, body] = segment === 'Invites' ? [C5.creator.emptyTitle, C5.creator.emptyBody]
    : segment === 'Done' ? [C5.creator.doneEmptyTitle, C5.creator.doneEmptyBody] : (F.empty[segment] || F.empty.Invites);

  return (
    <View style={base.screen} testID="collabs">
      <View style={{ paddingTop: 54, paddingHorizontal: 18 }}>
        <Text style={s.title}>Collabs</Text>
        <SegmentedControl segments={F.segments} value={segment} onChange={setSegment} testID="collabs-segments" />
      </View>
      {segment === 'Pitches' ? (
        <View style={{ flex: 1 }}>
          {/* The way in stays at the top; the list of what she sent is below it. */}
          <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
            <View style={s.card} testID="pitch-card">
              <Text style={s.cardTitle}>{F.cardTitle}</Text>
              <Text style={s.cardBody}>{F.cardBody}</Text>
              <View style={{ marginTop: 12 }}><PrimaryButton label={F.cardButton} onPress={() => navigation.navigate('FindBrands')} testID="find-brands" /></View>
            </View>
          </View>
          <MyPitchesScreen navigation={navigation} />
        </View>
      ) : null}
      {segment === 'Pitches' ? null : status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadErrorList what={C5.creator.loadWhat} onRetry={load} /> : (
        <FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} testID={`collabs-${segment.toLowerCase()}`}
          renderItem={({ item }) => (
            // Item 6: a card with a conversation opens the thread; the rest open the invitation.
            // Item 7: an agreement that is hers to read opens the agreement; a
            // conversation opens the thread; everything else opens the invitation.
            // Item 10: a card with a store visit under way opens the visit — the live thing.
            // Item 11: a Remote collaboration opens the Remote screen, and it does so from the
            // moment it is signed — on Remote SHE moves first, so "Send your delivery address"
            // has to be reachable before anything exists to describe.
            <InvitationCard5 card={item} onPress={() => navigation.navigate(
              item.shoot ? 'Shoot'
                : item.remote ? 'MyRemote'
                  : item.agreement ? 'Agreement'
                    : (item.negotiation || (item.moveRequest && !item.moveRequest.answer)) ? 'Thread'
                      : 'Invitation',
              { ciId: item.id })} />
          )}
          ListEmptyComponent={<View testID={`collabs-empty-${segment.toLowerCase()}`}><EmptyState title={title} body={body} /></View>} />
      )}
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, marginBottom: 10 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  cardBody: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, marginTop: 4 },
});
