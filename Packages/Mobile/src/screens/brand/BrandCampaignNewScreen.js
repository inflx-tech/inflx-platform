/**
 * BrandCampaignNewScreen — C3: two fields, saves the campaign as a draft and goes straight to the
 * first set. Arrives with a group attached when started from G10.
 * Contract: features/item4-campaigns-sets · prompt §6.2
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { C4, MSG4 } from '../../components/campaigns/copy4';

const N = C4.newCampaign;

export default function BrandCampaignNewScreen({ navigation, route }) {
  const { groupId, groupName, groupCount } = route?.params || {};
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  async function next() {
    const e = {};
    if (!name.trim() || name.trim().length > N.nameMax) e.name = MSG4.CAMPAIGN_NAME;
    if (brief.length > N.descMax) e.brief = MSG4.CAMPAIGN_DESC_LONG;
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const r = await brandApi.createCampaign({ name: name.trim(), brief: brief.trim() || null, started_from_group_id: groupId || undefined });
    setSaving(false);
    if (!r.success) {
      if (r.error?.field) setErrors({ [r.error.field]: r.error.message });
      else show(r.error?.message || COPY.saveFailed);
      return;
    }
    const c = r.data.campaign;
    navigation.replace('BrandSetEdit', { campaignId: c.id, campaignName: c.name, dateRules: r.data.dateRules, suggestedName: C4.set.suggestedName('A'), first: true });
  }

  return (
    <View style={base.screen} testID="campaign-new">
      <Header title={N.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <TextField4 label={N.nameLabel} required value={name} onChangeText={(v) => { setName(v); setErrors(x => ({ ...x, name: undefined })); }} placeholder={N.namePlaceholder} max={N.nameMax} error={errors.name} autoFocus testID="campaign-name" />
        <TextField4 label={N.descLabel} value={brief} onChangeText={(v) => { setBrief(v); setErrors(x => ({ ...x, brief: undefined })); }} placeholder={N.descPlaceholder} max={N.descMax} hint={N.descHint} error={errors.brief} multiline testID="campaign-brief" />
        {groupId ? (
          <View style={s.info} testID="from-group">
            <Text style={s.infoText}>{N.fromGroup(groupName || 'your group', groupCount || 0)}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={s.bar}>
        <PrimaryButton label={N.next} onPress={next} busy={saving} testID="campaign-next" />
      </View>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  info: { borderRadius: 12, padding: 11, backgroundColor: T.state.waiting.bg, marginTop: 4 },
  infoText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg, lineHeight: 18 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
