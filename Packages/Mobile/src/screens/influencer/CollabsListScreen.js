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
  const [activeStage, setActiveStage] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    // Pull the full picture from both sources; merge + dedupe client-side.
    const [offersRes, campaignsRes] = await Promise.all([
      influencerApi.getOffers(null),        // null = all statuses
      influencerApi.getMyCampaigns('all'),
    ]);
    const offers = offersRes.success ? (offersRes.data?.offers || offersRes.data || []) : [];
    const campaigns = campaignsRes.success ? (campaignsRes.data?.campaigns || []) : [];
    if (!offersRes.success && !campaignsRes.success) setError(true);
    setCollabs(mergeCollabs(offers, campaigns));
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

  const tabs = useMemo(() => {
    const list = [{ key: 'all', label: STAGE_META.all.label }];
    for (const s of COLLAB_STAGES) {
      if (counts[s] > 0) list.push({ key: s, label: STAGE_META[s].label });
    }
    return list;
  }, [counts]);

  const youCount = useMemo(() => collabs.filter(c => c.turn === 'you').length, [collabs]);
  const activeCount = useMemo(
    () => collabs.filter(c => c.stage === 'active' || c.stage === 'tracking').length,
    [collabs],
  );

  function openCollab(c) {
    // Unified hub (features/collab-detail) — one screen for every stage.
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
                {error ? 'Could not load collabs' : activeStage === 'all' ? 'No collabs yet' : `Nothing in ${STAGE_META[activeStage].label}`}
              </Text>
              <Text style={styles.emptySub}>
                {error ? 'Pull to retry.' : 'New brand offers will show up here.'}
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
