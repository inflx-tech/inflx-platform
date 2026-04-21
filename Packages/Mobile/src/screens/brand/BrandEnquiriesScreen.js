import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'submitted', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'converted', label: 'Converted' },
  { key: 'closed',    label: 'Closed' },
];

const STATUS_STYLES = {
  submitted: { bg: '#FFF7ED', fg: '#C2410C' },
  new:       { bg: '#FFF7ED', fg: '#C2410C' },
  contacted: { bg: '#EFF6FF', fg: '#1D4ED8' },
  responded: { bg: '#EFF6FF', fg: '#1D4ED8' },
  converted: { bg: '#ECFDF5', fg: '#047857' },
  closed:    { bg: '#F3F4F6', fg: '#4B5563' },
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
    const params = statusFilter === 'all' ? null : { status: statusFilter === 'new' ? 'submitted' : statusFilter };
    const res = await brandApi.getEnquiries(params);
    setLoading(false);
    if (res?.success) setEnquiries(res.data?.enquiries || []);
  }

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [filter])
  );

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
    // Backend stores deal_value in rupees.
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
    const s = STATUS_STYLES[status] || STATUS_STYLES.closed;
    return (
      <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
        <Text style={[styles.statusPillText, { color: s.fg }]}>
          {status === 'submitted' ? 'new' : status}
        </Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enquiries</Text>
        <Text style={styles.subtitle}>Followers who asked about your business via your influencers</Text>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        {enquiries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No enquiries in this view</Text>
            <Text style={styles.emptySub}>When followers submit enquiry forms on an influencer's store page, they'll show up here.</Text>
          </View>
        ) : (
          enquiries.map(enq => (
            <TouchableOpacity
              key={enq.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => openDetail(enq)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>{enq.follower_name || 'Unknown follower'}</Text>
                <StatusPill status={enq.status} />
              </View>
              {enq.follower_phone && (
                <Text style={styles.cardPhone}>{enq.follower_phone}</Text>
              )}
              {enq.influencer_name && (
                <Text style={styles.cardMeta}>via @{enq.influencer_name}</Text>
              )}
              <Text style={styles.cardDate}>
                {enq.created_at ? new Date(enq.created_at).toLocaleString('en-IN') : ''}
              </Text>
              {enq.status === 'converted' && enq.deal_value > 0 && (
                <Text style={styles.cardDeal}>Deal value: {fmtMoney(enq.deal_value)}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Detail modal */}
      <Modal
        visible={!!detail}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBackdrop} />
          <View style={styles.modalSheet}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enquiry Details</Text>
                <TouchableOpacity onPress={() => setDetail(null)}>
                  <Text style={styles.modalClose}>{'X'}</Text>
                </TouchableOpacity>
              </View>

              {detail && (
                <>
                  <InfoRow label="Follower" value={detail.follower_name || '—'} />
                  {detail.follower_phone && <InfoRow label="Phone" value={detail.follower_phone} copyable />}
                  {detail.influencer_name && <InfoRow label="Referred by" value={`@${detail.influencer_name}`} />}
                  <InfoRow label="Status" value={(detail.status === 'submitted' ? 'new' : detail.status)} />
                  <InfoRow label="Received" value={detail.created_at ? new Date(detail.created_at).toLocaleString('en-IN') : '—'} />
                  {detail.deal_value > 0 && <InfoRow label="Deal value" value={fmtMoney(detail.deal_value)} />}

                  {/* Form data */}
                  <Text style={styles.formDataTitle}>What they asked</Text>
                  {detail.form_data_json && Object.keys(detail.form_data_json).length > 0 ? (
                    Object.entries(detail.form_data_json).map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/_/g, ' ')} value={formatValue(v)} />
                    ))
                  ) : (
                    <Text style={styles.noFormData}>No structured form data — contact the follower directly.</Text>
                  )}

                  {/* Actions — only show relevant ones */}
                  {detail.status !== 'converted' && detail.status !== 'closed' && (
                    <>
                      <View style={styles.modalDivider} />
                      {detail.status !== 'contacted' && (
                        <TouchableOpacity style={styles.actionSecondary} onPress={handleMarkContacted}>
                          <Text style={styles.actionSecondaryText}>Mark as Contacted</Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.convertBox}>
                        <Text style={styles.convertLabel}>Deal value (rupees)</Text>
                        <TextInput
                          style={styles.convertInput}
                          value={convertAmount}
                          onChangeText={setConvertAmount}
                          placeholder="e.g. 25000"
                          placeholderTextColor={colors.t3}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.convertHint}>
                          Enter the final deal amount. Influencer commission is calculated from their negotiated % and credited to their pending balance.
                        </Text>
                        <TouchableOpacity
                          style={[styles.actionPrimary, converting && { opacity: 0.6 }]}
                          onPress={handleMarkConverted}
                          disabled={converting}
                        >
                          {converting
                            ? <ActivityIndicator color={colors.white} />
                            : <Text style={styles.actionPrimaryText}>Mark as Converted</Text>}
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity style={styles.actionDanger} onPress={handleMarkClosed}>
                        <Text style={styles.actionDangerText}>Close without converting</Text>
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

function formatValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:   { backgroundColor: colors.navyDeep, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  back:     { marginBottom: 8 },
  backText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  title:    { fontSize: 22, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  chipsRow: { backgroundColor: colors.white, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 48 },
  chip:     { backgroundColor: colors.bg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText:   { fontSize: 11, fontWeight: '700', color: colors.t2 },
  chipTextActive: { color: colors.white },

  emptyCard: { margin: 16, backgroundColor: colors.white, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptySub:  { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 16 },

  card:       { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardName:   { fontSize: 14, fontWeight: '700', color: colors.t1, flex: 1, marginRight: 8 },
  cardPhone:  { fontSize: 12, color: colors.navy, fontWeight: '600', marginBottom: 2 },
  cardMeta:   { fontSize: 11, color: colors.t2, marginBottom: 2 },
  cardDate:   { fontSize: 10, color: colors.t3, marginTop: 4 },
  cardDeal:   { fontSize: 12, color: '#047857', fontWeight: '700', marginTop: 6 },

  statusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  modalRoot:     { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:    { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, maxHeight: '90%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:    { fontSize: 17, fontWeight: '800', color: colors.t1 },
  modalClose:    { fontSize: 20, fontWeight: '800', color: colors.t3, paddingHorizontal: 4 },
  modalDivider:  { height: 1, backgroundColor: colors.border, marginVertical: 14 },

  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 14 },
  infoLabel:  { fontSize: 11, fontWeight: '700', color: colors.t3, textTransform: 'capitalize', flex: 0.9 },
  infoValue:  { fontSize: 12, color: colors.t1, fontWeight: '500', flex: 1.3, textAlign: 'right' },

  formDataTitle: { fontSize: 12, fontWeight: '800', color: colors.t2, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  noFormData:    { fontSize: 11, color: colors.t3, fontStyle: 'italic' },

  convertBox:    { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, marginVertical: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  convertLabel:  { fontSize: 11, fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  convertInput:  { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.t1, borderWidth: 1, borderColor: '#A7F3D0' },
  convertHint:   { fontSize: 10, color: '#047857', marginTop: 6, lineHeight: 14 },

  actionPrimary:   { backgroundColor: '#047857', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  actionPrimaryText:{ fontSize: 13, fontWeight: '800', color: colors.white },
  actionSecondary: { backgroundColor: colors.navyPale || colors.bg, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.navy, marginBottom: 8 },
  actionSecondaryText:{ fontSize: 13, fontWeight: '700', color: colors.navy },
  actionDanger:    { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  actionDangerText:{ fontSize: 12, fontWeight: '700', color: colors.red },
});
