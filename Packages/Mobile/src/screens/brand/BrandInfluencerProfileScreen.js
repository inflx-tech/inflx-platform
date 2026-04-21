import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const OFFER_TYPES = [
  { key: 'flat',       label: 'Flat Discount (₹)' },
  { key: 'percentage', label: 'Percentage Off (%)' },
];

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
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }
  if (!inf) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Influencer not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnFallback}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const niches = Array.isArray(inf.niche) ? inf.niche : (inf.niche ? [inf.niche] : []);
  const langs  = Array.isArray(inf.language) ? inf.language : (inf.language ? [inf.language] : []);
  const pastBrands = Array.isArray(inf.past_brands_json) ? inf.past_brands_json : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{'<'} Back</Text>
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(inf.instagram_handle || inf.full_name || 'IN').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.handle}>
            @{inf.instagram_handle || 'handle'}
            {inf.verified ? '  ✓' : ''}
          </Text>
          {inf.full_name && <Text style={styles.fullName}>{inf.full_name}</Text>}
          {(inf.tier || inf.city) && (
            <Text style={styles.heroMeta}>
              {[inf.tier, inf.city, inf.state].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <Stat label="Followers" value={fmtCompact(inf.followers_count)} />
          <Stat label="ER %"      value={inf.engagement_rate != null ? `${parseFloat(inf.engagement_rate).toFixed(1)}%` : '—'} />
          <Stat label="Avg Views" value={fmtCompact(inf.avg_views)} />
          <Stat label="Posts"     value={inf.total_posts ?? '—'} />
          <Stat label="Avg Likes" value={fmtCompact(inf.avg_likes)} />
          <Stat label="Avg Cmts"  value={fmtCompact(inf.avg_comments)} />
        </View>

        {/* Bio */}
        {inf.bio ? (
          <Card title="About">
            <Text style={styles.bioText}>{inf.bio}</Text>
          </Card>
        ) : null}

        {/* Niches + languages */}
        {(niches.length > 0 || langs.length > 0) && (
          <Card title="Niches & Languages">
            {niches.length > 0 && (
              <View style={styles.chipList}>
                {niches.map(n => (
                  <View key={`n-${n}`} style={styles.chipSoft}><Text style={styles.chipSoftText}>{n}</Text></View>
                ))}
              </View>
            )}
            {langs.length > 0 && (
              <View style={[styles.chipList, { marginTop: 8 }]}>
                {langs.map(l => (
                  <View key={`l-${l}`} style={[styles.chipSoft, { backgroundColor: colors.tealPale }]}>
                    <Text style={[styles.chipSoftText, { color: colors.tealDeep }]}>{l}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Pricing */}
        {(inf.price_per_post_min || inf.price_per_post_max) && (
          <Card title="Typical Pricing (per post)">
            <Text style={styles.bioText}>
              {inf.price_per_post_min && inf.price_per_post_max
                ? `${fmtRupees(inf.price_per_post_min)} – ${fmtRupees(inf.price_per_post_max)}`
                : fmtRupees(inf.price_per_post_min || inf.price_per_post_max)}
            </Text>
            <Text style={styles.hint}>Indicative range set by the influencer — you'll negotiate the actual fee.</Text>
          </Card>
        )}

        {/* Past brands */}
        {pastBrands.length > 0 && (
          <Card title="Past Brands">
            {pastBrands.slice(0, 5).map((pb, i) => (
              <Text key={i} style={styles.pastBrandRow}>• {typeof pb === 'string' ? pb : pb.name || JSON.stringify(pb)}</Text>
            ))}
          </Card>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Invite CTA (sticky footer) */}
      <View style={styles.footerBar}>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteOpen(true)}>
          <Text style={styles.inviteBtnText}>Invite to Campaign</Text>
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

  // Invite form
  const [agreedFee, setAgreedFee]     = useState('');
  const [commissionPct, setCommissionPct] = useState('');
  const [offerType, setOfferType]     = useState('flat');
  const [offerValue, setOfferValue]   = useState('');
  const [postingDate, setPostingDate] = useState(''); // YYYY-MM-DD
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
      // Only include campaigns that can accept new invites — published / active /
      // live. Draft campaigns are being edited in the web wizard; cancelled /
      // completed campaigns are terminal.
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

  function pickSet(s) {
    setPickedSet(s);
    // Prefill the fee + commission where we can
    if (s.per_influencer_budget) setAgreedFee(String(s.per_influencer_budget));
    else if (s.set_budget) setAgreedFee('');
    const goal = (s.goal || '').toLowerCase();
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
      payload.offer_type = offerType;
      payload.offer_config_json = { value: valueNum };
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
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalBackdrop} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite to Campaign</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>X</Text></TouchableOpacity>
          </View>

          <ScrollView>
            {/* Step 1: pick campaign */}
            {!pickedCampaign && (
              <>
                <Text style={styles.stepTitle}>1. Pick a campaign</Text>
                {loadingCampaigns ? (
                  <ActivityIndicator color={colors.navy} style={{ marginVertical: 20 }} />
                ) : campaigns.length === 0 ? (
                  <View style={styles.emptyPanel}>
                    <Text style={styles.emptyPanelTitle}>No eligible campaigns</Text>
                    <Text style={styles.emptyPanelBody}>
                      You need a published or active campaign to invite influencers. Create one from the web dashboard first.
                    </Text>
                  </View>
                ) : (
                  campaigns.map(c => (
                    <TouchableOpacity key={c.id} style={styles.pickRow} onPress={() => pickCampaign(c)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickRowTitle} numberOfLines={1}>{c.name}</Text>
                        <Text style={styles.pickRowMeta}>{(c.status || '').replace(/_/g, ' ')}{c.total_budget ? ` · ₹${Number(c.total_budget).toLocaleString('en-IN')}` : ''}</Text>
                      </View>
                      <Text style={styles.chev}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {/* Step 2: pick set */}
            {pickedCampaign && !pickedSet && (
              <>
                <TouchableOpacity onPress={() => setPickedCampaign(null)} style={styles.breadcrumbBack}>
                  <Text style={styles.breadcrumbBackText}>‹ Change campaign</Text>
                </TouchableOpacity>
                <Text style={styles.stepTitle}>2. Pick a set in "{pickedCampaign.name}"</Text>
                {loadingSets ? (
                  <ActivityIndicator color={colors.navy} style={{ marginVertical: 20 }} />
                ) : sets.length === 0 ? (
                  <Text style={styles.emptyPanelBody}>This campaign has no sets yet.</Text>
                ) : (
                  sets.map(s => (
                    <TouchableOpacity key={s.id} style={styles.pickRow} onPress={() => pickSet(s)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickRowTitle} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.pickRowMeta}>
                          {(s.goal || '').replace(/_/g, ' ')}
                          {s.per_influencer_budget ? ` · ₹${Number(s.per_influencer_budget).toLocaleString('en-IN')} per influencer` : ''}
                        </Text>
                      </View>
                      <Text style={styles.chev}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {/* Step 3: confirm */}
            {pickedCampaign && pickedSet && (
              <>
                <TouchableOpacity onPress={() => setPickedSet(null)} style={styles.breadcrumbBack}>
                  <Text style={styles.breadcrumbBackText}>‹ Change set</Text>
                </TouchableOpacity>
                <Text style={styles.stepTitle}>3. Invite details</Text>

                <View style={styles.confirmCard}>
                  <Text style={styles.confirmLabel}>Campaign</Text>
                  <Text style={styles.confirmValue}>{pickedCampaign.name}</Text>
                  <Text style={styles.confirmLabel}>Set · Goal</Text>
                  <Text style={styles.confirmValue}>{pickedSet.name} · {(pickedSet.goal || '').replace(/_/g, ' ')}</Text>
                  <Text style={styles.confirmLabel}>Influencer</Text>
                  <Text style={styles.confirmValue}>@{influencer.instagram_handle}</Text>
                </View>

                {needsFee && (
                  <Field label="Agreed fee (rupees)" hint="The influencer can counter this during negotiation.">
                    <TextInput
                      style={styles.input}
                      value={agreedFee}
                      onChangeText={t => setAgreedFee(t.replace(/[^\d.]/g, ''))}
                      placeholder="e.g. 3000"
                      placeholderTextColor={colors.t3}
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
                            style={[styles.offerTypeChip, offerType === t.key && styles.offerTypeChipActive]}
                            onPress={() => setOfferType(t.key)}
                          >
                            <Text style={[styles.offerTypeChipText, offerType === t.key && styles.offerTypeChipTextActive]}>{t.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Field>
                    <Field label={offerType === 'percentage' ? 'Discount %' : 'Discount amount (₹)'}>
                      <TextInput
                        style={styles.input}
                        value={offerValue}
                        onChangeText={t => setOfferValue(t.replace(/[^\d.]/g, ''))}
                        placeholder={offerType === 'percentage' ? 'e.g. 15' : 'e.g. 100'}
                        placeholderTextColor={colors.t3}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                    <Field label="Influencer commission %">
                      <TextInput
                        style={styles.input}
                        value={commissionPct}
                        onChangeText={t => setCommissionPct(t.replace(/[^\d.]/g, ''))}
                        placeholder="e.g. 10"
                        placeholderTextColor={colors.t3}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                  </>
                )}

                <Field label="Posting date (optional)" hint="Format: YYYY-MM-DD. Influencer has 48 hours to accept — leave blank if flexible.">
                  <TextInput
                    style={styles.input}
                    value={postingDate}
                    onChangeText={setPostingDate}
                    placeholder="e.g. 2026-05-15"
                    placeholderTextColor={colors.t3}
                    autoCapitalize="none"
                  />
                </Field>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submitInvite}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitBtnText}>Send Invite</Text>}
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

function Stat({ label, value }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
    </View>
  );
}

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
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

const styles = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 14, color: colors.t2, marginBottom: 12 },
  backBtnFallback: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.navy },
  backText:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  back:      { alignSelf: 'flex-start', marginBottom: 8 },

  hero:      { backgroundColor: colors.navyDeep, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 24, alignItems: 'center' },
  avatar:    { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText:{ fontSize: 26, fontWeight: '900', color: colors.white },
  handle:    { fontSize: 20, fontWeight: '800', color: colors.white },
  fullName:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  heroMeta:  { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6, textTransform: 'capitalize' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  statTile:  { width: '31.5%', backgroundColor: colors.white, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 9, color: colors.t3, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '900', color: colors.t1, marginTop: 4 },

  card:      { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 12, fontWeight: '800', color: colors.t2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  bioText:   { fontSize: 13, color: colors.t1, lineHeight: 19 },
  hint:      { fontSize: 10, color: colors.t3, marginTop: 4 },
  chipList:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipSoft:  { backgroundColor: colors.orangePale || '#FEF0E4', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipSoftText: { fontSize: 11, fontWeight: '700', color: colors.orange },
  pastBrandRow:{ fontSize: 12, color: colors.t2, lineHeight: 20 },

  footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, padding: 12 },
  inviteBtn: { backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  inviteBtnText:{ fontSize: 14, fontWeight: '800', color: colors.white },

  // Modal
  modalRoot:     { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:    { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, maxHeight: '92%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:    { fontSize: 17, fontWeight: '800', color: colors.t1 },
  modalClose:    { fontSize: 20, fontWeight: '800', color: colors.t3, paddingHorizontal: 4 },
  stepTitle:     { fontSize: 13, fontWeight: '800', color: colors.navy, marginBottom: 10, marginTop: 4 },
  breadcrumbBack:{ paddingVertical: 6 },
  breadcrumbBackText:{ fontSize: 12, color: colors.navy, fontWeight: '700' },

  pickRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6, backgroundColor: colors.white },
  pickRowTitle:  { fontSize: 13, fontWeight: '700', color: colors.t1 },
  pickRowMeta:   { fontSize: 11, color: colors.t3, marginTop: 2, textTransform: 'capitalize' },
  chev:          { fontSize: 20, color: colors.t3 },

  emptyPanel:    { backgroundColor: colors.bg, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyPanelTitle:{ fontSize: 13, fontWeight: '800', color: colors.t1, marginBottom: 6 },
  emptyPanelBody:{ fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 16 },

  confirmCard:   { backgroundColor: colors.navyPale || '#EDF1FA', borderRadius: 12, padding: 12, marginBottom: 14 },
  confirmLabel:  { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  confirmValue:  { fontSize: 13, fontWeight: '700', color: colors.t1, marginTop: 2 },

  field:         { marginBottom: 12 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: colors.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldHint:     { fontSize: 10, color: colors.t3, marginTop: 4 },
  input:         { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.t1 },

  offerTypeChip: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  offerTypeChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  offerTypeChipText:   { fontSize: 11, fontWeight: '700', color: colors.t2 },
  offerTypeChipTextActive:{ color: colors.white },

  submitBtn:     { backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
