import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import CreatorAvatar from '../../components/CreatorAvatar';
import { useNeedsYou, creatorNode } from '../../utils/brandNeedsYou';
import { STEP_LABELS, turnLabel, turnTone, StaleNote } from '../../components/brand/NeedsYou';

/**
 * BrandCreatorSpineScreen — level 4. One creator, her six steps.
 * Contract: features/stage-3-watch-the-work-happen (slice 4)
 * Board: 04-preview/mockups/stage3-screens.html panel ⑤ · FINAL 4
 *
 * THE POINT OF THIS SCREEN
 * The step number comes from the server and the creator's app shows the SAME six with the
 * SAME current step. When a brand rings her and says "we're stuck on step 3", they are
 * looking at one fact, not two internally consistent stories. Nothing here works out where
 * a collaboration has got to; it renders what `collabStep` already decided.
 *
 * WHY A STEP WITH NO BUTTON STILL APPEARS
 * Step 4 is the creator's shop posts, reviewed by the admin desk. The brand never sees them
 * before they are live, and never approves them — a brand veto there becomes a veto over her
 * concept. But HIDING the step would make the collaboration look stalled. Greyed, badged
 * "not yours", with the reason written down, says work is happening and it is not theirs.
 *
 * WHERE A STEP HAS NOWHERE TO GO YET
 * Stages 4 and 5 build the shoot and the go-live screens. Until then those steps say which
 * stage brings them rather than offering a tap that does nothing. A dead tap is worse than
 * an honest sentence.
 */

/** Whose step it is, by number. The one place this is written down for the brand. */
const OWNER = {
  1: 'both',      // agreeing terms was a negotiation
  2: 'both',      // she accepts, the brand countersigns
  3: 'both',      // slot, parcel, shortfall
  4: 'admin',     // her shop posts — quality is the review desk's job
  5: 'brand',     // approve the reel, confirm it is live
  6: 'nobody',    // complete: both read, neither acts
};

const OWNER_BADGE = {
  both:   { label: 'BOTH', bg: ig.yBg, fg: ig.yInk },
  brand:  { label: 'YOURS', bg: ig.yBg, fg: ig.yInk },
  admin:  { label: 'NOT YOURS', bg: ig.purpleBg, fg: ig.purple },
  nobody: { label: '', bg: ig.lineSoft, fg: ig.mut },
};

/**
 * What each step opens, and what to say when nothing does yet.
 * Four of the six already have a screen; the other two name their stage.
 */
function destinationFor(step, ctx) {
  switch (step) {
    case 1:
      return ctx.agreementId
        ? { label: 'See what you agreed', go: () => ctx.nav.navigate('BrandAgreementDetail', { agreement: ctx.agreement }) }
        : { note: 'This collaboration started as a direct invite, so there is no handshake to re-read.' };
    case 2:
      return { label: 'Open the contract', go: () => ctx.nav.navigate('BrandContract', { campaignInfluencerId: ctx.ciId }) };
    case 3:
      return { note: 'Settling a time and sending the goods gets its own screen in Stage 4. Until then this is where it stands.' };
    case 4:
      return { note: 'Our team checks quality. You are told about posts using only your products, once they are live.' };
    case 5:
      return { label: 'Open the review queue', go: () => ctx.nav.navigate('BrandCampaignReviewQueue', { campaignId: ctx.campaignId, initialTab: 'reviews' }) };
    case 6:
      return { label: 'See what it earned', go: () => ctx.nav.navigate('BrandConversions', { campaignId: ctx.campaignId, campaignName: ctx.campaignName }) };
    default:
      return {};
  }
}

export default function BrandCreatorSpineScreen({ route, navigation }) {
  const { campaignInfluencerId, campaignId, campaignName, setName, influencerName } = route.params || {};

  const { tree, failed: needsFailed, refresh: refreshNeeds } = useNeedsYou();
  const node = creatorNode(tree, campaignInfluencerId);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // The live hierarchy carries the assignment's terms and its agreement, which is what
    // steps 1 and 2 need to open anything.
    const res = await brandApi.getCampaignLive(campaignId);
    if (res?.success) {
      const sets = res.data?.sets || res.data?.campaign?.sets || [];
      for (const s of sets) {
        const found = (s.influencers || []).find(x => String(x.id) === String(campaignInfluencerId));
        if (found) { setDetail({ ...found, set_name: s.name, goal: s.goal }); break; }
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [campaignId, campaignInfluencerId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { refreshNeeds(); }, [refreshNeeds]));

  const current = Number(node?.step || 0);
  const name = node?.name || influencerName || 'Creator';

  if (loading) {
    return <View style={[s.container, s.center]}><ActivityIndicator color={ig.text} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <CreatorAvatar name={name} avatarUrl={detail?.profile_image_url} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {[campaignName, setName || detail?.set_name].filter(Boolean).join(' · ').toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 44 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); refreshNeeds(); }} tintColor={ig.text} />}
      >
        <StaleNote failed={needsFailed} />

        {current === 0 && (
          <View style={s.empty}>
            <Icon name="progress-question" size={28} color={ig.mut2} />
            <Text style={s.emptyT}>We can&apos;t say where this one is</Text>
            <Text style={s.emptyS}>
              The step comes from the server so both phones agree. Pull down to try again.
            </Text>
          </View>
        )}

        {current > 0 && (
          <View style={s.spine}>
            {[1, 2, 3, 4, 5, 6].map((step) => {
              const done = step < current;
              const now = step === current;
              const owner = OWNER[step];
              const badge = OWNER_BADGE[owner];
              const dest = destinationFor(step, {
                nav: navigation,
                ciId: campaignInfluencerId,
                campaignId,
                campaignName,
                agreementId: detail?.agreement_id,
                agreement: detail?.agreement,
              });
              const tone = now ? turnTone(node.turn, { asBrand: true }) : null;

              return (
                <View key={step} style={[s.step, now && s.stepNow]}>
                  <View style={s.railCol}>
                    <View style={[
                      s.dot,
                      done && s.dotDone,
                      now && s.dotNow,
                      !done && !now && s.dotTodo,
                      !done && !now && owner === 'admin' && s.dotAdmin,
                    ]}>
                      <Text style={[
                        s.dotTxt,
                        done && { color: ig.bg },
                        now && { color: ig.bg },
                        !done && !now && { color: owner === 'admin' ? ig.purple : ig.mut2 },
                      ]}>{done ? '✓' : step}</Text>
                    </View>
                    {step < 6 && <View style={[s.rail, done && s.railDone]} />}
                  </View>

                  <View style={s.body}>
                    <View style={s.head}>
                      <Text style={[s.stepT, now && s.stepTNow]}>{STEP_LABELS[step]}</Text>
                      {!!badge.label && (
                        <View style={[s.ownerBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[s.ownerTxt, { color: badge.fg }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>

                    {now && (
                      <Text style={[s.turn, { color: tone.fg }]}>
                        {turnLabel(node.turn, { asBrand: true })}
                      </Text>
                    )}

                    {/* A step that is not the brand's still says what is happening in it.
                        Hiding it would make the collaboration look stalled. */}
                    {step === 4 && (
                      <Text style={s.note}>
                        She makes them, our team checks quality. You are told only about posts
                        using <Text style={s.noteB}>only your products</Text>.
                      </Text>
                    )}

                    {now && dest.note && <Text style={s.note}>{dest.note}</Text>}

                    {dest.label && (done || now) && (
                      <TouchableOpacity
                        style={[s.btn, now ? s.btnPri : s.btnSec]}
                        onPress={dest.go}
                        activeOpacity={0.85}
                      >
                        <Text style={now ? s.btnPriT : s.btnSecT}>{dest.label}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.sec}>
          <View style={s.noteN}>
            <Text style={s.noteNT}>
              <Text style={s.noteB}>She sees the same six steps, with the same number.</Text> When
              you ring her and say &quot;we&apos;re stuck on step {current || 3}&quot;, you are both
              looking at the same thing.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  spine: { paddingHorizontal: 14, paddingTop: 8 },
  step: { flexDirection: 'row', gap: 11, paddingBottom: 4 },
  stepNow: {},
  railCol: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  dotDone: { backgroundColor: ig.green },
  dotNow: { backgroundColor: ig.text },
  dotTodo: { backgroundColor: ig.bg, borderWidth: 1.5, borderColor: ig.lineSoft },
  dotAdmin: { backgroundColor: ig.purpleBg, borderColor: '#D9C7F5' },
  dotTxt: { fontSize: 11, fontWeight: '800' },
  rail: { flex: 1, width: 1.5, backgroundColor: ig.lineSoft, marginTop: 2 },
  railDone: { backgroundColor: ig.green },

  body: { flex: 1, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  stepT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  stepTNow: { fontSize: 14 },
  ownerBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  ownerTxt: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.3 },
  turn: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, marginTop: 4 },
  note: { fontSize: 11, color: ig.mut, fontWeight: '650', marginTop: 5, lineHeight: 16 },
  noteB: { color: ig.text, fontWeight: '800' },

  btn: { borderRadius: 9, paddingVertical: 10, alignItems: 'center', marginTop: 9 },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 12, fontWeight: '800', color: ig.bg },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnSecT: { fontSize: 12, fontWeight: '800', color: ig.text },

  sec: { paddingHorizontal: 14, paddingVertical: 14 },
  noteN: { backgroundColor: ig.greenBg, borderRadius: 11, padding: 12 },
  noteNT: { fontSize: 11.5, color: ig.green, fontWeight: '700', lineHeight: 17 },

  empty: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 34, gap: 6 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4 },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },
});
