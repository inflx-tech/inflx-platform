import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet, Switch, Alert,
} from 'react-native';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/* Proposal filters editor (features/brand-mobile-proposal-filters).
   Mobile twin of the brand-web proposal settings panel — same payload shape:
   { min_tier, allowed_niches[], city_match_required, min_engagement_rate,
     only_past_collabs }. Closes the last "adjust filters on the web dashboard"
   bounce. */

const TIERS  = ['nano', 'micro', 'mid', 'macro', 'mega'];
const NICHES = ['fashion', 'beauty', 'lifestyle', 'fitness', 'travel', 'tech', 'food'];

export default function ProposalFiltersSheet({ visible, settings, onClose, onSaved }) {
  const f = settings?.proposal_filters || {};
  const [minTier, setMinTier]       = useState(f.min_tier || '');
  const [niches, setNiches]         = useState(new Set(f.allowed_niches || []));
  const [cityMatch, setCityMatch]   = useState(!!f.city_match_required);
  const [minER, setMinER]           = useState(f.min_engagement_rate == null ? '' : String(f.min_engagement_rate));
  const [pastOnly, setPastOnly]     = useState(!!f.only_past_collabs);
  const [saving, setSaving]         = useState(false);

  function toggleNiche(n) {
    setNiches(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  async function save() {
    if (minER !== '' && (Number.isNaN(Number(minER)) || Number(minER) < 0 || Number(minER) > 100)) {
      Alert.alert('Check engagement rate', 'Enter a percentage between 0 and 100, or leave it blank.');
      return;
    }
    setSaving(true);
    const res = await brandApi.updateProposalSettings({
      accepts_proposals: settings?.accepts_proposals !== false,
      proposal_filters: {
        min_tier: minTier || null,
        allowed_niches: Array.from(niches),
        city_match_required: cityMatch,
        min_engagement_rate: minER === '' ? null : Number(minER),
        only_past_collabs: pastOnly,
      },
    });
    setSaving(false);
    if (res?.success) onSaved();
    else Alert.alert('Could not save', res?.error?.message || 'Please try again.');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={s.sheet}>
          <Text style={s.title}>Proposal filters</Text>
          <Text style={s.meta}>Who can pitch you. Creators see these before sending.</Text>

          <ScrollView style={{ maxHeight: 380 }}>
            <Text style={s.label}>Minimum tier</Text>
            <View style={s.row}>
              <TouchableOpacity style={[s.chip, !minTier && s.chipOn]} onPress={() => setMinTier('')}>
                <Text style={[s.chipTxt, !minTier && s.chipTxtOn]}>Any</Text>
              </TouchableOpacity>
              {TIERS.map(t => (
                <TouchableOpacity key={t} style={[s.chip, minTier === t && s.chipOn]} onPress={() => setMinTier(t)}>
                  <Text style={[s.chipTxt, minTier === t && s.chipTxtOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Allowed niches {niches.size > 0 ? `(${niches.size})` : '— any'}</Text>
            <View style={s.row}>
              {NICHES.map(n => (
                <TouchableOpacity key={n} style={[s.chip, niches.has(n) && s.chipOn]} onPress={() => toggleNiche(n)}>
                  <Text style={[s.chipTxt, niches.has(n) && s.chipTxtOn]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Minimum engagement rate (%)</Text>
            <TextInput
              style={s.input}
              value={minER}
              onChangeText={t => setMinER(t.replace(/[^\d.]/g, ''))}
              keyboardType="numeric"
              placeholder="Any"
              placeholderTextColor={ig.mut2}
            />

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.swTitle}>Same city only</Text>
                <Text style={s.swSub}>Only creators in your city can pitch</Text>
              </View>
              <Switch value={cityMatch} onValueChange={setCityMatch} trackColor={{ true: ig.green }} />
            </View>

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.swTitle}>Past collaborators only</Text>
                <Text style={s.swSub}>Only creators who worked with brands before</Text>
              </View>
              <Switch value={pastOnly} onValueChange={setPastOnly} trackColor={{ true: ig.green }} />
            </View>
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.ghost]} onPress={onClose}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.fill, saving && { opacity: 0.5 }]} disabled={saving} onPress={save}>
              <Text style={s.fillTxt}>{saving ? 'Saving…' : 'Save filters'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ig.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 26 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  meta: { fontSize: 11.5, color: ig.mut, marginTop: 2, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: ig.mut, marginTop: 14, marginBottom: 7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: ig.text, borderColor: ig.text },
  chipTxt: { fontSize: 12, fontWeight: '700', color: ig.text2, textTransform: 'capitalize' },
  chipTxtOn: { color: '#fff' },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 10, padding: 11, fontSize: 13, color: ig.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  swTitle: { fontSize: 13.5, fontWeight: '700', color: ig.text },
  swSub: { fontSize: 11.5, color: ig.mut, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  ghost: { borderWidth: 1, borderColor: ig.line },
  ghostTxt: { fontSize: 13, fontWeight: '700', color: ig.text },
  fill: { backgroundColor: ig.text },
  fillTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
