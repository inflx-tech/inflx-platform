import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import CreatorAvatar from '../../components/CreatorAvatar';
import { fromMode, describeMode } from '../../utils/workingStyle';
import { settledLine, expiryLine, daysLeft, AIM_LABEL } from '../../utils/agreementSummary';

/**
 * BrandAgreementDetailScreen — re-read what was settled, and open its diary.
 * Contract: features/stage-2-build-a-campaign-from-the-phone · action ledger #75
 *
 * Tapping a row in the wizard's pick-list opens this. It is a READ-ONLY page: an agreement
 * is finished, and the place to change a term is step 4, where the brand is warned that
 * the creator will be told which one moved.
 *
 * "See how you got here" opens the shared history page — the same one the creator sees,
 * word for word. One page, both sides, is what stops the two apps telling different
 * stories about the same negotiation.
 */
export default function BrandAgreementDetailScreen({ route, navigation }) {
  const { agreement } = route.params || {};
  const a = agreement || {};
  const t = a.terms_json || {};
  const { place, shipping } = fromMode(t.mode);
  const d = daysLeft(a.expires_at);
  const soon = d != null && d <= 14;

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <CreatorAvatar name={a.influencer_name || a.instagram_handle} avatarUrl={a.profile_image_url} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{a.influencer_name || a.instagram_handle || 'Creator'}</Text>
          <Text style={s.sub}>AGREEMENT{a.created_at ? ` · ${fmtShort(a.created_at)}` : ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.sec2}>
          <Text style={s.dh}>What you both settled</Text>
          <KV k="Aim" v={AIM_LABEL[t.aim] || '—'} />
          {t.money?.commission_pct != null && <KV k="Commission" v={`${t.money.commission_pct}%`} />}
          {t.money?.fee != null && <KV k="Fee" v={`₹${Number(t.money.fee).toLocaleString('en-IN')}`} />}
          <KV k="Post by" v={t.time?.post_by ? fmtShort(t.time.post_by) : (t.time?.window_end ? fmtShort(t.time.window_end) : '—')} />
          <KV k="Where she shoots" v={place === 'visit' ? 'Store visit' : place === 'remote' ? 'Her end' : '—'} />
          <KV k="You are shipping" v={shipping === 'yes' ? 'Yes' : shipping === 'no' ? 'No' : '—'} />
          {!!t.scope?.category && <KV k="She would promote" v={t.scope.category} />}
          {Array.isArray(t.deliverables) && t.deliverables.length > 0 && (
            <KV k="Deliverables" v={settledLine({ deliverables: t.deliverables })} />
          )}
        </View>

        <View style={s.sec2}>
          <Text style={s.dh}>The clock</Text>
          <KV k="Status" v={String(a.status || 'ready').toUpperCase()} />
          <KV k="Expires" v={expiryLine(a.expires_at)} danger={soon} />
          {soon && (
            <Text style={s.help}>
              An agreement not briefed into a campaign within its window lapses, and you would have
              to ask her again from the start.
            </Text>
          )}
        </View>

        {!!a.source_request_id || !!a.source_proposal_id ? (
          <View style={s.sec}>
            <TouchableOpacity
              style={[s.btn, s.btnSec]}
              activeOpacity={0.85}
              // The diary screen takes requestId OR proposalId — the same page the creator
              // reads, wired to the brand's calls. Passing the wrong key silently loads
              // nothing, so the shape is copied from CollabDiaryScreen, not remembered.
              onPress={() => navigation.navigate('BrandDiary', a.source_request_id
                ? { requestId: a.source_request_id }
                : { proposalId: a.source_proposal_id })}
            >
              <Text style={s.btnSecT}>See how you got here</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.sec}>
          <View style={s.noteB}>
            <Text style={s.noteBT}>
              Adding her to a set brings all of this across, pre-filled. Change any of it at step 4
              and <Text style={s.bold}>she is told which term moved, by name</Text>, when the invite arrives.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function KV({ k, v, danger }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, danger && { color: ig.red }]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const fmtShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  sec: { paddingHorizontal: 14, paddingVertical: 11 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  dh: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 9 },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 8, lineHeight: 15 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { fontSize: 11.5, color: ig.mut, fontWeight: '650' },
  rowV: { flex: 1, fontSize: 11.5, fontWeight: '800', color: ig.text, textAlign: 'right' },

  noteB: { backgroundColor: ig.blueBg, borderRadius: 11, padding: 12 },
  noteBT: { fontSize: 11.5, color: ig.blue, fontWeight: '700', lineHeight: 17 },
  bold: { fontWeight: '800' },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnSecT: { fontSize: 13, fontWeight: '800', color: ig.text },
});
