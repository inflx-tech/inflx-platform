import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * BrandEnquiriesScreen — follower enquiries inbox + convert flow.
 * Flow 20 (2026-05-25): navy + 4 ad-hoc status pills → brandPalette + canonical map.
 */

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'submitted', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'converted', label: 'Converted' },
  { key: 'closed',    label: 'Closed' },
];

// Canonical status → palette map (Flow 20)
const STATUS_PILL = {
  submitted: { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },
  new:       { bg: P.yellowPale,  fg: P.yellowText,  label: 'NEW' },
  contacted: { bg: P.infoPale,    fg: P.info,        label: 'CONTACTED' },
  responded: { bg: P.infoPale,    fg: P.info,        label: 'RESPONDED' },
  converted: { bg: P.successPale, fg: P.successText, label: 'CONVERTED' },
  closed:    { bg: P.bg2,         fg: P.muted2,      label: 'CLOSED' },
};

export default function BrandEnquiriesScreen({ navigation }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('all');
  const [detail, setDetail] = useState(null);
  const [converting, setConverting] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');

  async function load(statusFilter = filter) {
    const params = statusFilter === 'all'
      ? null
      : { status: statusFilter === 'new' ? 'submitted' : statusFilter };
    const res = await brandApi.getEnquiries(params);
    setLoading(false);
    if (res?.success) setEnquiries(res.data?.enquiries || []);
  }

  useFocusEffect(useCallback(() => { load(filter); }, [filter]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }, [filter]);

  function openDetail(enq) {
    setDetail(enq);
    setConvertAmount('');
  }

  async function handleMarkContacted() {
    if (!detail) return;
    const res = await brandApi.updateEnquiry(detail.id, { status: 'contacted' });
    if (res?.success) {
      Alert.alert('Updated', 'Marked as contacted.');
      setEnquiries(prev => prev.map(e => e.id === detail.id ? { ...e, status: 'contacted' } : e));
      setDetail(null);
    } else {
      Alert.alert('Failed', res?.error?.message || 'Could not update.');
    }
  }

  async function handleMarkClosed() {
    if (!detail) return;
    Alert.alert('Close this enquiry?', 'You can still see it in the Closed tab afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        const res = await brandApi.updateEnquiry(detail.id, { status: 'closed' });
        if (res?.success) {
          setEnquiries(prev => prev.map(e => e.id === detail.id ? { ...e, status: 'closed' } : e));
          setDetail(null);
        } else {
          Alert.alert('Failed', res?.error?.message || 'Could not close.');
        }
      }},
    ]);
  }

  async function handleMarkConverted() {
    if (!detail) return;
    const rupees = parseFloat(convertAmount);
    if (!rupees || rupees <= 0) {
      Alert.alert('Deal value required', 'Enter the deal amount in rupees — this is used to credit the influencer their commission.');
      return;
    }
    setConverting(true);
    const res = await brandApi.updateEnquiry(detail.id, { status: 'converted', deal_value: rupees });
    setConverting(false);
    if (res?.success) {
      Alert.alert('Converted', 'Enquiry marked as converted. Influencer commission has been credited to their pending balance.');
      setEnquiries(prev => prev.map(e => e.id === detail.id ? { ...e, status: 'converted', deal_value: rupees } : e));
      setDetail(null);
    } else {
      Alert.alert('Failed', res?.error?.message || 'Could not convert.');
    }
  }

  function StatusPill({ status }) {
    const cfg = STATUS_PILL[status] || STATUS_PILL.closed;
    return (
      <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
        <Text style={[s.statusPillText, { color: cfg.fg }]}>{cfg.label}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <Header navigation={navigation} />
        <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <Header navigation={navigation} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow} contentContainerStyle={s.chipsRowContent}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.yellow} colors={[P.yellow]} />}
      >
        {enquiries.length === 0 ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}><Text style={s.emptyIconText}>[MAIL]</Text></View>
            <Text style={s.emptyText}>No enquiries in this view</Text>
            <Text style={s.emptySub}>When followers submit enquiry forms on an influencer's store page, they'll show up here.</Text>
          </View>
        ) : (
          enquiries.map(enq => (
            <TouchableOpacity
              key={enq.id}
              style={s.card}
              activeOpacity={0.8}
              onPress={() => openDetail(enq)}
            >
              <View style={s.cardHeader}>
                <Text style={s.cardName} numberOfLines={1}>{enq.follower_name || 'Unknown follower'}</Text>
                <StatusPill status={enq.status} />
              </View>
              {enq.follower_phone && <Text style={s.cardPhone}>{enq.follower_phone}</Text>}
              {enq.influencer_name && <Text style={s.cardMeta}>via @{enq.influencer_name}</Text>}
              <Text style={s.cardDate}>
                {enq.created_at ? new Date(enq.created_at).toLocaleString('en-IN') : ''}
              </Text>
              {enq.status === 'converted' && enq.deal_value > 0 && (
                <Text style={s.cardDeal}>Deal value: {fmtMoney(enq.deal_value)}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <KeyboardAvoidingView style={s.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalBackdrop} />
          <View style={s.modalSheet}>
            <ScrollView>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Enquiry Details</Text>
                <TouchableOpacity onPress={() => setDetail(null)}>
                  <Text style={s.modalClose}>×</Text>
                </TouchableOpacity>
              </View>

              {detail && (
                <>
                  <InfoRow label="Follower" value={detail.follower_name || '—'} />
                  {detail.follower_phone && <InfoRow label="Phone" value={detail.follower_phone} mono />}
                  {detail.influencer_name && <InfoRow label="Referred by" value={`@${detail.influencer_name}`} />}
                  <InfoRow label="Status" value={(detail.status === 'submitted' ? 'new' : detail.status)} />
                  <InfoRow label="Received" value={detail.created_at ? new Date(detail.created_at).toLocaleString('en-IN') : '—'} mono />
                  {detail.deal_value > 0 && <InfoRow label="Deal value" value={fmtMoney(detail.deal_value)} mono />}

                  <Text style={s.formDataTitle}>What they asked</Text>
                  {detail.form_data_json && Object.keys(detail.form_data_json).length > 0 ? (
                    Object.entries(detail.form_data_json).map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/_/g, ' ')} value={formatValue(v)} />
                    ))
                  ) : (
                    <Text style={s.noFormData}>No structured form data — contact the follower directly.</Text>
                  )}

                  {detail.status !== 'converted' && detail.status !== 'closed' && (
                    <>
                      <View style={s.modalDivider} />
                      {detail.status !== 'contacted' && (
                        <TouchableOpacity style={s.actionSecondary} onPress={handleMarkContacted}>
                          <Text style={s.actionSecondaryText}>Mark as Contacted</Text>
                        </TouchableOpacity>
                      )}

                      <View style={s.convertBox}>
                        <Text style={s.convertLabel}>Deal value (rupees)</Text>
                        <TextInput
                          style={s.convertInput}
                          value={convertAmount}
                          onChangeText={setConvertAmount}
                          placeholder="e.g. 25000"
                          placeholderTextColor={P.muted3}
                          keyboardType="decimal-pad"
                        />
                        <Text style={s.convertHint}>
                          Influencer commission credited to their pending balance on convert.
                        </Text>
                        <TouchableOpacity
                          style={[s.actionPrimary, converting && { opacity: 0.6 }]}
                          onPress={handleMarkConverted}
                          disabled={converting}
                        >
                          {converting
                            ? <ActivityIndicator color={P.white} />
                            : <Text style={s.actionPrimaryText}>Mark as Converted</Text>}
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity style={s.actionDanger} onPress={handleMarkClosed}>
                        <Text style={s.actionDangerText}>Close without converting</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Header({ navigation }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
        <Text style={s.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>Enquiries</Text>
      <View style={s.rule} />
      <Text style={s.subtitle}>Followers who asked about your business via your influencers</Text>
    </View>
  );
}

function formatValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function InfoRow({ label, value, mono }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && { fontFamily: fonts.monoMedium }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14 },
  back: { paddingBottom: 6 },
  backText: { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  title: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.white, letterSpacing: -0.3 },
  rule: { width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2, marginTop: 6 },
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  chipsRow: { backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border, maxHeight: 48 },
  chipsRowContent: { paddingHorizontal: 14, gap: 6, alignItems: 'center', paddingVertical: 8 },
  chip: { backgroundColor: P.bg2, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: P.border },
  chipActive: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.muted },
  chipTextActive: { color: P.yellow, fontFamily: fonts.monoBold },

  emptyCard: { backgroundColor: P.white, borderWidth: 1.5, borderColor: P.yellowPale, borderStyle: 'dashed', borderRadius: 18, paddingVertical: 36, paddingHorizontal: 22, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 13, backgroundColor: P.yellowPale, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.yellowText, letterSpacing: 0.4 },
  emptyText: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '700', color: P.ink },
  emptySub: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, maxWidth: 260 },

  card: { backgroundColor: P.white, borderRadius: 14, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: P.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, gap: 8 },
  cardName: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '700', color: P.ink, flex: 1 },
  cardPhone: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.ink, fontWeight: '600', marginBottom: 2 },
  cardMeta: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginBottom: 2 },
  cardDate: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted3, marginTop: 4 },
  cardDeal: { fontFamily: fonts.monoBold, fontSize: 12, color: P.successText, fontWeight: '700', marginTop: 6 },

  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  statusPillText: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 17, fontWeight: '800', color: P.ink },
  modalClose: { fontFamily: fonts.monoBold, fontSize: 22, color: P.muted2, paddingHorizontal: 4, lineHeight: 22 },
  modalDivider: { height: 1, backgroundColor: P.border, marginVertical: 14 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.borderSoft, gap: 14 },
  infoLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '700', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3, flex: 0.9 },
  infoValue: { fontFamily: fonts.sansBold, fontSize: 12, color: P.ink, fontWeight: '600', flex: 1.3, textAlign: 'right' },

  formDataTitle: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  noFormData: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, fontStyle: 'italic' },

  convertBox: { backgroundColor: P.successPale, borderRadius: 12, padding: 12, marginVertical: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  convertLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.successText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  convertInput: { fontFamily: fonts.monoMedium, backgroundColor: P.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, borderWidth: 1, borderColor: '#A7F3D0' },
  convertHint: { fontFamily: fonts.sansMedium, fontSize: 10, color: P.successText, marginTop: 6, lineHeight: 14 },

  actionPrimary: { backgroundColor: P.success, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  actionPrimaryText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: '800', color: P.white },
  actionSecondary: { backgroundColor: P.bg2, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: P.border, marginBottom: 8 },
  actionSecondaryText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: '700', color: P.ink },
  actionDanger: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  actionDangerText: { fontFamily: fonts.sansBold, fontSize: 12, fontWeight: '700', color: P.dangerText },
});
