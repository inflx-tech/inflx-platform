import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import DateField from '../../components/DateField';

/**
 * BrandCampaignCreateScreen — the shell. Two fields, then the sets do the work.
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 * Board: 04-preview/mockups/stage2-screens.html panel ③ · action ledger #60
 *
 * WHY IT ASKS SO LITTLE
 * Everything that used to sit at campaign level — budget, end date, who posts — either
 * belongs to a set or was already settled at the handshake. What is left is a name and a
 * start date.
 *
 * The server has agreed with this since Part 5: POST /campaigns takes a name and a start
 * date and IGNORES any budget or end date sent to it, writing NULL for both and deriving
 * them from the sets. This is the first screen built to match that rule rather than to
 * work around it.
 *
 * The lock note is not decoration. A brand who has used the web wizard will look for the
 * budget field; telling them where it went teaches the model, and a silent absence just
 * looks broken.
 */
export default function BrandCampaignCreateScreen({ navigation }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const canGo = name.trim().length > 0 && isISODate(start);

  async function createIt() {
    if (!canGo || saving) return;
    setSaving(true);
    const res = await brandApi.createCampaign({ name: name.trim(), start_date: start });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Could not start the campaign', res?.error?.message || 'Please try again.');
      return;
    }
    const campaign = res.data?.campaign;
    // replace, not push: the shell is a one-time question. Coming "back" to it from the
    // sets list would offer to create a second campaign, which is never what was meant.
    navigation.replace('BrandCampaignBuilder', { campaignId: campaign.id, campaignName: campaign.name });
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>New campaign</Text>
          <Text style={s.sub}>STEP 1 · NAME IT</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.sec}>
          <Text style={s.label}>Campaign name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Festive Season 2026"
            placeholderTextColor={ig.mut2}
            autoFocus
          />
          <Text style={s.help}>Creators see this name on their invite.</Text>
        </View>

        <View style={s.sec}>
          {/* Batch A — was a text box expecting YYYY-MM-DD. On a phone that is four ways to
              fail: wrong format, wrong month, a date already past, or a typo nobody catches
              until a deadline is missed. DateField is pure JS on purpose — an over-the-air
              bundle cannot add a native module. The value in and out is the same string the
              text box produced, so nothing behind this screen changes.
              Contract: features/stage-2-walkthrough-fixes */}
          <DateField
            label="Starts"
            value={start}
            onChange={setStart}
            placeholder="Choose a start date"
          />
        </View>


        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, s.btnPri, !canGo && s.btnOff]}
            disabled={!canGo || saving}
            onPress={createIt}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={ig.bg} />
              : <Text style={s.btnPriT}>Add the first set</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isISODate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(new Date(v).getTime());
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },
  sec: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: ig.text },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 7, lineHeight: 15 },
  err: { fontSize: 10.5, color: ig.red, fontWeight: '700', marginTop: 6 },
  lock: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: ig.bgSoft, borderWidth: 1, borderStyle: 'dashed', borderColor: ig.line, borderRadius: 11, padding: 12 },
  lockT: { flex: 1, fontSize: 11, color: ig.mut, fontWeight: '700', lineHeight: 16 },
  lockB: { color: ig.text, fontWeight: '800' },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnOff: { backgroundColor: ig.lineSoft },
});
