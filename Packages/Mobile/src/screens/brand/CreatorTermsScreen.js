import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import * as draft from '../../utils/campaignDraft';
import CreatorOfferSheet from '../../components/brand/CreatorOfferSheet';
import { settledLine, allocationLabel, offerLine } from '../../utils/agreementSummary';

/**
 * CreatorTermsScreen — SB-30, "her terms". One screen, one creator, everything she is being
 * asked to agree to.
 * Contract: features/stage-a-the-set
 * Board: features/screen-atlas/04-preview/mockups/atlas-brand.html → SB-30
 *
 * WHY THIS SCREEN EXISTS
 * Money, allocation and her offer already lived somewhere — on the per-creator card in
 * StepTerms (SB-29), reached through two separate mini-buttons. What did NOT exist anywhere
 * was where she posts and what she posts: `channels_json` / `formats_json` used to be asked
 * once for the whole SET (step 2). Founder, 2026-09-01, choosing the harder of two options
 * on purpose: move both down to HER row, fully — no set-level default left standing in for
 * a creator who has not been asked. So this screen is the one place that question is answered,
 * and while it is open it reads back the rest of her deal too, exactly as the locked design
 * shows it — nothing summarised away before she has to agree to it.
 *
 * WHAT IS EDITABLE HERE, AND WHAT IS NOT
 * Money (commission / fee) is what was already settled at the handshake — read-only, same as
 * StepTerms today. Allocation and her offer are editable, but routed to the screens that
 * already do that job (BrandAllocationScreen; CreatorOfferSheet, rendered inline here exactly
 * as the wizard renders it) rather than rebuilt a second time. Channels and formats are new
 * and editable here, because nowhere else asks for them per creator.
 *
 * A CONTENT SET CANNOT SIGN WITHOUT FORMATS
 * deliverables.model.js refuses to activate a contract with nothing to deliver — a hard 422
 * at signing, weeks from now. Better she is asked for it here, one tap after picking a
 * creator, than for the brand to discover it at the worst possible moment.
 */
export default function CreatorTermsScreen({ route, navigation }) {
  const { campaignId, setId, agreementId, creatorName, selling, buyingContent, current } = route.params || {};

  const [creator, setCreator] = useState(current);
  const [channels, setChannels] = useState(creator?.channels_json?.allowed || []);
  const [formats, setFormats] = useState(
    FORMATS.map((f) => ({
      type: f.type,
      count: Number((creator?.formats_json || []).find((x) => x.type === f.type)?.count || 0),
    }))
  );
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);

  // Allocation is edited on its own screen (BrandAllocationScreen) and, like the offer below,
  // is written straight to the shared draft — so coming back here has to re-read it, the same
  // way the wizard itself re-syncs on focus.
  useFocusEffect(useCallback(() => {
    const sd = draft.getSetDraft(campaignId, setId);
    const fresh = sd.creators.find((c) => c.agreement_id === agreementId);
    if (fresh) setCreator(fresh);
  }, [campaignId, setId, agreementId]));

  const toggleChannel = (k) =>
    setChannels((cur) => (cur.includes(k) ? cur.filter((c) => c !== k) : [...cur, k]));

  const bump = (type, by) =>
    setFormats((cur) => cur.map((f) => (f.type === type ? { ...f, count: Math.max(0, Number(f.count) + by) } : f)));

  const formatsChosen = formats.filter((f) => Number(f.count) > 0);
  // A content/hybrid creator must have at least one format to sign later; a commission-only
  // creator is never asked (deliverables.model.buysContent governs the same rule server-side).
  const canSave = !buyingContent || formatsChosen.length > 0;

  function save() {
    draft.setCreatorTerms(campaignId, setId, agreementId, {
      channels_json: selling && channels.length ? { allowed: channels } : null,
      formats_json: formatsChosen,
    });
    navigation.goBack();
  }

  const t = creator?.terms || {};

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.kk} numberOfLines={1}>{(creatorName || '').toUpperCase()}</Text>
          <Text style={s.title}>Her terms</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.sec2}>
          <Text style={s.dh}>Already agreed</Text>
          <KV k={selling ? 'She earns' : 'Her fee'} v={settledLine(t) || '—'} />
          {selling && (
            <>
              <KV k="What she can sell" v={allocationLabel(creator?.alloc)} danger={!creator?.alloc?.alloc_scope} />
              <TouchableOpacity
                style={[s.mini, s.miniSec]}
                onPress={() => navigation.navigate('BrandAllocation', {
                  campaignId, setId, agreementId, creatorName, current: creator?.alloc,
                })}
                activeOpacity={0.85}
              >
                <Text style={s.miniSecT}>
                  {creator?.alloc?.alloc_scope ? 'Change what she can sell' : 'Set what she can sell'}
                </Text>
              </TouchableOpacity>

              <KV k="Her offer to shoppers" v={offerLine(creator?.offer)} />
              <TouchableOpacity style={[s.mini, s.miniSec]} onPress={() => setOfferSheetOpen(true)} activeOpacity={0.85}>
                <Text style={s.miniSecT}>{creator?.offer ? 'Change the offer' : 'Give her an offer'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={s.sec2}>
          <Text style={s.dh}>New for this set</Text>

          {selling && (
            <>
              <Text style={s.label}>Where she posts</Text>
              <View style={[s.chips, { marginTop: 6 }]}>
                {CHANNELS.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.chip, channels.includes(c.key) && s.chipOn]}
                    onPress={() => toggleChannel(c.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipT, channels.includes(c.key) && s.chipTOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.help}>
                Guidance, not a gate — it blocks nobody you have already agreed with.
              </Text>
            </>
          )}

          {buyingContent && (
            <>
              <Text style={[s.label, { marginTop: selling ? 16 : 0 }]}>What she makes</Text>
              {FORMATS.map((f) => {
                const row = formats.find((x) => x.type === f.type) || { count: 0 };
                return (
                  <View key={f.type} style={s.stepRow}>
                    <Text style={s.stepRowK}>{f.label}</Text>
                    <View style={s.stepper}>
                      <TouchableOpacity style={s.stepBtn} onPress={() => bump(f.type, -1)} activeOpacity={0.7}>
                        <Icon name="minus" size={14} color={ig.text} />
                      </TouchableOpacity>
                      <Text style={[s.stepN, Number(row.count) === 0 && { color: ig.mut2 }]}>{row.count}</Text>
                      <TouchableOpacity style={s.stepBtn} onPress={() => bump(f.type, 1)} activeOpacity={0.7}>
                        <Icon name="plus" size={14} color={ig.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {!canSave && (
                <Text style={s.err}>This campaign pays for content — give her at least one format.</Text>
              )}
            </>
          )}
        </View>

        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, s.btnPri, !canSave && s.btnOff]}
            disabled={!canSave}
            onPress={save}
            activeOpacity={0.85}
          >
            <Text style={s.btnPriT}>Save · she sees all of this</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CreatorOfferSheet
        visible={offerSheetOpen}
        creator={creator}
        value={creator?.offer || null}
        onClose={() => setOfferSheetOpen(false)}
        onSave={(next) => {
          draft.setCreatorOffer(campaignId, setId, agreementId, next);
          setOfferSheetOpen(false);
        }}
      />
    </View>
  );
}

function KV({ k, v, danger }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={[s.kvV, danger && s.kvVDanger]}>{v}</Text>
    </View>
  );
}

// Batch A — founder, 2026-08-27: Instagram and YouTube only. The server still ACCEPTS the
// other five (campaignChannels.VALID_CHANNELS), and a creator invited before today keeps
// whatever the set gave her — this narrows what a brand may newly pick, not what the
// platform knows. Moved here from BrandSetWizardScreen — stage-a, 2026-09-01.
const CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
];

const FORMATS = [
  { type: 'reel', label: 'Instagram Reel' },
  { type: 'story', label: 'Instagram Story' },
  { type: 'post', label: 'Instagram Post' },
  { type: 'youtube_short', label: 'YouTube Short' },
];

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  kk: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut },
  title: { fontSize: 17, fontWeight: '800', color: ig.text, marginTop: 1 },

  sec: { paddingHorizontal: 14, paddingVertical: 13 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  dh: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 9 },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 6 },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 7, lineHeight: 15 },
  err: { fontSize: 10.5, color: ig.red, fontWeight: '700', marginTop: 8 },

  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  kvK: { fontSize: 12, color: ig.mut, fontWeight: '650' },
  kvV: { fontSize: 12.5, color: ig.text, fontWeight: '800' },
  kvVDanger: { color: ig.red },

  mini: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, marginTop: 2 },
  miniSec: { borderWidth: 1, borderColor: ig.line },
  miniSecT: { fontSize: 11, fontWeight: '800', color: ig.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipOn: { backgroundColor: ig.text, borderColor: ig.text },
  chipT: { fontSize: 11, fontWeight: '700', color: ig.text2 },
  chipTOn: { color: ig.bg },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  stepRowK: { fontSize: 12.5, color: ig.text, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: ig.line, alignItems: 'center', justifyContent: 'center' },
  stepN: { fontSize: 13, fontWeight: '800', color: ig.text, minWidth: 16, textAlign: 'center' },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnOff: { backgroundColor: ig.lineSoft },
});
