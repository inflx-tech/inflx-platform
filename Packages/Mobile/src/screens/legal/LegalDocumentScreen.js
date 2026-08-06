import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { getDocument } from '../../legal/content';

// One renderer for every legal document, mirroring the web DocPage so a
// document reads the same in the app as it does on inflx.in.
//
// The content arrives pre-resolved from scripts/sync-legal-to-mobile.mjs —
// company facts are already substituted, so nothing here knows about tokens.

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

// Exactly the three inline forms the documents use. Deliberately no HTML —
// see the note in the web RichText component.
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function Inline({ text, style, onNavigate }) {
  const parts = useMemo(() => String(text || '').split(INLINE).filter(Boolean), [text]);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={s.bold}>{part.slice(2, -2)}</Text>;
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          return (
            <Text key={i} style={s.link} onPress={() => onNavigate(href)}>
              {label}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

function Block({ block, onNavigate }) {
  if (block.p) {
    return <Inline text={block.p} style={s.p} onNavigate={onNavigate} />;
  }

  if (block.ul) {
    return (
      <View style={s.list}>
        {block.ul.map((item, i) => (
          <View key={i} style={s.li}>
            <Text style={s.bullet}>•</Text>
            <Inline text={item} style={s.liText} onNavigate={onNavigate} />
          </View>
        ))}
      </View>
    );
  }

  // Tables become stacked cards. A real table on a phone either scrolls
  // sideways or squeezes the text into a column two words wide, and a legal
  // document that is annoying to read does not get read.
  if (block.table) {
    const { head, rows } = block.table;
    return (
      <View style={s.tableWrap}>
        {rows.map((row, r) => (
          <View key={r} style={s.card}>
            {row.map((cell, c) => (
              <View key={c} style={c > 0 ? s.cardRowGap : null}>
                <Text style={s.cardLabel}>{head[c]}</Text>
                <Inline text={cell} style={s.cardValue} onNavigate={onNavigate} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (block.callout) {
    return (
      <View style={s.callout}>
        {!!block.callout.label && <Text style={s.calloutLabel}>{block.callout.label.toUpperCase()}</Text>}
        <Inline text={block.callout.p} style={s.calloutText} onNavigate={onNavigate} />
      </View>
    );
  }

  return null;
}

export default function LegalDocumentScreen({ route, navigation }) {
  const slug = route?.params?.slug;
  const audience = route?.params?.audience;
  const doc = getDocument(slug);

  // A link inside a document points at a web path. If the target ships in
  // this app, stay inside the app; otherwise open it on the website rather
  // than dead-ending the reader.
  const onNavigate = (href) => {
    const match = /^\/(?:legal\/)?([a-z0-9-]+)$/.exec(href || '');
    const target = match && getDocument(match[1]);
    if (target) {
      navigation.push('LegalDocument', { slug: target.slug, audience });
      return;
    }
    const url = href && href.startsWith('http') ? href : `https://inflx.in${href || '/legal'}`;
    Linking.openURL(url).catch(() => {});
  };

  if (!doc) {
    return (
      <View style={s.screen}>
        <Header title="Not found" onBack={() => navigation.goBack()} />
        <View style={s.missing}>
          <Text style={s.missingText}>
            This document is not available in the app. You can read it at inflx.in/legal.
          </Text>
          <TouchableOpacity
            style={s.missingBtn}
            onPress={() => Linking.openURL('https://inflx.in/legal').catch(() => {})}
          >
            <Text style={s.missingBtnText}>Open inflx.in/legal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header title={doc.title} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.applies}>{doc.appliesTo}</Text>

        {!!doc.inShort && (
          <View style={s.callout}>
            <Text style={s.calloutLabel}>IN SHORT</Text>
            <Inline text={doc.inShort} style={s.calloutText} onNavigate={onNavigate} />
          </View>
        )}

        {doc.sections.map((section, i) => (
          <View key={section.id} style={s.section}>
            <Text style={s.h2}>
              <Text style={s.h2num}>{i + 1}  </Text>
              {section.heading}
            </Text>
            {section.blocks.map((b, bi) => <Block key={bi} block={b} onNavigate={onNavigate} />)}
          </View>
        ))}

        <TouchableOpacity
          style={s.webLink}
          onPress={() => Linking.openURL(`https://inflx.in/legal/${doc.slug}`).catch(() => {})}
        >
          <Text style={s.webLinkText}>Read this on inflx.in</Text>
        </TouchableOpacity>

        <Text style={s.version}>Version {doc.version}</Text>
      </ScrollView>
    </View>
  );
}

function Header({ title, onBack }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={2}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },

  header: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  back: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '600', color: C.t2 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },

  body: { padding: 16, paddingBottom: 48 },
  applies: { fontSize: 12.5, color: C.t3, marginBottom: 14, lineHeight: 18 },

  section: { marginTop: 22 },
  h2: { fontSize: 16.5, fontWeight: '800', color: C.ink, marginBottom: 10 },
  h2num: { color: C.yellowDeep },

  p: { fontSize: 14.5, lineHeight: 23, color: C.t2, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.ink },
  link: { color: C.ink, fontWeight: '600', textDecorationLine: 'underline' },

  list: { marginBottom: 12 },
  li: { flexDirection: 'row', marginBottom: 8, paddingRight: 4 },
  bullet: { fontSize: 14.5, lineHeight: 23, color: C.yellowDeep, width: 16 },
  liText: { flex: 1, fontSize: 14.5, lineHeight: 23, color: C.t2 },

  tableWrap: { marginBottom: 12 },
  card: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12,
    padding: 14, marginBottom: 10, backgroundColor: C.paper,
  },
  cardRowGap: { marginTop: 10 },
  cardLabel: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7,
    color: C.t4, marginBottom: 3, textTransform: 'uppercase',
  },
  cardValue: { fontSize: 14, lineHeight: 21, color: C.t2 },

  callout: {
    backgroundColor: C.yellowPale, borderWidth: 1, borderColor: C.yellowEdge,
    borderLeftWidth: 3, borderLeftColor: C.yellow,
    borderRadius: 10, padding: 14, marginBottom: 14,
  },
  calloutLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.8,
    color: C.yellowDeep, marginBottom: 6,
  },
  calloutText: { fontSize: 13.5, lineHeight: 21, color: '#5C4600' },

  webLink: {
    marginTop: 28, borderWidth: 1, borderColor: C.line, borderRadius: 999,
    paddingVertical: 13, alignItems: 'center', backgroundColor: C.surface,
  },
  webLinkText: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  version: { marginTop: 14, fontSize: 11.5, color: C.t4, textAlign: 'center' },

  missing: { padding: 24, alignItems: 'center' },
  missingText: { fontSize: 14, lineHeight: 22, color: C.t2, textAlign: 'center', marginBottom: 18 },
  missingBtn: {
    backgroundColor: C.yellow, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12,
  },
  missingBtnText: { fontSize: 13.5, fontWeight: '700', color: C.ink },
});
