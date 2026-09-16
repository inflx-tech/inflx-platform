/**
 * BrandSetDetailScreen — C7 (draft), C8 (live and locked), C9 (date passed, expired, completed),
 * C10 (duplicate) and the set ⋯ menu from C11. Item 5 adds I9 (the creators grouped by what is
 * happening, "Add creators" opening the picker and hidden once the cutoff has passed) and I10
 * (one creator's ⋯: view terms sent, open profile, withdraw, remove).
 * Contract: features/item4-campaigns-sets · features/item5-invitations · prompt §6.5–§6.8
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, Banner } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { hx } from './BrandCreatorProfileScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { StateChip4, ProgressBar4, CountsLine4 } from '../../components/campaigns/bits4';
import { TextSheet4, DuplicateSheet4 } from '../../components/campaigns/sheets4';
import { C4, MSG4, aimLabel4, modeLabel4, longDate4 } from '../../components/campaigns/copy4';
import { cutoffFor } from './BrandSetEditScreen';
import { GroupHeader5, SetCreatorRow5 } from '../../components/invitations/bits5';
import { TermsSentSheet5 } from '../../components/invitations/sheets5';
import { C5, first } from '../../components/invitations/copy5';

const SD = C4.setDetail;
const S5 = C5.set;

export default function BrandSetDetailScreen({ navigation, route }) {
  const { campaignId, setId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dup, setDup] = useState(null);
  // Item 5 — one creator's menu and its two confirms, and "View terms sent".
  const [creatorMenu, setCreatorMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);       // { kind: 'withdraw' | 'remove', row }
  const [termsSent, setTermsSent] = useState(null);   // the invitation detail
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.setSummary(campaignId, setId);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data); setStatus('ready');
  }, [campaignId, setId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /**
   * Founder, 2026-09-16: "when I create a set it is simply creating set and when I click then
   * opening for add creators — it should show immediately after creating set, then it should
   * ask to add creators."
   *
   * So a set she has just made lands HERE (she sees what she made) and is carried straight on
   * to picking creators; the set stays underneath, so Back from the picker is her new set, not
   * the campaign. A set she is only editing lands here and stops — its "Add creators" button is
   * hers to tap, and it stands only while invitations are still open (posting date − 3 days,
   * the server's canInvite).
   */
  const carriedOn = useRef(false);
  useEffect(() => {
    if (!route?.params?.addCreators || carriedOn.current || !data) return;
    carriedOn.current = true;
    navigation.setParams({ addCreators: undefined });
    const s = data.set;
    if (s && s.canInvite && s.canInvite.ok) {
      navigation.navigate('BrandSetPickCreators', { campaignId, setId, campaignName: data.campaign.name, setName: s.name });
    }
  }, [data, route?.params?.addCreators]); // eslint-disable-line

  const set = data && data.set;
  const title = set ? set.name : (route?.params?.name || '');
  const edit = () => navigation.navigate('BrandSetEdit', { campaignId, campaignName: data.campaign.name, set, dateRules: data.dateRules });
  const addCreators = () => navigation.navigate('BrandSetPickCreators', { campaignId, setId, campaignName: data.campaign.name, setName: set.name });

  async function rename(v) {
    const r = await brandApi.updateCampaignSet(campaignId, setId, { name: v });
    if (!r.success) return r.error?.message || COPY.saveFailed;
    setRenaming(false); load(); show(SD.renamed); return null;
  }
  async function remove() {
    setConfirmDelete(false);
    const r = await brandApi.deleteCampaignSet(campaignId, setId);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    navigation.navigate('BrandCampaignDetail', { campaignId, toast: SD.deleted });
  }
  async function duplicate(body) {
    const r = await brandApi.duplicateSet(campaignId, setId, body);
    if (!r.success) return { error: r.error?.message || COPY.saveFailed, field: r.error?.field };
    setDup(null); navigation.push('BrandSetDetail', { campaignId, setId: r.data.set.id, toast: C4.duplicate.created }); return null;
  }

  // Item 5 — I10
  async function viewTerms(row) {
    const r = await brandApi.invitationDetail(campaignId, setId, row.id);
    if (!r.success) { show(r.error?.message || COPY.loadErrorTitle); return; }
    setTermsSent(r.data.invitation);
  }
  const openProfile = (row) => navigation.navigate('CreatorsTab', { screen: 'BrandCreatorProfile', params: { influencerId: row.influencerId } });
  // Item 6 (N7, N10) — the conversation: her counter, or her request to move.
  const openThread = (row) => navigation.navigate('BrandThread', { campaignId, setId, ciId: row.id });
  // Item 7 — the preview before it is sent, the agreement itself afterwards.
  const openAgreement = (row, preview) => navigation.navigate('BrandAgreement', { campaignId, setId, ciId: row.id, preview: !!preview });
  async function doConfirm() {
    const { kind, row } = confirm;
    setConfirm(null);
    const r = kind === 'withdraw' ? await brandApi.withdrawInvitation(campaignId, setId, row.id) : await brandApi.removeInvitation(campaignId, setId, row.id);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    show(kind === 'withdraw' ? S5.withdrawn : S5.removed);
    load();
  }
  function creatorActions(row) {
    const a = [
      ...(row.actions && row.actions.thread ? [{ label: 'Open the conversation', onPress: () => openThread(row) }] : []),
      { label: S5.menu.viewTerms, onPress: () => viewTerms(row) },
      { label: S5.menu.profile, onPress: () => openProfile(row) },
    ];
    if (row.actions && row.actions.withdraw) a.push({ label: S5.menu.withdraw, destructive: true, onPress: () => setConfirm({ kind: 'withdraw', row }) });
    if (row.actions && row.actions.remove) a.push({ label: S5.menu.remove, destructive: true, onPress: () => setConfirm({ kind: 'remove', row }) });
    return a;
  }

  const right = set ? (
    <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More" style={hx.more} testID="set-menu"><Text style={hx.moreText}>⋯</Text></TouchableOpacity>
  ) : null;
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const draft = set.state === 'draft', live = set.state === 'live', past = set.isPast;
  const canAdd = !!(set.canInvite && set.canInvite.ok);
  const lock = set.locked ? '🔒 ' : '';
  const actions = draft
    ? [{ label: SD.menuEdit, onPress: edit }, { label: SD.menuDuplicate, onPress: () => setDup(set) }, { label: SD.menuDelete, destructive: true, onPress: () => setConfirmDelete(true) }]
    : live
      ? [{ label: SD.menuRename, onPress: () => setRenaming(true) }, { label: SD.menuDuplicate, onPress: () => setDup(set) }]
      : [{ label: SD.menuDuplicate, onPress: () => setDup(set) }];
  const rows = [
    [SD.rows.aim, aimLabel4(set.goal)],
    [SD.rows.mode, modeLabel4(set.shootMode)],
    ...(set.shootMode === 'visit' ? [[SD.rows.branch, set.branch ? set.branch.name : '—']] : []),
    [SD.rows.date, longDate4(set.postingDate)],
    [SD.rows.close, longDate4(set.cutoff)],
  ];
  const creators = data.creators || { order: [], groups: {} };
  const groups = (creators.order || []).map(k => creators.groups[k]).filter(g => g && g.count > 0);

  return (
    <View style={base.screen} testID={`set-detail-${set.state}${set.datePassed ? '-datepassed' : ''}`}>
      <Header title={set.name} onBack={() => navigation.goBack()} right={right} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View style={s.row}><Text style={s.muted}>{data.campaign.name}</Text><StateChip4 state={set.state} datePassed={set.datePassed} testID="set-chip" /></View>

        {live && !set.cutoffPassed && set.daysToCutoff != null ? <View style={s.cut} testID="cutoff-strip"><Text style={s.cutText}>{SD.cutoffIn(set.daysToCutoff, set.cutoff)}</Text></View> : null}
        {draft && set.datePassed ? <View style={s.warn} testID="date-passed"><Text style={s.warnText}>{SD.datePassedWarn}</Text></View> : null}
        {set.state === 'expired' ? <View testID="expired-banner"><Banner title={SD.expiredTitle(set.cutoff)} body={SD.expiredBody(set.counts.declined)} /></View> : null}

        <View style={s.card} testID="set-summary">
          {rows.map(([k, v]) => (
            <View key={k} style={s.kv}><Text style={s.k}>{k}</Text><Text style={s.v}>{lock}{v}</Text></View>
          ))}
        </View>
        {!past ? <Text style={s.lockline} testID="lock-line">🔒 {set.locked ? SD.lockLive : SD.lockDraft}</Text> : null}

        {draft && set.datePassed ? <SecondaryButton label={SD.chooseNewDate} onPress={edit} testID="choose-new-date" /> : null}
        {draft && canAdd ? <PrimaryButton label={SD.addCreators} onPress={addCreators} testID="add-creators" /> : null}
        {draft ? (
          <View style={s.btnrow}>
            <View style={{ flex: 1 }}><SecondaryButton label={SD.edit} onPress={edit} testID="edit-set" /></View>
            <View style={{ width: 8 }} />
            <View style={{ flex: 1 }}><SecondaryButton label={SD.duplicate} onPress={() => setDup(set)} testID="duplicate-set" /></View>
          </View>
        ) : null}
        {draft ? (
          <View style={s.empty} testID="no-creators"><Text style={s.emptyTitle}>{SD.emptyTitle}</Text><Text style={s.emptyBody}>{SD.emptyBody}</Text></View>
        ) : null}

        {live || (past && groups.length) ? (
          <View style={{ marginTop: 14 }} testID="creators-block">
            <View style={s.row}><Text style={s.secth}>{SD.creatorsTitle}</Text><Text style={s.secn}>{set.counts.invited}</Text></View>
            <ProgressBar4 counts={set.counts} />
            <CountsLine4 counts={set.counts} detail />
            {groups.map(g => (
              <View key={g.key} testID={`group-${g.key}`}>
                <GroupHeader5 title={S5.groups[g.key] || g.title} count={g.count} />
                {g.rows.map(row => (
                  <SetCreatorRow5 key={row.id} row={row}
                    // Item 6: a row with a thread or an unanswered move request opens the
                    // conversation; the rest open the ⋯ menu.
                    onPress={() => (row.actions && row.actions.thread ? openThread(row) : row.group === 'deferred' ? openProfile(row) : setCreatorMenu(row))}
                    onMore={() => setCreatorMenu(row)}
                    // Item 7: the chip is the brand's actual next move on that row —
                    // send the agreement, or sign the one she has already signed.
                    onChip={
                      row.actions && row.actions.sendAgreement ? () => openAgreement(row, true)
                        : row.actions && row.actions.signAgreement ? () => openAgreement(row, false)
                        : row.actions && row.actions.thread ? () => openThread(row)
                        : undefined
                    } />
                ))}
                {g.more ? <Text style={s.more}>{S5.more(g.more)}</Text> : null}
              </View>
            ))}
            {live ? (
              <View style={s.btnrow}>
                {canAdd ? <><View style={{ flex: 1 }}><SecondaryButton label={SD.addCreators} onPress={addCreators} testID="add-creators" /></View><View style={{ width: 8 }} /></> : null}
                <View style={{ flex: 1 }}><SecondaryButton label={SD.duplicate} onPress={() => setDup(set)} testID="duplicate-set" /></View>
              </View>
            ) : null}
          </View>
        ) : null}
        {set.state === 'expired' ? <View style={{ marginTop: 12 }}><SecondaryButton label={SD.duplicateNewDate} onPress={() => setDup(set)} testID="duplicate-new-date" /></View> : null}
        {set.state === 'completed' ? <Text style={[s.muted, { marginTop: 12 }]} testID="completed-line">{SD.completedLine(set.counts.signed)}</Text> : null}
      </ScrollView>
      {toast}
      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={actions} />
      <ActionSheet visible={!!creatorMenu} onClose={() => setCreatorMenu(null)} actions={creatorMenu ? creatorActions(creatorMenu) : []} />
      <TextSheet4 visible={renaming} title={SD.renameTitle} label={C4.set.nameLabel} initial={set.name} max={60} emptyMessage={MSG4.SET_NAME} onSubmit={rename} onClose={() => setRenaming(false)} testID="rename-set" />
      <ConfirmSheet visible={confirmDelete} danger title={SD.deleteTitle(set.name)} body={SD.deleteBody} confirmLabel={SD.del} cancelLabel={SD.keep} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
      <ConfirmSheet visible={!!confirm && confirm.kind === 'withdraw'} danger title={confirm ? S5.withdrawTitle(first(confirm.row.name)) : ''} body={S5.withdrawBody} info={S5.termsHint} confirmLabel={S5.withdraw} cancelLabel={S5.keep} onConfirm={doConfirm} onCancel={() => setConfirm(null)} />
      <ConfirmSheet visible={!!confirm && confirm.kind === 'remove'} danger title={confirm ? S5.removeTitle(first(confirm.row.name)) : ''} body={S5.removeBody} confirmLabel={S5.remove} cancelLabel={S5.keep} onConfirm={doConfirm} onCancel={() => setConfirm(null)} />
      <TermsSentSheet5 visible={!!termsSent} invitation={termsSent} onClose={() => setTermsSent(null)} />
      <DuplicateSheet4 set={dup} earliest={data.dateRules.earliestPostingDate} cutoffFor={cutoffFor} onCreate={duplicate} onClose={() => setDup(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2 },
  cut: { marginTop: 12, borderRadius: 12, padding: 10, backgroundColor: T.state.waiting.bg },
  cutText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg },
  warn: { marginTop: 12, borderRadius: 12, padding: 10, backgroundColor: T.state.yourMove.bg },
  warnText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.yourMove.fg },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 12, marginTop: 12 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border, gap: 10 },
  k: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  v: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1 },
  lockline: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 8, marginBottom: 12 },
  btnrow: { flexDirection: 'row', marginTop: 10 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.border, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 12 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  emptyBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  secth: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  secn: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
  more: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2, marginTop: 6 },
});
