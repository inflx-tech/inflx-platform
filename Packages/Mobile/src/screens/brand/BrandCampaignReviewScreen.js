import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import * as draft from '../../utils/campaignDraft';
import { daysLeft } from '../../utils/agreementSummary';

/**
 * BrandCampaignReviewScreen — drift, blockers, publish.
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 * Board: 04-preview/mockups/stage2-screens.html panel ⑨ · action ledger #63 · #77 · #79
 *
 * PUBLISHING IS TWO THINGS, IN THIS ORDER
 *   1. every creator pencilled into a set becomes ONE invite — which is where the server
 *      consumes her agreement, in a guarded transaction
 *   2. then the campaign is published
 *
 * That order is what makes ledger #77 true. Abandon the wizard before this screen and not
 * one agreement was touched, because not one invite was sent.
 *
 * WHAT THIS SCREEN CHECKS BEFORE OFFERING THE BUTTON
 *   · the picks it is holding, against the ready-to-brief list re-read just now — an
 *     agreement can lapse between being ticked and being published
 *   · the server's own publish-check, which is the SAME evaluation publish enforces, so
 *     the button offered here can never be one the server refuses
 *
 * Drift is WARNED, never blocked. A brand may have a good reason to change a term; what
 * must never happen is changing it silently.
 */
export default function BrandCampaignReviewScreen({ route, navigation }) {
  const { campaignId, campaignName } = route.params || {};

  const [campaign, setCampaign] = useState(null);
  const [sets, setSets] = useState([]);
  const [live, setLive] = useState([]);          // agreements still ready to brief
  const [check, setCheck] = useState(null);      // server publish-check
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    const [c, sres, ag, pc] = await Promise.all([
      brandApi.getCampaign(campaignId),
      brandApi.getCampaignSets(campaignId),
      brandApi.listAgreements(),
      brandApi.getPublishCheck(campaignId),
    ]);
    if (c?.success) setCampaign(c.data?.campaign || c.data);
    if (sres?.success) setSets(sres.data?.sets || []);
    if (ag?.success) setLive(ag.data?.agreements || []);
    if (pc?.success) setCheck(pc.data);
    setLoading(false);
  }, [campaignId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={[s.container, s.center]}><ActivityIndicator color={ig.text} /></View>;
  }

  const liveIds = new Set(live.map(a => a.id));
  const summary = draft.summarise(campaignId, sets);

  // ── Local blockers: what this phone knows and the server cannot, because the picks
  //    have not been sent yet.
  const localBlockers = [];
  const localWarnings = [];

  sets.forEach((set) => {
    const sd = draft.getSetDraft(campaignId, set.id);
    const selling = set.goal === 'conversion' || set.goal === 'hybrid';
    if (!sd.creators.length) {
      localBlockers.push({ code: 'EMPTY_SET', message: `"${set.name}" has no creators in it.` });
      return;
    }
    sd.creators.forEach((c) => {
      if (!liveIds.has(c.agreement_id)) {
        localBlockers.push({
          code: 'AGREEMENT_NOT_LIVE',
          message: `${c.name}'s agreement is no longer live — it has lapsed or been briefed elsewhere. Remove her, or agree terms again from the Creators tab.`,
        });
      } else {
        const d = daysLeft(c.expires_at);
        if (d != null && d <= 14) {
          localWarnings.push({
            code: 'AGREEMENT_EXPIRING',
            message: `${c.name}'s agreement expires in ${d} day${d === 1 ? '' : 's'}. If it lapses before you publish she drops out, and you would have to ask her again from the start.`,
          });
        }
      }
      if (selling && !c.alloc?.alloc_scope) {
        localBlockers.push({
          code: 'NO_ALLOCATION',
          message: `${c.name} has nothing to sell. She would be contracted and invisible in the shopping app — set what she can sell in "${set.name}".`,
        });
      }
    });
    if (selling && !sd.offer) {
      localBlockers.push({
        code: 'NO_SHOPPER_OFFER',
        message: `"${set.name}" has no shopper offer. Nothing gives a shopper a reason to buy through a creator rather than walk into your shop.`,
      });
    }
  });

  // The server's own list. Right now it evaluates a campaign with no assignments yet, so
  // most of it is quiet — but the wallet and any already-invited creator do show, and
  // reading it here means the screen and the server cannot disagree.
  const serverBlockers = (check?.blockers || []).filter(b => b.code !== 'EMPTY_SET');
  const blockers = [...localBlockers, ...serverBlockers];
  const warnings = [...localWarnings, ...(check?.warnings || [])];

  const hasSales = sets.some(x => x.goal === 'conversion');
  const canPublish = blockers.length === 0 && campaign?.status === 'draft';

  async function publish() {
    if (!canPublish || publishing) return;
    setPublishing(true);

    // 1 · every pencilled creator becomes one invite. Stop at the first refusal and say
    //     who it was — a half-published campaign that reports success is worse than a
    //     clear failure, because the brand then does not know who was actually invited.
    const sent = [];
    const driftWarnings = [];
    for (const set of sets) {
      const sd = draft.getSetDraft(campaignId, set.id);
      for (const c of sd.creators) {
        const body = draft.invitePayload(c, set, sd.offer);
        // eslint-disable-next-line no-await-in-loop
        const res = await brandApi.inviteInfluencer(campaignId, set.id, body);
        if (!res?.success) {
          setPublishing(false);
          Alert.alert(
            `Could not brief ${c.name}`,
            `${res?.error?.message || 'The server refused it.'}\n\n` +
            (sent.length
              ? `${sent.length} creator${sent.length === 1 ? ' was' : 's were'} briefed before this: ${sent.join(', ')}. The campaign is still a draft — fix this and publish again.`
              : 'Nothing was briefed. The campaign is still a draft.'),
          );
          load();
          return;
        }
        sent.push(c.name);
        (res.data?.agreement_warnings || []).forEach(w => driftWarnings.push(`${c.name}: ${w}`));
      }
    }

    // 2 · then publish. The server re-runs every blocker; if it refuses here, the invites
    //     stand and the campaign stays a draft, which is recoverable.
    const res = await brandApi.publishCampaign(campaignId);
    setPublishing(false);

    if (!res?.success) {
      const extra = res?.error?.details?.blockers;
      Alert.alert(
        'Not published',
        (res?.error?.message || 'The server refused it.') +
        (Array.isArray(extra) && extra.length > 1 ? `\n\nAlso: ${extra.slice(1).map(b => b.message).join('\n')}` : ''),
      );
      load();
      return;
    }

    draft.clearDraft(campaignId);
    Alert.alert(
      'Published',
      `${sent.length} invite${sent.length === 1 ? '' : 's'} on their way.` +
      (driftWarnings.length ? `\n\nThey are being told what moved:\n${driftWarnings.join('\n')}` : ''),
      [{ text: 'Done', onPress: () => navigation.navigate('CampaignList') }],
    );
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Review</Text>
          <Text style={s.sub} numberOfLines={1}>{(campaign?.name || campaignName || '').toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 44 }}>
        <View style={s.sec2}>
          <KV k="Starts" v={campaign?.start_date ? fmtLong(campaign.start_date) : '—'} />
          <KV k="Ends" v={hasSales ? 'Ongoing · one set is sales' : (campaign?.end_date ? fmtLong(campaign.end_date) : '—')} dim={hasSales} />
          <KV k="Sets" v={String(sets.length)} />
          <KV k="Creators" v={String(summary.creators)} />
          {check?.wallet && (
            <KV
              k="Wallet needed"
              v={`₹${Number(check.wallet.required || 0).toLocaleString('en-IN')}`}
              danger={check.wallet.short > 0}
            />
          )}
        </View>

        <View style={s.sec2}>
          <Text style={s.dh}>Before you publish</Text>
          {blockers.length === 0 && warnings.length === 0 && (
            <View style={s.noteG}><Text style={s.noteGT}>✓ Everything matches what you agreed.</Text></View>
          )}
          {blockers.map((b, i) => (
            <View key={`b${i}`} style={s.noteR}><Text style={s.noteRT}>{b.message}</Text></View>
          ))}
          {warnings.map((w, i) => (
            <View key={`w${i}`} style={s.noteY}><Text style={s.noteYT}>{w.message}</Text></View>
          ))}
        </View>

        {blockers.length === 0 && (
          <View style={s.sec2}>
            <Text style={s.dh}>What happens next</Text>
            <KV k={`${summary.creators} invite${summary.creators === 1 ? '' : 's'} go out`} v="✓" ok />
            <KV k="They accept in one tap" v="✓" ok />
            <KV k={`${summary.creators} agreement${summary.creators === 1 ? '' : 's'} consumed`} v="✓" ok />
            <KV k="Shoot plans created on signing" v="✓" ok />
          </View>
        )}

        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, s.btnPri, !canPublish && s.btnOff]}
            disabled={!canPublish || publishing}
            onPress={publish}
            activeOpacity={0.85}
          >
            {publishing ? <ActivityIndicator color={ig.bg} /> : <Text style={s.btnPriT}>Publish</Text>}
          </TouchableOpacity>
          {!canPublish && campaign?.status !== 'draft' && (
            <Text style={s.blockT}>This campaign is already {campaign?.status}.</Text>
          )}
          <TouchableOpacity style={[s.btn, s.btnSec, { marginTop: 8 }]} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.btnSecT}>{blockers.length ? 'Go back and fix it' : 'Go back to the sets'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.sec}>
          <View style={s.noteN}>
            <Text style={s.noteT}>
              <Text style={s.noteB}>Agreements are consumed on publish, not earlier.</Text> Leaving
              this campaign as a draft keeps every one of them in Ready to brief.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function KV({ k, v, dim, danger, ok }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, dim && { color: ig.mut2 }, danger && { color: ig.red }, ok && { color: ig.green }]}>{v}</Text>
    </View>
  );
}

const fmtLong = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  sec: { paddingHorizontal: 14, paddingVertical: 11 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  dh: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 9 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { flex: 1, fontSize: 11.5, color: ig.mut, fontWeight: '650' },
  rowV: { fontSize: 12.5, fontWeight: '800', color: ig.text, textAlign: 'right' },

  noteG: { backgroundColor: ig.greenBg, borderRadius: 11, padding: 12 },
  noteGT: { fontSize: 11.5, color: ig.green, fontWeight: '700', lineHeight: 17 },
  noteR: { backgroundColor: ig.redBg, borderRadius: 11, padding: 12, marginBottom: 8 },
  noteRT: { fontSize: 11.5, color: ig.red, fontWeight: '700', lineHeight: 17 },
  noteY: { backgroundColor: ig.yBg, borderRadius: 11, padding: 12, marginBottom: 8 },
  noteYT: { fontSize: 11.5, color: ig.yInk, fontWeight: '700', lineHeight: 17 },
  noteN: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 12 },
  noteT: { fontSize: 11.5, color: ig.mut, fontWeight: '700', lineHeight: 17 },
  noteB: { color: ig.text, fontWeight: '800' },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnSecT: { fontSize: 13, fontWeight: '800', color: ig.text },
  btnOff: { backgroundColor: ig.lineSoft },
  blockT: { fontSize: 11, color: ig.mut, fontWeight: '700', textAlign: 'center', marginTop: 8 },
});
