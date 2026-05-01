import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

const GOAL_OPTIONS = [
  { v: 'engagement', label: 'Engagement (fee for content)' },
  { v: 'conversion', label: 'Conversion (commission per sale)' },
  { v: 'hybrid',     label: 'Hybrid (fee + commission)' },
];

const FORMAT_OPTIONS = [
  { v: 'reel',          label: 'Instagram Reel' },
  { v: 'post',          label: 'Instagram Post' },
  { v: 'story',         label: 'Instagram Story' },
  { v: 'youtube_video', label: 'YouTube Video' },
  { v: 'youtube_short', label: 'YouTube Short' },
];

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
      Alert.alert('Sent', 'Your proposal is in the brand\'s inbox. They\'ll be notified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Could not send', res.error?.message || 'Try again later.');
    }
  }

  const filters = criteria?.proposal_filters || {};

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Send Proposal</Text>
          <Text style={styles.headerSub}>{brandName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        {loadingCriteria ? (
          <ActivityIndicator color={colors.navy} />
        ) : criteria && (
          <View style={styles.criteriaCard}>
            <Text style={styles.criteriaTitle}>What this brand wants</Text>
            {filters.min_tier && <Text style={styles.criteriaItem}>· Minimum tier: {filters.min_tier}</Text>}
            {Array.isArray(filters.allowed_niches) && filters.allowed_niches.length > 0 && (
              <Text style={styles.criteriaItem}>· Niches: {filters.allowed_niches.join(', ')}</Text>
            )}
            {filters.city_match_required && <Text style={styles.criteriaItem}>· Same city required ({criteria.city})</Text>}
            {filters.min_engagement_rate != null && <Text style={styles.criteriaItem}>· Min engagement rate: {filters.min_engagement_rate}%</Text>}
            {filters.only_past_collabs && <Text style={styles.criteriaItem}>· Past collaboration required</Text>}
            {!filters.min_tier && !filters.allowed_niches?.length && !filters.city_match_required && filters.min_engagement_rate == null && !filters.only_past_collabs && (
              <Text style={styles.criteriaItem}>· No specific criteria — open to anyone</Text>
            )}
          </View>
        )}

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={pitchTitle} onChangeText={setPitchTitle}
          placeholder="e.g. Festival 3-Reel Series" placeholderTextColor={colors.t3} />

        <Text style={styles.label}>Pitch</Text>
        <TextInput style={[styles.input, { height: 110, textAlignVertical: 'top' }]} multiline
          value={pitchMessage} onChangeText={setPitchMessage}
          placeholder="Why you're the right fit, what you'll create, your audience…"
          placeholderTextColor={colors.t3} />

        <Text style={styles.label}>Goal</Text>
        <View style={styles.goalRow}>
          {GOAL_OPTIONS.map(g => (
            <TouchableOpacity key={g.v} style={[styles.goalChip, goal === g.v && styles.goalChipActive]} onPress={() => setGoal(g.v)}>
              <Text style={[styles.goalChipTxt, goal === g.v && styles.goalChipTxtActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {goal !== 'conversion' && (
          <>
            <Text style={styles.label}>Fee (₹)</Text>
            <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="numeric"
              placeholder="5000" placeholderTextColor={colors.t3} />
          </>
        )}
        {goal !== 'engagement' && (
          <>
            <Text style={styles.label}>Commission %</Text>
            <TextInput style={styles.input} value={commission} onChangeText={setCommission} keyboardType="numeric"
              placeholder="8" placeholderTextColor={colors.t3} />
          </>
        )}

        <Text style={styles.label}>Deliverables</Text>
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

        <Text style={styles.label}>Posting window (optional)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} value={windowStart} onChangeText={setWindowStart}
            placeholder="From YYYY-MM-DD" placeholderTextColor={colors.t3} />
          <TextInput style={[styles.input, { flex: 1 }]} value={windowEnd} onChangeText={setWindowEnd}
            placeholder="To YYYY-MM-DD" placeholderTextColor={colors.t3} />
        </View>

        <Text style={styles.label}>Portfolio samples (up to 3 URLs)</Text>
        <TextInput style={styles.input} value={link1} onChangeText={setLink1}
          autoCapitalize="none" autoCorrect={false}
          placeholder="https://instagram.com/p/…" placeholderTextColor={colors.t3} />
        <TextInput style={styles.input} value={link2} onChangeText={setLink2}
          autoCapitalize="none" autoCorrect={false}
          placeholder="https://" placeholderTextColor={colors.t3} />
        <TextInput style={styles.input} value={link3} onChangeText={setLink3}
          autoCapitalize="none" autoCorrect={false}
          placeholder="https://" placeholderTextColor={colors.t3} />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting}>
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitTxt}>Send proposal</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 28, color: colors.t1, fontWeight: '400' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: colors.t1 },
  headerSub:    { fontSize: 11, color: colors.t3, marginTop: 2 },

  criteriaCard: { padding: 12, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  criteriaTitle:{ fontSize: 11, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  criteriaItem: { fontSize: 11, color: colors.t1, lineHeight: 17 },

  label:        { fontSize: 11, fontWeight: '800', color: colors.t2, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: 6 },
  input:        { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.t1, marginBottom: 6 },

  goalRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  goalChip:     { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  goalChipActive:{ backgroundColor: colors.navy, borderColor: colors.navy },
  goalChipTxt:  { fontSize: 11, fontWeight: '700', color: colors.t2 },
  goalChipTxtActive:{ color: colors.white },

  deliverableRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  deliverableLabel:{ fontSize: 12, color: colors.t1 },
  counterRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterBtn:   { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderRadius: 14 },
  counterBtnTxt:{ fontSize: 16, fontWeight: '800', color: colors.t1 },
  counterValue: { fontSize: 14, fontWeight: '800', color: colors.t1, minWidth: 24, textAlign: 'center' },

  submitBtn:    { marginTop: spacing.lg, paddingVertical: 14, backgroundColor: colors.navy, borderRadius: 12, alignItems: 'center' },
  submitTxt:    { color: colors.white, fontSize: 14, fontWeight: '800' },
});
