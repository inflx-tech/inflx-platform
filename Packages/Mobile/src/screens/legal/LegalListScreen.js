import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { docsForAudience } from '../../legal/content';

// The Legal section for one app.
//
// Each app passes its own `audience` when registering the route, so a shopper
// never sees the Creator Agreement and a creator never sees the refund policy
// they cannot act on. The full set stays one tap away on the website, so
// nothing is hidden — it is just not in the way.

const C = {
  ink: '#0A0A0A',
  t2: '#52525B',
  t3: '#71717A',
  t4: '#A1A1AA',
  line: '#E4E4E7',
  paper: '#FFFFFF',
  surface: '#FAFAFA',
  yellow: '#FFC107',
  yellowDeep: '#8A6A00',
  yellowPale: '#FFFBEB',
  yellowEdge: '#F5E3A8',
};

// The documents everyone gets, grouped first so the two most-needed things —
// how to complain, how to delete your account — are never buried under
// role-specific paperwork.
const COMMON = ['terms', 'privacy', 'community-guidelines', 'grievance', 'account-deletion', 'contact'];

export default function LegalListScreen({ route, navigation }) {
  const audience = route?.params?.audience || 'shopper';
  const docs = docsForAudience(audience);

  const common = docs.filter((d) => COMMON.indexOf(d.slug) !== -1);
  const specific = docs.filter((d) => COMMON.indexOf(d.slug) === -1);

  const open = (slug) => navigation.navigate('LegalDocument', { slug, audience });

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Legal</Text>
        <Text style={s.subtitle}>{docs.length} documents · plain English</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Group title="For everyone" docs={common} onOpen={open} />
        {specific.length > 0 && (
          <Group
            title={audience === 'creator' ? 'For creators' : audience === 'brand' ? 'For brands' : 'Buying on INFLX'}
            docs={specific}
            onOpen={open}
          />
        )}

        <View style={s.foot}>
          <Text style={s.footText}>
            These are the documents that apply to you. The full set — including the Cookie
            Policy — is always on our website.
          </Text>
          <TouchableOpacity
            style={s.footBtn}
            onPress={() => Linking.openURL('https://inflx.in/legal').catch(() => {})}
          >
            <Text style={s.footBtnText}>All legal documents</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.copyright}>© {new Date().getFullYear()} Omnara India Private Limited.{'\n'}All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

function Group({ title, docs, onOpen }) {
  if (!docs.length) return null;
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title.toUpperCase()}</Text>
      <View style={s.card}>
        {docs.map((d, i) => (
          <TouchableOpacity
            key={d.slug}
            style={[s.row, i < docs.length - 1 && s.rowBorder]}
            activeOpacity={0.6}
            onPress={() => onOpen(d.slug)}
          >
            <View style={s.rowText}>
              <Text style={s.rowTitle}>{d.title}</Text>
              <Text style={s.rowSub} numberOfLines={2}>{d.summary}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },

  header: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  back: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '600', color: C.t2 },
  title: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, color: C.t3, marginTop: 4 },

  body: { padding: 16, paddingBottom: 40 },

  group: { marginBottom: 22 },
  groupTitle: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9,
    color: C.t4, marginBottom: 8, marginLeft: 2,
  },
  card: {
    borderWidth: 1, borderColor: C.line, borderRadius: 14,
    backgroundColor: C.paper, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowText: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  rowSub: { fontSize: 12.5, lineHeight: 18, color: C.t3, marginTop: 3 },
  chev: { fontSize: 22, color: C.t4, fontWeight: '300' },

  foot: {
    backgroundColor: C.yellowPale, borderWidth: 1, borderColor: C.yellowEdge,
    borderRadius: 14, padding: 16, marginTop: 4,
  },
  footText: { fontSize: 13, lineHeight: 20, color: '#5C4600', marginBottom: 14 },
  footBtn: {
    backgroundColor: C.yellow, borderRadius: 999,
    paddingVertical: 12, alignItems: 'center',
  },
  footBtnText: { fontSize: 13.5, fontWeight: '700', color: C.ink },

  copyright: { marginTop: 22, fontSize: 11.5, lineHeight: 17, color: C.t4, textAlign: 'center' },
});
