import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { influencerApi } from '../../services/api';
import {
  mergeCollabs, filterByStage, stageCounts, COLLAB_STAGES, STAGE_META,
} from '../../utils/collabStages';
import StageTabs from '../../components/collabs/StageTabs';
import CollabRow from '../../components/collabs/CollabRow';

/* ════════════════════════════════════════════════════════════════════════
   CollabsListScreen — features/collabs-list (Wave-1 pilot).
   Merges the old Offers + Campaigns tabs into one staged, deduped pipeline.
   Rows route to the EXISTING detail screens (strangler) until CollabDetail
   lands. Frontend-only over existing endpoints.
   ══════════════════════════════════════════════════════════════════════ */
export default function CollabsListScreen({ navigation }) {
  const [collabs, setCollabs] = useState([]);
  const [activeStage, setActiveStage] = useState('invitations');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    // Pull the full picture from both sources; merge + dedupe client-side.
    // Stage 1 — brand requests and her own pitches join the list. Until now they
    // lived under Profile -> Brand Proposals, which is why a real request sat unseen.
    const [offersRes, campaignsRes, requestsRes, pitchesRes] = await Promise.all([
      influencerApi.getOffers(null),        // null = all statuses
      influencerApi.getMyCampaigns('all'),
      influencerApi.listCollabRequests(),
      influencerApi.listMyProposals(),
    ]);
    const offers = offersRes.success ? (offersRes.data?.offers || offersRes.data || []) : [];
    const campaigns = campaignsRes.success ? (campaignsRes.data?.campaigns || []) : [];
    const requests = requestsRes.success ? (requestsRes.data?.requests || []) : [];
    const pitches = pitchesRes.success ? (pitchesRes.data?.proposals || []) : [];
    // Only a total blackout is an error. One source failing must not blank the tab —
    // she would rather see three of her four conversations than none of them.
    if (!offersRes.success && !campaignsRes.success && !requestsRes.success && !pitchesRes.success) {
      setError(true);
    }
    setCollabs(mergeCollabs(offers, campaigns, requests, pitches));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const counts = useMemo(() => stageCounts(collabs), [collabs]);
  const visible = useMemo(() => filterByStage(collabs, activeStage), [collabs, activeStage]);

  // Stage 1 — all six stages, always. The old list hid any stage with nothing in it,
  // so the rail changed shape as work arrived and "Done" was invisible until it was
  // too late to reassure anyone. She should be able to see the whole road.
  const tabs = useMemo(
    () => COLLAB_STAGES.map((k) => ({ key: k, label: STAGE_META[k].label })),
    [],
  );

  const youCount = useMemo(() => collabs.filter(c => c.turn === 'you').length, [collabs]);
  const activeCount = useMemo(
    () => collabs.filter(c => c.stage === 'shoot' || c.stage === 'content').length,
    [collabs],
  );

  function openCollab(c) {
    // A conversation about terms is not yet a collaboration — there is no campaign
    // behind it, so the hub would have nothing to show. Both directions open a thread.
    // Docs/THE_CUT.md pass 1 — 'request' (a brand asking outside any campaign) is gone
    // with the pre-agreement pathway. Her own pitches stay; the founder kept those.
    if (c.source === 'proposal') return navigation.navigate('CollabPitchDetail', { proposalId: c.recordId });
    // Unified hub (features/collab-detail) — one screen for every later stage.
    navigation.navigate('CollabDetail', { campaignInfluencerId: c.ciId });
  }

  const subtitle = loading
    ? 'Loading…'
    : youCount > 0
      ? `${activeCount} active · ${youCount} need you`
      : `${activeCount} active · all caught up`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Collabs</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.6}>
            <Icon name="bell-outline" size={22} color={ig.text} />
          </TouchableOpacity>
        </View>
      </View>

      <StageTabs tabs={tabs} active={activeStage} counts={counts} onChange={setActiveStage} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.ciId)}
          renderItem={({ item }) => <CollabRow collab={item} onPress={() => openCollab(item)} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name={error ? 'alert-circle-outline' : 'inbox-outline'} size={30} color={ig.mut2} />
              <Text style={styles.emptyTitle}>
                {error ? 'Could not load collabs' : `Nothing in ${STAGE_META[activeStage].label}`}
              </Text>
              <Text style={styles.emptySub}>
                {error ? 'Pull to retry.'
                  : activeStage === 'invitations' ? 'When a brand asks to work with you, it lands here.'
                  : activeStage === 'pitches' ? 'Brands you approach appear here.'
                  : activeStage === 'shoot' || activeStage === 'content' ? 'Work in progress appears here once a contract is signed.'
                  : 'Finished collaborations appear here.'}
              </Text>
            </View>
          }
          contentContainerStyle={visible.length === 0 ? { flexGrow: 1 } : { paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  header: { backgroundColor: ig.bg, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: ig.line },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', color: ig.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: ig.mut, marginTop: 2 },
  bell: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: ig.text, marginTop: 12 },
  emptySub: { fontSize: 12.5, color: ig.mut, marginTop: 5, textAlign: 'center' },
});
