/**
 * BrandPoolScreen — N14: "Agreed, needs a set". Creators who agreed the brand's terms but asked
 * for a different date or mode, grouped by what they asked for. Pick the ones that go together and
 * build a set; a set has one Aim, so only one Aim can be selected at a time.
 * Contract: features/item6-negotiation · rules v1.18 §7B · prompt §6.8
 *
 * ui-walk-fixes board C: the "Create a set" strip is part of the column, under the list
 * (BottomBar) — it no longer floats over the last rows; the toast floats just above it.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { GroupHeader5 } from '../../components/invitations/bits5';
import { PoolRow6 } from '../../components/negotiation/bits6';
import { C6, aimLabel6 } from '../../components/negotiation/copy6';

export default function BrandPoolScreen({ navigation, route }) {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(new Map()); // entryId → entry
  const [menu, setMenu] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [pickCampaign, setPickCampaign] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [defaults, setDefaults] = useState(null);
  const { toast, show } = useToast({ inFlow: true });
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.getPool();
    if (!r.success) { setStatus('error'); return; }
    setData(r.data); setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A set has one Aim: once one creator is picked, only her Aim stays selectable (N14's hint).
  const lockedGoal = useMemo(() => (sel.size ? [...sel.values()][0].goal : null), [sel]);
  const toggle = (e) => setSel(prev => { const n = new Map(prev); if (n.has(e.entryId)) n.delete(e.entryId); else n.set(e.entryId, e); return n; });

  /**
   * A set lives inside a campaign, and the pool is brand-level, so the brand names the campaign
   * before item 4's new-set screen opens with the Aim, mode and date already filled in (N15).
   */
  async function createSet() {
    const r = await brandApi.poolSetDefaults([...sel.keys()]);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setDefaults(r.data);
    const cs = await brandApi.campaignsSummary({ limit: 50 });
    setCampaigns(cs.success ? (cs.data.campaigns || []).filter(c => c.state !== 'past') : []);
    setPickCampaign(true);
  }
  function goToNewSet(campaign) {
    setPickCampaign(false);
    navigation.navigate('BrandSetEdit', { campaignId: campaign.id, campaignName: campaign.name, poolDefaults: defaults });
  }
  async function remove(entry) {
    setConfirmRemove(null);
    const r = await brandApi.removeFromPool(entry.entryId);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setSel(prev => { const n = new Map(prev); n.delete(entry.entryId); return n; });
    show(C6.pool.removed); load();
  }

  // ui-walk-fixes (board F, frame F8): "{First} is in your pool." arrives with the route after a
  // pitch is accepted, while the pool is still loading — so the message is drawn in every state.
  if (status === 'loading') return <View style={base.screen}><Header title={C6.pool.title} onBack={() => navigation.goBack()} /><Skeleton />{toast}</View>;
  if (status === 'error') return <View style={base.screen}><Header title={C6.pool.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} />{toast}</View>;

  const groups = data.groups || [];
  return (
    <View style={base.screen} testID="brand-pool">
      <Header title={C6.pool.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the list scrolls in the room above the strip; nothing floats over it. */}
      <FormArea>
      <ScrollView style={s.fill} contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
        <Text style={s.intro}>{C6.pool.intro}</Text>
        {!groups.length ? <EmptyState title={C6.pool.emptyTitle} body={C6.pool.emptyBody} /> : null}
        {groups.map(g => (
          <View key={g.key} testID={`pool-group-${g.key}`}>
            <GroupHeader5 title={g.title} count={g.count} />
            {g.rows.map(e => (
              <PoolRow6 key={e.entryId} entry={e} checked={sel.has(e.entryId)}
                disabled={!!lockedGoal && lockedGoal !== e.goal}
                onToggle={toggle} onMore={setMenu} />
            ))}
          </View>
        ))}
        {groups.length ? <Text style={s.hint} testID="aim-hint">{C6.pool.aimHint}</Text> : null}
      </ScrollView>
      {toast}
      </FormArea>
      {groups.length ? (
        <BottomBar testID="pool-bar">
          <PrimaryButton label={C6.pool.create(sel.size)} onPress={createSet} disabled={!sel.size} testID="pool-create-set" />
        </BottomBar>
      ) : null}
      <ActionSheet visible={!!menu} onClose={() => setMenu(null)} actions={menu ? [
        { label: C6.pool.menuProfile, onPress: () => navigation.navigate('CreatorsTab', { screen: 'BrandCreatorProfile', params: { influencerId: menu.creator.id }, initial: false }) },
        { label: C6.pool.remove, destructive: true, onPress: () => setConfirmRemove(menu) },
      ] : []} />
      <ConfirmSheet visible={!!confirmRemove} danger title={confirmRemove ? `Remove ${confirmRemove.creator.name} from your pool?` : ''}
        body="She keeps nothing waiting with you, and you can still invite her the ordinary way."
        confirmLabel="Remove" cancelLabel="Keep" onConfirm={() => remove(confirmRemove)} onCancel={() => setConfirmRemove(null)} />
      <ActionSheet visible={pickCampaign} onClose={() => setPickCampaign(false)}
        actions={campaigns.length
          ? campaigns.map(c => ({ label: c.name, onPress: () => goToNewSet(c) }))
          : [{ label: 'Make a new campaign first', onPress: () => navigation.navigate('BrandCampaignNew') }]} />
    </View>
  );
}

const s = StyleSheet.create({
  intro: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 18, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 14 },
  // The list fills the box above the strip.
  fill: { flex: 1 },
});
