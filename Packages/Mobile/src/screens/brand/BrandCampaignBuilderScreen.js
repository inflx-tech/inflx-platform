import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import * as draft from '../../utils/campaignDraft';
import { AIM_SHORT } from '../../utils/agreementSummary';
import { goLiveDayOf, SHOOT_MODE_COPY } from '../../utils/setShape';

/**
 * BrandCampaignBuilderScreen — SB-24, "Campaign builder".
 * Contract: features/stage-a-the-set (cards updated) · features/stage-2-build-a-campaign-from-the-phone (screen itself)
 * Board: features/screen-atlas/04-preview/mockups/atlas-brand.html → SB-24
 *
 * A campaign holds sets. A set is the unit of work: one aim, one go-live day, one way of
 * shooting, one group of creators. Two sets in a campaign are two independent arrangements
 * that happen to share a name — which is why a sales set and a content set can sit here
 * together and each behaves by its own rules.
 *
 * WHAT IS ON THE SERVER AND WHAT IS NOT
 * The campaign and its sets are real draft rows. The creators pencilled into each set are
 * NOT — they live in utils/campaignDraft until Publish, so abandoning the wizard cannot
 * burn an agreement (ledger #77). This screen reads both and says so honestly: a set that
 * exists on the server with nobody in it yet reads "nobody yet", not "0 creators".
 *
 * WHAT THE LOCKED MOCKUP SHOWS THAT THIS SCREEN DOES NOT — YET
 * SB-24 also draws a "Moved out" section — creators who asked for a different day or shoot
 * and were taken out of a set. That is the deferred pool, and it needs columns
 * (deferred_at, deferred_go_live_date, deferred_shoot_mode) that do not exist until
 * migration 170 — Stage B. Genuinely blocked, not skipped; nothing here pretends otherwise.
 */
export default function BrandCampaignBuilderScreen({ route, navigation }) {
  const { campaignId, campaignName } = route.params || {};
  const [campaign, setCampaign] = useState(null);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, force] = useState(0);

  const load = useCallback(async () => {
    const [c, sres] = await Promise.all([
      brandApi.getCampaign(campaignId),
      brandApi.getCampaignSets(campaignId),
    ]);
    if (c?.success) setCampaign(c.data?.campaign || c.data);
    if (sres?.success) setSets(sres.data?.sets || []);
    setLoading(false);
    setRefreshing(false);
  }, [campaignId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // The pencilled creators change on other screens; this list shows their counts.
  useFocusEffect(useCallback(() => draft.subscribe(campaignId, () => force(n => n + 1)), [campaignId]));

  async function removeSet(set) {
    if (sets.length <= 1) {
      Alert.alert('A campaign needs at least one set', 'Add another set first, or delete the whole campaign.');
      return;
    }
    Alert.alert(`Remove "${set.name}"?`, 'Anything you pencilled into it is dropped. No creator has been told anything yet.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const res = await brandApi.deleteCampaignSet(campaignId, set.id);
        if (res?.success) { draft.setSetDraft(campaignId, set.id, { creators: [], offer: null }); load(); }
        else Alert.alert('Could not remove it', res?.error?.message || 'Please try again.');
      } },
    ]);
  }

  function addSet() {
    navigation.navigate('BrandSetWizard', { campaignId, campaignName: campaign?.name || campaignName, setId: null });
  }

  function editSet(set) {
    navigation.navigate('BrandSetWizard', { campaignId, campaignName: campaign?.name || campaignName, setId: set.id });
  }

  if (loading) {
    return <View style={[s.container, s.center]}><ActivityIndicator color={ig.text} /></View>;
  }

  const hasSales = sets.some(x => x.goal === 'conversion');

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {/* stage-a — SB-24's "DRAFT" chip, but reading the real status rather than a
              literal, since a brand can come back to this screen after publishing too. */}
          <Text style={s.kk}>{String(campaign?.status || 'draft').toUpperCase()}</Text>
          <Text style={s.title} numberOfLines={1}>{campaign?.name || campaignName}</Text>
          <Text style={s.sub}>
            {sets.length} SET{sets.length === 1 ? '' : 'S'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ig.text} />}
      >
        <Text style={s.lhd}>Your sets</Text>

        {sets.length === 0 && (
          <View style={s.empty}>
            <Icon name="layers-outline" size={28} color={ig.mut2} />
            <Text style={s.emptyT}>No sets yet</Text>
            <Text style={s.emptyS}>A set is one aim, one group of creators, one offer. Add the first one.</Text>
          </View>
        )}

        {sets.map((set) => {
          const sd = draft.getSetDraft(campaignId, set.id);
          const aim = AIM_SHORT[set.goal] || 'Not set';
          const selling = set.goal === 'conversion' || set.goal === 'hybrid';
          const ready = sd.creators.length > 0 && (!selling || (sd.offer && sd.creators.every(c => c.alloc?.alloc_scope)));
          const goLive = goLiveDayOf(set);
          return (
            <View key={set.id} style={s.card}>
              <View style={s.cardHd}>
                <Text style={s.cardT} numberOfLines={1}>{set.name}</Text>
                <View style={[s.aim, aimStyle(set.goal)]}>
                  <Text style={[s.aimT, aimTextStyle(set.goal)]}>
                    {aim.toUpperCase()}{ready ? ' · READY' : ''}
                  </Text>
                </View>
              </View>
              <View style={s.cardBd}>
                {/* stage-a — the two things every set is defined by (SB-26), read back here
                    so a brand can tell two sets apart without opening either. A set built
                    before set-first has go_live_date null; goLiveDayOf falls back to its old
                    window rather than showing a blank where a real answer exists. */}
                <Row k="Go live" v={goLive ? fmtDate(goLive) : 'Not set'} dim={!goLive} />
                <Row
                  k="Shoot"
                  v={set.shoot_mode ? (SHOOT_MODE_COPY[set.shoot_mode]?.title || set.shoot_mode) : 'Not set'}
                  dim={!set.shoot_mode}
                />
                <Row k="Creators" v={sd.creators.length ? `${sd.creators.length} agreed` : 'nobody yet'} dim={!sd.creators.length} />
                {selling ? (
                  <>
                    <Row k="They can sell" v={allocSummary(sd)} dim={!sd.creators.length} />
                    <Row k="Follower offer" v={sd.offer ? sd.offer.name : 'not chosen'} dim={!sd.offer} />
                  </>
                ) : (
                  <>
                    <Row k="Deliverables" v={formatsSummary(sd)} dim={!sd.creators.some((c) => draft.hasFormats(c))} />
                    <Row
                      k="Budget"
                      v={set.set_budget != null ? `₹${Number(set.set_budget).toLocaleString('en-IN')} · calculated` : 'calculated at step 3'}
                      dim={set.set_budget == null}
                    />
                  </>
                )}
                <View style={s.cardBtns}>
                  <TouchableOpacity style={[s.mini, s.miniSec]} onPress={() => editSet(set)} activeOpacity={0.8}>
                    <Text style={s.miniSecT}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.mini, s.miniDgr]} onPress={() => removeSet(set)} activeOpacity={0.8}>
                    <Text style={s.miniDgrT}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Founder, 2026-08-28: "this is wrong if that campaign has never created, never added
            sets... means ask to add your first set."
            "Another" is a lie on an empty campaign, and the outline style made the ONLY move on
            the screen look secondary to a Review button that was greyed out and unusable. */}
        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, sets.length === 0 ? s.btnPri : s.btnSec]}
            onPress={addSet}
            activeOpacity={0.85}
          >
            <Text style={sets.length === 0 ? s.btnPriT : s.btnSecT}>
              {sets.length === 0 ? 'Add your first set' : '+ Add another set'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Held back until there is one set. Telling someone with none that they may have TWO
            answers a question they have not reached, and buries the one thing to do. */}
        {sets.length > 0 && (
        <View style={s.sec}>
          <View style={s.noteN}>
            <Text style={s.noteT}>
              A campaign can hold a sales set and a content set together.{' '}
              <Text style={s.noteB}>Each behaves by its own aim.</Text>
              {hasSales ? ' Because one set is sales, this campaign has no end date — selling runs until you end it.' : ''}
            </Text>
          </View>
        </View>
        )}

        {/* Kept while empty, and disabled — it says what comes next. But it is no longer the
            most prominent thing on a screen where it cannot be pressed. */}
        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, s.btnPri, sets.length === 0 && s.btnOff]}
            disabled={sets.length === 0}
            onPress={() => navigation.navigate('BrandCampaignReview', { campaignId, campaignName: campaign?.name || campaignName })}
            activeOpacity={0.85}
          >
            <Text style={s.btnPriT}>Review and publish</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ k, v, dim }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, dim && { color: ig.mut2 }]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

function allocSummary(sd) {
  if (!sd.creators.length) return 'nobody yet';
  const set = new Set(sd.creators.map(c => c.alloc?.alloc_scope || 'none'));
  if (set.has('none')) return 'not set for everyone';
  if (set.size === 1 && set.has('store')) return 'your whole store';
  return 'set per creator';
}

// singular, plural — 'story' does not take a bare 's'. Caught while adding the same map's
// twin on CollabDetailScreen (SC-05): the render test there actually mounted the screen and
// read "1 reel + 2 storys" off it.
const FORMAT_WORD = {
  reel: ['reel', 'reels'], post: ['post', 'posts'], story: ['story', 'stories'],
  youtube_video: ['YouTube video', 'YouTube videos'], youtube_short: ['YouTube Short', 'YouTube Shorts'],
};

/**
 * stage-a — formats_json moved off the set and onto each creator (SB-30), same as
 * allocSummary above already reads per-creator scope rather than a set-level field. This
 * used to read set.formats_json directly, which after the move is never written for a new
 * set and would have silently shown "not chosen" for every creator who genuinely has
 * something set on her own row.
 */
function formatsSummary(sd) {
  if (!sd.creators.length) return 'nobody yet';
  const withFormats = sd.creators.filter((c) => draft.hasFormats(c));
  if (!withFormats.length) return 'not chosen';
  if (withFormats.length < sd.creators.length) return 'set for some, not all';
  if (withFormats.length === 1) {
    const list = withFormats[0].formats_json.filter((f) => Number(f.count) > 0);
    return list.map((f) => {
      const [one, many] = FORMAT_WORD[f.type] || [f.type, `${f.type}s`];
      return `${f.count} ${Number(f.count) > 1 ? many : one}`;
    }).join(' + ');
  }
  return 'set per creator';
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const aimStyle = (goal) =>
  goal === 'conversion' ? { backgroundColor: ig.greenBg }
    : goal === 'engagement' ? { backgroundColor: ig.blueBg }
      : goal === 'hybrid' ? { backgroundColor: ig.purpleBg }
        : { backgroundColor: ig.lineSoft };

const aimTextStyle = (goal) =>
  goal === 'conversion' ? { color: ig.green }
    : goal === 'engagement' ? { color: ig.blue }
      : goal === 'hybrid' ? { color: ig.purple }
        : { color: ig.mut };

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  kk: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  lhd: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 6, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase' },

  card: { marginHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: ig.line, borderRadius: 12, overflow: 'hidden' },
  cardHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: ig.bgSoft, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  cardT: { flex: 1, fontSize: 13, fontWeight: '800', color: ig.text },
  aim: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  aimT: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
  cardBd: { paddingHorizontal: 12, paddingVertical: 8 },
  cardBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  mini: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  miniSec: { borderWidth: 1, borderColor: ig.line },
  miniSecT: { fontSize: 11.5, fontWeight: '800', color: ig.text },
  miniDgr: { borderWidth: 1, borderColor: '#F0C4BA' },
  miniDgrT: { fontSize: 11.5, fontWeight: '800', color: ig.red },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { fontSize: 11.5, color: ig.mut, fontWeight: '650' },
  rowV: { flex: 1, fontSize: 11.5, fontWeight: '800', color: ig.text, textAlign: 'right' },

  sec: { paddingHorizontal: 14, paddingVertical: 10 },
  noteN: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 12 },
  noteT: { fontSize: 11.5, color: ig.mut, fontWeight: '700', lineHeight: 17 },
  noteB: { color: ig.text, fontWeight: '800' },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnSecT: { fontSize: 13, fontWeight: '800', color: ig.text },
  btnOff: { backgroundColor: ig.lineSoft },

  empty: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 30, gap: 6 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4 },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },
});
