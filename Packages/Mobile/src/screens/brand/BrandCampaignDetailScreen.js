/**
 * BrandCampaignDetailScreen — C6 (the campaign's sets, newest first, past sets tucked away) and
 * C11 (the campaign ⋯ menu and delete confirm). C9's state extras render inside each set card.
 * Contract: features/item4-campaigns-sets · prompt §6.4, §6.8
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { SecondaryButton, Banner } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { hx } from './BrandCreatorProfileScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { StateChip4, SetCard4 } from '../../components/campaigns/bits4';
import { TextSheet4, DuplicateSheet4 } from '../../components/campaigns/sheets4';
import { C4, MSG4 } from '../../components/campaigns/copy4';
import { C6 } from '../../components/negotiation/copy6';
import { cutoffFor } from './BrandSetEditScreen';

const D = C4.detail;

export default function BrandCampaignDetailScreen({ navigation, route }) {
  const { campaignId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(null);       // 'rename' | 'desc'
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dup, setDup] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.campaignSummary(campaignId);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data); setStatus('ready');
  }, [campaignId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const c = data && data.campaign;
  const title = c ? c.name : (route?.params?.name || '');
  const nextLetter = () => String.fromCharCode(65 + Math.min(25, (c ? c.setCount : 0)));
  const goNewSet = () => navigation.navigate('BrandSetEdit', { campaignId, campaignName: c.name, dateRules: data.dateRules, suggestedName: C4.set.suggestedName(nextLetter()) });
  const openSet = (set) => navigation.navigate('BrandSetDetail', { campaignId, setId: set.id, name: set.name });

  async function patch(body, okToast) {
    const r = await brandApi.updateCampaign(campaignId, body);
    if (!r.success) return r.error?.message || COPY.saveFailed;
    setSheet(null); load(); show(okToast); return null;
  }
  async function remove() {
    setConfirmDelete(false);
    const r = await brandApi.deleteCampaign(campaignId);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    navigation.navigate('BrandCampaigns', { segment: 'Drafts', toast: D.deleted });
  }
  async function duplicate(body) {
    const r = await brandApi.duplicateSet(campaignId, dup.id, body);
    if (!r.success) return { error: r.error?.message || COPY.saveFailed, field: r.error?.field };
    setDup(null); navigation.navigate('BrandSetDetail', { campaignId, setId: r.data.set.id, toast: C4.duplicate.created }); return null;
  }

  const right = c ? (
    <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More" style={hx.more} testID="campaign-menu"><Text style={hx.moreText}>⋯</Text></TouchableOpacity>
  ) : null;
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const current = data.sets.current, past = data.sets.past;
  const menuActions = [
    { label: D.menuRename, onPress: () => setSheet('rename') },
    { label: D.menuDesc, onPress: () => setSheet('desc') },
    // Item 6 (N18): the switch may be changed at any time; it governs only new counters.
    { label: `${C6.switch.menu}: ${c.allowNegotiation === false ? C6.switch.off : C6.switch.on}`, onPress: () => patch({ allow_negotiation: c.allowNegotiation === false }, C6.switch.saved) },
  ];
  if (c.canDelete) menuActions.push({ label: D.menuDelete, destructive: true, onPress: () => setConfirmDelete(true) });

  const extras = (set) => {
    if (set.state === 'draft' && set.datePassed) return (
      <View testID={`date-passed-${set.id}`}>
        <View style={s.warn}><Text style={s.warnText}>{C4.setDetail.datePassedWarn}</Text></View>
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><SecondaryButton label={C4.setDetail.chooseNewDate} onPress={() => navigation.navigate('BrandSetEdit', { campaignId, campaignName: c.name, set, dateRules: data.dateRules })} testID={`choose-date-${set.id}`} /></View>
      </View>
    );
    if (set.state === 'expired') return (
      <View testID={`expired-${set.id}`}>
        <Banner title={C4.setDetail.expiredTitle(set.cutoff)} body={C4.setDetail.expiredBody(set.counts.declined)} />
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><SecondaryButton label={C4.setDetail.duplicateNewDate} onPress={() => setDup(set)} testID={`dup-expired-${set.id}`} /></View>
      </View>
    );
    return null;
  };

  return (
    <View style={base.screen} testID="campaign-detail">
      <Header title={c.name} onBack={() => navigation.goBack()} right={right} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View style={s.row}><Text style={s.muted}>{D.created(c.createdAt)}</Text><StateChip4 state={c.state} testID="campaign-chip" /></View>
        {c.brief ? <Text style={s.brief} testID="campaign-brief">{c.brief}</Text> : null}
        <View style={[s.row, { marginTop: 14, marginBottom: 8 }]}><Text style={s.secth}>{D.setsTitle}</Text><Text style={s.secn}>{current.length}</Text></View>
        {current.map(set => <SetCard4 key={set.id} s={set} onPress={() => openSet(set)}>{extras(set)}</SetCard4>)}
        <SecondaryButton label={`+ ${D.addSet}`} onPress={goNewSet} testID="add-set" />
        {past.length ? (
          <TouchableOpacity onPress={() => setShowPast(v => !v)} style={{ paddingVertical: 12 }} testID="toggle-past" accessibilityRole="button">
            <Text style={s.link}>{showPast ? D.hidePast : D.showPast(past.length)}</Text>
          </TouchableOpacity>
        ) : null}
        {showPast ? past.map(set => <SetCard4 key={set.id} s={set} onPress={() => openSet(set)}>{extras(set)}</SetCard4>) : null}
      </ScrollView>
      {toast}
      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={menuActions} />
      <TextSheet4 visible={sheet === 'rename'} title={D.renameTitle} label={C4.newCampaign.nameLabel} initial={c.name} max={60} emptyMessage={MSG4.CAMPAIGN_NAME}
        onSubmit={(v) => patch({ name: v }, D.renamed)} onClose={() => setSheet(null)} testID="rename-campaign" />
      <TextSheet4 visible={sheet === 'desc'} title={D.descTitle} label={C4.newCampaign.descLabel} initial={c.brief || ''} max={200} multiline required={false} hint={C4.newCampaign.descHint} placeholder={C4.newCampaign.descPlaceholder}
        emptyMessage={MSG4.CAMPAIGN_DESC_LONG} onSubmit={(v) => patch({ brief: v || null }, D.descSaved)} onClose={() => setSheet(null)} testID="edit-desc" />
      <ConfirmSheet visible={confirmDelete} danger title={D.deleteTitle(c.name)} body={D.deleteBody} confirmLabel={C4.setDetail.del} cancelLabel={C4.setDetail.keep} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
      <DuplicateSheet4 set={dup} earliest={data.dateRules.earliestPostingDate} cutoffFor={cutoffFor} onCreate={duplicate} onClose={() => setDup(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2 },
  brief: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, marginTop: 8, lineHeight: 18 },
  secth: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  secn: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
  link: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, textDecorationLine: 'underline', textAlign: 'center' },
  warn: { marginTop: 8, borderRadius: 12, padding: 10, backgroundColor: T.state.yourMove.bg },
  warnText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.yourMove.fg },
});
