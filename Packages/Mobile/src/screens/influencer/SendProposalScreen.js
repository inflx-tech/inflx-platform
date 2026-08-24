import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
// Dates are chosen, not typed. Contract: features/collab-terms-by-aim (item 2)
import DateField from '../../components/DateField';

const GOAL_OPTIONS = [
  { v: 'engagement', label: 'ENGAGEMENT (FEE)' },
  { v: 'conversion', label: 'CONVERSION (COMM)' },
  { v: 'hybrid',     label: 'HYBRID' },
];

const FORMAT_OPTIONS = [
  { v: 'reel',          label: 'Instagram Reel' },
  { v: 'post',          label: 'Instagram Post' },
  { v: 'story',         label: 'Instagram Story' },
  { v: 'youtube_video', label: 'YouTube Video' },
  { v: 'youtube_short', label: 'YouTube Short' },
];

/**
 * SendProposalScreen — form to send an outbound pitch.
 *
 * Flow 36 restyle (2026-05-27): brandPalette + Outfit/PJS/Mono fonts.
 * neutral criteria card with Outfit-Black title.
 * Ink-bordered inputs + ink-active goal chips + bg2 deliverable counter btns.
 * Ink/white Outfit-Black UPPERCASE SEND PROPOSAL CTA.
 * KeyboardAvoidingView + form validation preserved verbatim.
 */

export default function SendProposalScreen({ route, navigation }) {
  const { brandId, brandName } = route.params || {};

  const [criteria, setCriteria] = useState(null);
  const [loadingCriteria, setLoadingCriteria] = useState(true);

  const [pitchTitle, setPitchTitle]     = useState('');
  const [pitchMessage, setPitchMessage] = useState('');
  const [goal, setGoal]                 = useState('engagement');
  const [fee, setFee]                   = useState('');
  const [commission, setCommission]     = useState('');
  const [deliverables, setDeliverables] = useState({}); // { reel: 1, post: 0, ... }
  const [windowStart, setWindowStart]   = useState('');
  const [windowEnd, setWindowEnd]       = useState('');
  const [link1, setLink1] = useState('');
  const [link2, setLink2] = useState('');
  const [link3, setLink3] = useState('');
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    influencerApi.getBrandProposalCriteria(brandId).then(res => {
      setLoadingCriteria(false);
      if (res.success) setCriteria(res.data?.brand);
    });
  }, [brandId]);

  function adjustDeliverable(type, delta) {
    setDeliverables(prev => {
      const cur = prev[type] || 0;
      const next = Math.max(0, cur + delta);
      const updated = { ...prev };
      if (next === 0) delete updated[type];
      else updated[type] = next;
      return updated;
    });
  }

  async function submit() {
    if (!pitchTitle.trim() || !pitchMessage.trim()) {
      Alert.alert('Missing', 'Title and message are required.');
      return;
    }
    if (Object.keys(deliverables).length === 0) {
      Alert.alert('Missing', 'Pick at least one deliverable.');
      return;
    }
    if (goal !== 'conversion' && !fee.trim()) {
      Alert.alert('Missing', 'Enter a fee, or switch goal to conversion.');
      return;
    }

    const portfolioLinks = [link1, link2, link3].map(s => s.trim()).filter(Boolean);

    setSubmitting(true);
    const res = await influencerApi.createProposal({
      brand_id: brandId,
      pitch_title: pitchTitle.trim(),
      pitch_message: pitchMessage.trim(),
      goal,
      proposed_fee: fee ? Number(fee) : null,
      proposed_commission_pct: commission ? Number(commission) : null,
      proposed_deliverables: Object.entries(deliverables).map(([type, count]) => ({ type, count })),
      proposed_posting_window_start: windowStart || null,
      proposed_posting_window_end:   windowEnd   || null,
      portfolio_links: portfolioLinks,
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Sent', "Your proposal is in the brand's inbox. They'll be notified.", [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Could not send', res.error?.message || 'Try again later.');
    }
  }

  const filters = criteria?.proposal_filters || {};
  const hasNoCriteria = !filters.min_tier && !filters.allowed_niches?.length && !filters.city_match_required && filters.min_engagement_rate == null && !filters.only_past_collabs;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={18} color={P.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Send Proposal</Text>
          <Text style={styles.headerSub}>{(brandName || '').toUpperCase()}</Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {loadingCriteria ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color={P.ink} />
          </View>
        ) : criteria && (
          <View style={styles.criteriaCard}>
            <Text style={styles.criteriaTitle}>WHAT THIS BRAND WANTS</Text>
            {filters.min_tier && <Text style={styles.criteriaItem}>· Minimum tier: <Text style={styles.criteriaItemBold}>{filters.min_tier}</Text></Text>}
            {Array.isArray(filters.allowed_niches) && filters.allowed_niches.length > 0 && (
              <Text style={styles.criteriaItem}>· Niches: {filters.allowed_niches.join(', ')}</Text>
            )}
            {filters.city_match_required && <Text style={styles.criteriaItem}>· Same city required ({criteria.city})</Text>}
            {filters.min_engagement_rate != null && <Text style={styles.criteriaItem}>· Min engagement rate: {filters.min_engagement_rate}%</Text>}
            {filters.only_past_collabs && <Text style={styles.criteriaItem}>· Past collaboration required</Text>}
            {hasNoCriteria && (
              <Text style={styles.criteriaItem}>· No specific criteria — open to anyone</Text>
            )}
          </View>
        )}

        <Text style={styles.label}>TITLE</Text>
        <TextInput style={styles.input} value={pitchTitle} onChangeText={setPitchTitle}
          placeholder="e.g. Festival 3-Reel Series" placeholderTextColor={P.muted3} />

        <Text style={styles.label}>PITCH</Text>
        <TextInput style={[styles.input, styles.inputArea]} multiline
          value={pitchMessage} onChangeText={setPitchMessage}
          placeholder="Why you're the right fit, what you'll create, your audience…"
          placeholderTextColor={P.muted3} />

        <Text style={styles.label}>GOAL</Text>
        <View style={styles.goalRow}>
          {GOAL_OPTIONS.map(g => (
            <TouchableOpacity key={g.v} style={[styles.goalChip, goal === g.v && styles.goalChipActive]} onPress={() => setGoal(g.v)}>
              <Text style={[styles.goalChipTxt, goal === g.v && styles.goalChipTxtActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {goal !== 'conversion' && (
          <>
            <Text style={styles.label}>FEE (₹)</Text>
            <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="numeric"
              placeholder="5000" placeholderTextColor={P.muted3} />
          </>
        )}
        {goal !== 'engagement' && (
          <>
            <Text style={styles.label}>COMMISSION %</Text>
            <TextInput style={styles.input} value={commission} onChangeText={setCommission} keyboardType="numeric"
              placeholder="8" placeholderTextColor={P.muted3} />
          </>
        )}

        <Text style={styles.label}>DELIVERABLES</Text>
        {FORMAT_OPTIONS.map(f => (
          <View key={f.v} style={styles.deliverableRow}>
            <Text style={styles.deliverableLabel}>{f.label}</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => adjustDeliverable(f.v, -1)}>
                <Text style={styles.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{deliverables[f.v] || 0}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => adjustDeliverable(f.v, +1)}>
                <Text style={styles.counterBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={styles.label}>POSTING WINDOW (OPTIONAL)</Text>
        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <DateField value={windowStart} onChange={setWindowStart} placeholder="From" style={{ marginBottom: 0 }} />
          </View>
          <View style={{ flex: 1 }}>
            {/* A window that ends before it begins is not a proposal anybody can accept,
                so the picker will not offer those days. */}
            <DateField value={windowEnd} onChange={setWindowEnd} placeholder="To"
              minDate={windowStart || undefined} style={{ marginBottom: 0 }} />
          </View>
        </View>

        <Text style={styles.label}>PORTFOLIO SAMPLES (UP TO 3 URLS)</Text>
        <TextInput style={styles.input} value={link1} onChangeText={setLink1}
          autoCapitalize="none" autoCorrect={false}
          placeholder="https://instagram.com/p/…" placeholderTextColor={P.muted3} />
        <TextInput style={styles.input} value={link2} onChangeText={setLink2}
          autoCapitalize="none" autoCorrect={false}
          placeholder="https://" placeholderTextColor={P.muted3} />
        <TextInput style={styles.input} value={link3} onChangeText={setLink3}
          autoCapitalize="none" autoCorrect={false}
          placeholder="https://" placeholderTextColor={P.muted3} />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting}>
          {submitting
            ? <ActivityIndicator color={P.white} />
            : <Text style={styles.submitTxt}>SEND PROPOSAL</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBlack },
  headerSub: { fontSize: 10, color: P.muted2, marginTop: 3, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Criteria card — neutral
  criteriaCard: {
    margin: 14, marginBottom: 14, padding: 12,
    backgroundColor: P.bg2, borderRadius: 11,
    borderWidth: 1, borderColor: P.border,
  },
  criteriaTitle: {
    fontSize: 11, fontWeight: '900', color: P.ink,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
    fontFamily: fonts.displayBlack,
  },
  criteriaItem: { fontSize: 11.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },
  criteriaItemBold: { fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },

  // Form
  label: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.3,
    marginTop: 14, marginBottom: 6,
    paddingHorizontal: 14,
    fontFamily: fonts.monoBold,
  },
  input: {
    backgroundColor: P.white, borderRadius: 10,
    borderWidth: 1.5, borderColor: P.ink,
    paddingHorizontal: 11, paddingVertical: 11,
    fontSize: 12.5, color: P.ink, marginHorizontal: 14, marginBottom: 6,
    fontFamily: fonts.sansRegular,
  },
  inputArea: { minHeight: 100, textAlignVertical: 'top' },

  // Goal chips — ink-active per pattern
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 14, marginBottom: 4 },
  goalChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: P.bg2,
    borderRadius: 999, borderWidth: 1, borderColor: P.border,
  },
  goalChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  goalChipTxt: { fontSize: 10, fontWeight: '800', color: P.muted, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.monoBold },
  goalChipTxtActive: { color: P.white, fontWeight: '900' },

  // Deliverable counter rows
  deliverableRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 6,
    backgroundColor: P.white, borderRadius: 10,
    borderWidth: 1, borderColor: P.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  deliverableLabel: { fontSize: 12.5, color: P.ink, fontWeight: '700', fontFamily: fonts.displayBold },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.bg2,
  },
  counterBtnTxt: { fontSize: 16, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  counterValue: { fontSize: 14, fontWeight: '900', color: P.ink, minWidth: 24, textAlign: 'center', fontFamily: fonts.monoBold },

  // Input row (posting window)
  inputRow: { flexDirection: 'row', gap: 8, marginHorizontal: 14, marginBottom: 6 },

  // Submit CTA
  submitBtn: {
    marginHorizontal: 14, marginTop: 18,
    paddingVertical: 14,
    backgroundColor: P.ink, borderRadius: 12, alignItems: 'center',
  },
  submitTxt: {
    color: P.white, fontSize: 14, fontWeight: '900',
    letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack,
  },
});
