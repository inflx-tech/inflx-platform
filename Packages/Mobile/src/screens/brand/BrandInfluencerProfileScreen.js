import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import CreatorAvatar from '../../components/CreatorAvatar';
// Dates are chosen, not typed. Contract: features/collab-terms-by-aim (item 2)
import DateField from '../../components/DateField';

/**
 * BrandInfluencerProfileScreen — full influencer detail + invite-to-campaign modal.
 * Flow 20 (2026-05-25): navy-deep hero + orange CTA → ink hero + ink CTA.
 */

// collab-part1-corrections §1.4 — these keys used to be posted straight into
// campaign_influencers.offer_type as 'flat' / 'percentage', while the web wizard
// posted display labels ('Discount', 'Volume discount') into the same
// unconstrained column. Neither was the canonical Offer-Engine vocabulary, so
// collabs created on the two apps could not be compared or reported together.
// The chips keep their own keys for local UI state; `sub_type` is what travels,
// which is exactly the shape the web wizard has always stored for a discount.
const OFFER_TYPES = [
  { key: 'flat',       label: 'Flat Discount (₹)', sub_type: 'flat' },
  { key: 'percentage', label: 'Percentage Off (%)', sub_type: 'pct'  },
];
// Both chips are the same mechanic — a discount. Flat vs percentage is a sub_type.
const CANONICAL_OFFER_TYPE = 'discount';

export default function BrandInfluencerProfileScreen({ route, navigation }) {
  const { influencerId } = route.params;
  const [inf, setInf]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    brandApi.getInfluencer(influencerId).then(res => {
      setLoading(false);
      if (res?.success) setInf(res.data?.influencer || res.data);
      else Alert.alert('Error', res?.error?.message || 'Could not load profile');
    });
  }, [influencerId]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={P.ink} size="large" /></View>;
  }
  if (!inf) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Influencer not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtnFallback}>
          <Text style={s.backFallbackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const niches = Array.isArray(inf.niche) ? inf.niche : (inf.niche ? [inf.niche] : []);
  const langs  = Array.isArray(inf.language) ? inf.language : (inf.language ? [inf.language] : []);
  const pastBrands = Array.isArray(inf.past_brands_json) ? inf.past_brands_json : [];

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Ink hero */}
        <View style={s.hero}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.heroBack}>
            <Text style={s.heroBackText}>‹ Back</Text>
          </TouchableOpacity>

          <CreatorAvatar
            name={inf.full_name || inf.instagram_handle}
            avatarUrl={inf.profile_image_url}
            size={72}
          />
          <View style={s.handleRow}>
            <Text style={s.handle}>@{inf.instagram_handle || 'handle'}</Text>
            {inf.verified ? <Text style={s.verifiedTick}> ✓</Text> : null}
          </View>
          {inf.full_name && <Text style={s.fullName}>{inf.full_name}</Text>}
          {(inf.tier || inf.city) && (
            <Text style={s.heroMeta}>
              {[inf.tier, inf.city, inf.state].filter(Boolean).join(' · ').toUpperCase()}
            </Text>
          )}
        </View>

        {/* Where her audience actually is.
            Founder, 2026-08-22: "if i click on that creator it should display their
            data like their followers in social medias (currently only insta and
            youtube) and inflx following".

            Three separate figures, not one total, because they are not the same
            people and they are not worth the same. Instagram reach is who might SEE
            a post. INFLX following is who can BUY without leaving. INFLX leads for
            that reason.

            Never summed — adding them would invent an audience that does not exist,
            since the same person can be in two of them.
            Contract: features/creator-photo-and-reach */}
        <View style={s.reachRow}>
          <Reach
            label="INFLX"
            value={inf.inflx_followers != null ? fmtCompact(inf.inflx_followers) : '—'}
            note={inf.inflx_followers ? 'can buy here' : 'no followers yet'}
            lead
          />
          <Reach
            label="Instagram"
            value={inf.followers_count != null ? fmtCompact(inf.followers_count) : '—'}
            note={inf.instagram_handle ? `@${inf.instagram_handle}` : 'not connected'}
          />
          {/* No subscriber count exists anywhere on this platform yet, so a number
              here would be invented. Saying so beats showing a confident zero. */}
          <Reach
            label="YouTube"
            value="—"
            note={inf.youtube_handle ? 'not counted yet' : 'not connected'}
            muted
          />
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <Stat label="ER %"      value={inf.engagement_rate != null ? `${parseFloat(inf.engagement_rate).toFixed(1)}%` : '—'} />
          <Stat label="Avg Views" value={fmtCompact(inf.avg_views)} />
          <Stat label="Posts"     value={inf.total_posts ?? '—'} />
          <Stat label="Avg Likes" value={fmtCompact(inf.avg_likes)} />
          <Stat label="Avg Cmts"  value={fmtCompact(inf.avg_comments)} />
        </View>

        {inf.bio ? (
          <Card title="About">
            <Text style={s.bioText}>{inf.bio}</Text>
          </Card>
        ) : null}

        {(niches.length > 0 || langs.length > 0) && (
          <Card title="Niches & Languages">
            {niches.length > 0 && (
              <View style={s.chipList}>
                {niches.map(n => (
                  <View key={`n-${n}`} style={s.chipNiche}>
                    <Text style={s.chipNicheText}>{n}</Text>
                  </View>
                ))}
              </View>
            )}
            {langs.length > 0 && (
              <View style={[s.chipList, { marginTop: 8 }]}>
                {langs.map(l => (
                  <View key={`l-${l}`} style={s.chipLang}>
                    <Text style={s.chipLangText}>{l}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {(inf.price_per_post_min || inf.price_per_post_max) && (
          <Card title="Typical Pricing (per post)">
            <Text style={s.priceText}>
              {inf.price_per_post_min && inf.price_per_post_max
                ? `${fmtRupees(inf.price_per_post_min)} – ${fmtRupees(inf.price_per_post_max)}`
                : fmtRupees(inf.price_per_post_min || inf.price_per_post_max)}
            </Text>
            <Text style={s.hint}>Indicative range set by the influencer — actual fee is negotiated.</Text>
          </Card>
        )}

        {pastBrands.length > 0 && (
          <Card title="Past Brands">
            {pastBrands.slice(0, 5).map((pb, i) => (
              <Text key={i} style={s.pastBrandRow}>• {typeof pb === 'string' ? pb : pb.name || JSON.stringify(pb)}</Text>
            ))}
          </Card>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={s.footerBar}>
        {/* stage-a/b — architecture change, founder 2026-09-02: "only through campaign
            and sets we ask for collaboration." "Ask {name}" (agree terms first, place her
            in a campaign afterwards) is retired — BrandRequestComposer is unreachable from
            anywhere in the app now. "Invite to Campaign" below was always the direct path
            and is untouched; it is now the only one. */}
        <TouchableOpacity style={[s.inviteBtn, { backgroundColor: P.ink }]} onPress={() => setInviteOpen(true)} activeOpacity={0.85}>
          <Text style={[s.inviteBtnText, { color: P.white }]}>Invite to Campaign</Text>
        </TouchableOpacity>
      </View>

      <InviteModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        influencer={inf}
        navigation={navigation}
      />
    </View>
  );
}

function InviteModal({ visible, onClose, influencer, navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [pickedCampaign, setPickedCampaign] = useState(null);
  const [sets, setSets]         = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [pickedSet, setPickedSet] = useState(null);

  const [agreedFee, setAgreedFee]     = useState('');
  const [commissionPct, setCommissionPct] = useState('');
  const [offerType, setOfferType]     = useState('flat');
  const [offerValue, setOfferValue]   = useState('');
  const [postingDate, setPostingDate] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (visible) loadCampaigns();
    else resetAll();
  }, [visible]);

  function resetAll() {
    setPickedCampaign(null); setPickedSet(null); setSets([]);
    setAgreedFee(''); setCommissionPct(''); setOfferType('flat');
    setOfferValue(''); setPostingDate('');
  }

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    const res = await brandApi.getCampaigns();
    setLoadingCampaigns(false);
    if (res?.success) {
      const eligible = (res.data?.campaigns || []).filter(c =>
        ['published', 'active', 'live'].includes(c.status)
      );
      setCampaigns(eligible);
    }
  }

  async function pickCampaign(c) {
    setPickedCampaign(c);
    setPickedSet(null);
    setLoadingSets(true);
    const res = await brandApi.getCampaignSets(c.id);
    setLoadingSets(false);
    if (res?.success) setSets(res.data?.sets || []);
  }

  function pickSet(set) {
    setPickedSet(set);
    if (set.per_influencer_budget) setAgreedFee(String(set.per_influencer_budget));
    else if (set.set_budget) setAgreedFee('');
    const goal = (set.goal || '').toLowerCase();
    if (goal === 'conversion' || goal === 'hybrid') {
      setCommissionPct(influencer?.default_commission_pct ? String(influencer.default_commission_pct) : '10');
      setOfferType('flat');
      setOfferValue('10');
    }
  }

  async function submitInvite() {
    if (!pickedCampaign || !pickedSet) return;
    const goal = (pickedSet.goal || '').toLowerCase();
    const payload = { influencer_id: influencer.id };
    if (postingDate) payload.posting_date = postingDate;

    if (goal === 'engagement' || goal === 'hybrid') {
      const fee = parseFloat(agreedFee);
      if (!fee || fee <= 0) {
        Alert.alert('Fee required', 'Enter the agreed fee in rupees for this influencer.');
        return;
      }
      payload.agreed_fee = fee;
      payload.influencer_budget = fee;
    }
    if (goal === 'conversion' || goal === 'hybrid') {
      if (!offerType) { Alert.alert('Missing info', 'Pick an offer type.'); return; }
      const valueNum = parseFloat(offerValue);
      if (!valueNum || valueNum <= 0) { Alert.alert('Missing info', 'Enter the offer value.'); return; }
      // The server now validates this config (it did not before), and a pct
      // discount over 100 is rejected there. Catch it here so the brand gets a
      // clear message instead of a 422.
      if (offerType === 'percentage' && valueNum > 100) {
        Alert.alert('Check the value', 'A percentage discount cannot be more than 100%.');
        return;
      }
      payload.offer_type = CANONICAL_OFFER_TYPE;
      payload.offer_config_json = {
        sub_type: OFFER_TYPES.find(t => t.key === offerType)?.sub_type || 'flat',
        value: valueNum,
        // Scope defaults to 'store' server-side when no products are listed, but
        // stating it keeps the stored config self-describing and matches what this
        // screen has always meant: not limited to a hand-picked product list.
        scope: 'store',
        products: [],
      };
      const cpct = parseFloat(commissionPct);
      if (cpct > 0) payload.commission_pct = cpct;
    }

    setSubmitting(true);
    const res = await brandApi.inviteInfluencer(pickedCampaign.id, pickedSet.id, payload);
    setSubmitting(false);

    if (res?.success) {
      Alert.alert(
        'Invite Sent',
        `@${influencer.instagram_handle || 'Influencer'} has been invited to "${pickedCampaign.name}" and will be notified.`,
        [{ text: 'OK', onPress: () => { onClose(); navigation.goBack(); } }]
      );
    } else {
      Alert.alert('Invite failed', res?.error?.message || 'Could not send invite.');
    }
  }

  const setGoal = (pickedSet?.goal || '').toLowerCase();
  const needsFee        = setGoal === 'engagement' || setGoal === 'hybrid';
  const needsCommission = setGoal === 'conversion' || setGoal === 'hybrid';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalBackdrop} />
        <View style={s.modalSheet}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Invite to Campaign</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>×</Text></TouchableOpacity>
          </View>

          <ScrollView>
            {!pickedCampaign && (
              <>
                <Text style={s.stepTitle}>1. Pick a campaign</Text>
                {loadingCampaigns ? (
                  <ActivityIndicator color={P.ink} style={{ marginVertical: 20 }} />
                ) : campaigns.length === 0 ? (
                  <View style={s.emptyPanel}>
                    <Text style={s.emptyPanelTitle}>No eligible campaigns</Text>
                    <Text style={s.emptyPanelBody}>
                      You need a published or active campaign to invite influencers. Create one from the web dashboard first.
                    </Text>
                  </View>
                ) : (
                  campaigns.map(c => (
                    <TouchableOpacity key={c.id} style={s.pickRow} onPress={() => pickCampaign(c)} activeOpacity={0.85}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.pickRowTitle} numberOfLines={1}>{c.name}</Text>
                        <Text style={s.pickRowMeta}>{(c.status || '').replace(/_/g, ' ')}{c.total_budget ? ` · ₹${Number(c.total_budget).toLocaleString('en-IN')}` : ''}</Text>
                      </View>
                      <Text style={s.chev}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {pickedCampaign && !pickedSet && (
              <>
                <TouchableOpacity onPress={() => setPickedCampaign(null)} style={s.breadcrumbBack}>
                  <Text style={s.breadcrumbBackText}>‹ Change campaign</Text>
                </TouchableOpacity>
                <Text style={s.stepTitle}>2. Pick a set in "{pickedCampaign.name}"</Text>
                {loadingSets ? (
                  <ActivityIndicator color={P.ink} style={{ marginVertical: 20 }} />
                ) : sets.length === 0 ? (
                  <Text style={s.emptyPanelBody}>This campaign has no sets yet.</Text>
                ) : (
                  sets.map(set => (
                    <TouchableOpacity key={set.id} style={s.pickRow} onPress={() => pickSet(set)} activeOpacity={0.85}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.pickRowTitle} numberOfLines={1}>{set.name}</Text>
                        <Text style={s.pickRowMeta}>
                          {(set.goal || '').replace(/_/g, ' ')}
                          {set.per_influencer_budget ? ` · ₹${Number(set.per_influencer_budget).toLocaleString('en-IN')} per influencer` : ''}
                        </Text>
                      </View>
                      <Text style={s.chev}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {pickedCampaign && pickedSet && (
              <>
                <TouchableOpacity onPress={() => setPickedSet(null)} style={s.breadcrumbBack}>
                  <Text style={s.breadcrumbBackText}>‹ Change set</Text>
                </TouchableOpacity>
                <Text style={s.stepTitle}>3. Invite details</Text>

                <View style={s.confirmCard}>
                  <Text style={s.confirmLabel}>Campaign</Text>
                  <Text style={s.confirmValue}>{pickedCampaign.name}</Text>
                  <Text style={s.confirmLabel}>Set · Goal</Text>
                  <Text style={s.confirmValue}>{pickedSet.name} · {(pickedSet.goal || '').replace(/_/g, ' ')}</Text>
                  <Text style={s.confirmLabel}>Influencer</Text>
                  <Text style={s.confirmValue}>@{influencer.instagram_handle}</Text>
                </View>

                {needsFee && (
                  <Field label="Agreed fee (rupees)" hint="The influencer can counter this during negotiation.">
                    <TextInput
                      style={s.input}
                      value={agreedFee}
                      onChangeText={t => setAgreedFee(t.replace(/[^\d.]/g, ''))}
                      placeholder="e.g. 3000"
                      placeholderTextColor={P.muted3}
                      keyboardType="decimal-pad"
                    />
                  </Field>
                )}
                {needsCommission && (
                  <>
                    <Field label="Offer type">
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {OFFER_TYPES.map(t => (
                          <TouchableOpacity
                            key={t.key}
                            style={[s.offerTypeChip, offerType === t.key && s.offerTypeChipActive]}
                            onPress={() => setOfferType(t.key)}
                          >
                            <Text style={[s.offerTypeChipText, offerType === t.key && s.offerTypeChipTextActive]}>{t.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Field>
                    <Field label={offerType === 'percentage' ? 'Discount %' : 'Discount amount (₹)'}>
                      <TextInput
                        style={s.input}
                        value={offerValue}
                        onChangeText={t => setOfferValue(t.replace(/[^\d.]/g, ''))}
                        placeholder={offerType === 'percentage' ? 'e.g. 15' : 'e.g. 100'}
                        placeholderTextColor={P.muted3}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                    <Field label="Influencer commission %">
                      <TextInput
                        style={s.input}
                        value={commissionPct}
                        onChangeText={t => setCommissionPct(t.replace(/[^\d.]/g, ''))}
                        placeholder="e.g. 10"
                        placeholderTextColor={P.muted3}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                  </>
                )}

                <Field label="Posting date (optional)" hint="She has 48 hours to accept — leave blank if flexible.">
                  <DateField
                    value={postingDate}
                    onChange={setPostingDate}
                    placeholder="Any date is fine"
                    style={{ marginBottom: 0 }}
                  />
                </Field>

                <TouchableOpacity
                  style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submitInvite}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? <ActivityIndicator color={P.white} /> : <Text style={s.submitBtnText}>Send Invite</Text>}
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * One audience, with a plain word about what it is worth. The note matters as much
 * as the number: "150" means nothing until you know whether those people can buy.
 */
function Reach({ label, value, note, lead, muted }) {
  return (
    <View style={[s.reach, lead && s.reachLead]}>
      <Text style={[s.reachLabel, lead && s.reachLabelLead]}>{label.toUpperCase()}</Text>
      <Text style={[s.reachValue, muted && s.reachValueMuted]}>{value}</Text>
      <Text style={s.reachNote}>{note}</Text>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.statTile}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value ?? '—'}</Text>
    </View>
  );
}

function Card({ title, children }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function fmtCompact(n) {
  const num = Number(n);
  if (!isFinite(num) || num == null) return '—';
  if (num >= 10000000) return (num / 10000000).toFixed(1) + ' Cr';
  if (num >= 100000)   return (num / 100000).toFixed(1) + ' L';
  if (num >= 1000)     return (num / 1000).toFixed(1) + ' K';
  return String(num);
}

const s = StyleSheet.create({
  reachRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 14 },
  reach: {
    flex: 1, backgroundColor: P.white, borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 10, borderWidth: 1, borderColor: P.border, alignItems: 'center',
  },
  reachLead: { borderColor: P.ink, borderWidth: 1.5 },
  reachLabel: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted, letterSpacing: 0.4 },
  reachLabelLead: { color: P.ink },
  reachValue: { fontFamily: fonts.displayBlack, fontSize: 19, color: P.ink, marginTop: 4 },
  reachValueMuted: { color: P.muted2 },
  reachNote: { fontFamily: fonts.sansRegular, fontSize: 9, color: P.muted2, marginTop: 3, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: P.bg },
  errorText: { fontFamily: fonts.sansBold, fontSize: 14, color: P.muted, marginBottom: 12 },
  backBtnFallback: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: P.ink },
  backFallbackText: { fontFamily: fonts.sansBold, fontSize: 12, color: P.white, fontWeight: '800' },

  hero: { backgroundColor: P.white, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 24, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  heroBack: { alignSelf: 'flex-start', marginBottom: 14 },
  heroBackText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted2, fontWeight: '600' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 26, fontWeight: '900', color: P.ink },
  handleRow: { flexDirection: 'row', alignItems: 'center' },
  handle: { fontFamily: fonts.displayBold, fontSize: 20, fontWeight: '800', color: P.ink, letterSpacing: -0.3 },
  verifiedTick: { fontFamily: fonts.displayBold, fontSize: 14, color: P.ink, fontWeight: '900' },
  fullName: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: P.muted2, marginTop: 3 },
  heroMeta: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2, marginTop: 6, letterSpacing: 0.4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 7 },
  statTile: { width: '31.8%', backgroundColor: P.white, borderRadius: 10, padding: 9, borderWidth: 1, borderColor: P.border },
  statLabel: { fontFamily: fonts.monoBold, fontSize: 8.5, color: P.muted2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '900', color: P.ink, marginTop: 3 },

  card: { margin: 12, marginBottom: 0, backgroundColor: P.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: P.border },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 10.5, fontWeight: '800', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  bioText: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.ink, lineHeight: 18 },
  priceText: { fontFamily: fonts.monoBold, fontSize: 13, color: P.ink, fontWeight: '700' },
  hint: { fontFamily: fonts.sansMedium, fontSize: 10, color: P.muted2, marginTop: 4 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chipNiche: { backgroundColor: P.bg2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  chipNicheText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.ink },
  chipLang: { backgroundColor: P.engPale, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  chipLangText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.eng },
  pastBrandRow: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, lineHeight: 20 },

  footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.border, padding: 12 },
  inviteBtn: { backgroundColor: P.ink, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  inviteBtnText: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.white},

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 17, fontWeight: '800', color: P.ink },
  modalClose: { fontFamily: fonts.monoBold, fontSize: 22, color: P.muted2, paddingHorizontal: 4, lineHeight: 22 },
  stepTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 10, marginTop: 4 },
  breadcrumbBack: { paddingVertical: 6 },
  breadcrumbBackText: { fontFamily: fonts.sansBold, fontSize: 12, color: P.ink, fontWeight: '700' },

  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 6, backgroundColor: P.white },
  pickRowTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700', color: P.ink },
  pickRowMeta: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2, marginTop: 2 },
  chev: { fontFamily: fonts.monoBold, fontSize: 18, color: P.muted2, fontWeight: '800' },

  emptyPanel: { backgroundColor: P.bg2, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: P.bg2, borderStyle: 'dashed' },
  emptyPanelTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 6 },
  emptyPanelBody: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, textAlign: 'center', lineHeight: 16 },

  confirmCard: { backgroundColor: P.bg2, borderWidth: 1, borderColor: P.bg2, borderRadius: 12, padding: 12, marginBottom: 14 },
  confirmLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  confirmValue: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700', color: P.ink, marginTop: 2 },

  field: { marginBottom: 12 },
  fieldLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '700', color: P.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldHint: { fontFamily: fonts.sansMedium, fontSize: 10, color: P.muted2, marginTop: 4 },
  input: { fontFamily: fonts.sansMedium, borderWidth: 1.5, borderColor: P.border, backgroundColor: P.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: P.ink },

  offerTypeChip: { flex: 1, backgroundColor: P.bg, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  offerTypeChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  offerTypeChipText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.muted },
  offerTypeChipTextActive: { color: P.white, fontFamily: fonts.monoBold },

  submitBtn: { backgroundColor: P.ink, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  submitBtnText: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.white},
});
