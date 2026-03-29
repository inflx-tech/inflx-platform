import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

export default function ContractScreen({ navigation, route }) {
  const { campaignInfluencerId } = route.params || {};
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await influencerApi.getContract(campaignInfluencerId);
    setLoading(false);
    if (res.success) {
      setContract(res.data?.contract || res.data);
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to load contract');
    }
  }

  function handleScroll(event) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isAtBottom) setUnlocked(true);
  }

  async function sign() {
    if (!unlocked) {
      Alert.alert('Scroll to unlock', 'Please read the full contract before signing.');
      return;
    }
    Alert.alert(
      'Sign Contract',
      'By signing, you agree to all terms stated above.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Now',
          onPress: async () => {
            setSigning(true);
            const res = await influencerApi.signContract(contract.id, {
              influencer_name: contract.influencer_name,
            });
            setSigning(false);
            if (res.success) {
              Alert.alert('Signed!', 'Your contract is signed. Waiting for brand countersignature.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              Alert.alert('Failed', res.error?.message || 'Signing failed');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  if (!contract) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Contract not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const alreadySigned = !!contract.influencer_signed_at;

  return (
    <View style={styles.outer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contract</Text>
        <Text style={styles.sub}>{contract.campaign_name}</Text>
      </View>

      {/* Scroll-to-read notice */}
      {!unlocked && !alreadySigned && (
        <View style={styles.readBanner}>
          <Text style={styles.readBannerText}>📜 Scroll to the bottom to unlock signing</Text>
        </View>
      )}

      {/* Contract body */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <View style={styles.contractDoc}>
          <Text style={styles.contractTitle}>INFLUENCER MARKETING AGREEMENT</Text>
          <Text style={styles.contractSub}>This agreement is entered between:</Text>

          <ContractRow label="Brand" value={contract.brand_name} />
          <ContractRow label="Influencer" value={contract.influencer_name} />
          <ContractRow label="Campaign" value={contract.campaign_name} />
          <ContractRow label="Agreed Fee" value={fmtMoney(contract.influencer_fee)} />
          <ContractRow label="Posting Date" value={contract.posting_date ? new Date(contract.posting_date).toLocaleDateString('en-IN') : '—'} />
          <ContractRow label="Revision Limit" value={`${contract.revision_limit ?? 2} rounds`} />

          {contract.content_requirements ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Content Requirements</Text>
              <Text style={styles.sectionBody}>{contract.content_requirements}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Terms</Text>
            <Text style={styles.sectionBody}>
              Payments will be made in three tranches:{'\n'}
              • T1 (25%): Upon both parties signing this contract{'\n'}
              • T2 (25%): Upon brand confirming content is live{'\n'}
              • T3 (50%): 30 days after T2 trigger{'\n\n'}
              TDS of 10% will be deducted at the time of withdrawal as per Indian tax law.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Intellectual Property</Text>
            <Text style={styles.sectionBody}>
              The brand is granted a non-exclusive license to use the created content for marketing purposes for 12 months from the posting date. The influencer retains ownership of the content.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confidentiality</Text>
            <Text style={styles.sectionBody}>
              Both parties agree to keep the terms of this agreement confidential.
            </Text>
          </View>

          {/* Signatures */}
          <View style={styles.sigSection}>
            <View style={styles.sigBox}>
              <Text style={styles.sigLabel}>Influencer Signature</Text>
              {alreadySigned ? (
                <>
                  <Text style={styles.sigName}>{contract.influencer_name}</Text>
                  <Text style={styles.sigDate}>{new Date(contract.influencer_signed_at).toLocaleString('en-IN')}</Text>
                </>
              ) : (
                <Text style={styles.sigPending}>Not yet signed</Text>
              )}
            </View>
            <View style={styles.sigBox}>
              <Text style={styles.sigLabel}>Brand Signature</Text>
              {contract.brand_signed_at ? (
                <>
                  <Text style={styles.sigName}>{contract.brand_signed_by}</Text>
                  <Text style={styles.sigDate}>{new Date(contract.brand_signed_at).toLocaleString('en-IN')}</Text>
                </>
              ) : (
                <Text style={styles.sigPending}>Awaiting brand</Text>
              )}
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sign button */}
      {!alreadySigned ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.signBtn, (!unlocked || signing) && styles.signBtnLocked]}
            onPress={sign}
            disabled={signing}
          >
            {signing
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.signBtnText}>{unlocked ? 'Sign Contract' : 'Scroll to Unlock'}</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.footer}>
          <View style={styles.signedBadge}>
            <Text style={styles.signedText}>✓ You have signed this contract</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ContractRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: colors.t2, marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface2, borderRadius: 12 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  readBanner: { backgroundColor: colors.orange + '22', borderBottomWidth: 1, borderBottomColor: colors.orange + '44', paddingVertical: 10, paddingHorizontal: 16 },
  readBannerText: { fontSize: 12, color: colors.orange, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1 },
  contractDoc: { margin: 16, backgroundColor: colors.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  contractTitle: { fontSize: 16, fontWeight: '800', color: colors.t1, textAlign: 'center', marginBottom: 4 },
  contractSub: { fontSize: 12, color: colors.t3, textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  rowValue: { fontSize: 12, color: colors.t1, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.t1, textTransform: 'uppercase', marginBottom: 6 },
  sectionBody: { fontSize: 12, color: colors.t2, lineHeight: 18 },
  sigSection: { flexDirection: 'row', gap: 12, marginTop: 24 },
  sigBox: { flex: 1, backgroundColor: colors.surface2, borderRadius: 10, padding: 12 },
  sigLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 6 },
  sigName: { fontSize: 13, fontWeight: '800', color: colors.t1 },
  sigDate: { fontSize: 10, color: colors.t3, marginTop: 2 },
  sigPending: { fontSize: 12, color: colors.t3, fontStyle: 'italic' },
  footer: { padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  signBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  signBtnLocked: { backgroundColor: colors.t3 },
  signBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
  signedBadge: { backgroundColor: colors.teal + '22', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.teal },
  signedText: { fontSize: 14, fontWeight: '700', color: colors.teal },
});
