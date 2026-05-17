import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, fonts } from '../../theme/tokens';
import FilterChip from './FilterChip';

/**
 * FilterSheet — bottom-sheet modal for restaurant browse filters.
 *
 * Schema source: restaurant.json buyer_config.filters[]. Wave 4B
 * hard-codes the section list since the discovery endpoint doesn't ship
 * a config-by-category yet; when /v1/listing-config/buyer-config is
 * added (Wave 5), this list lifts from there with zero shape changes.
 *
 * Props:
 *   open         — bool, mount control
 *   onClose      — () => void, called on backdrop tap or Cancel
 *   filters      — current filter state from parent screen
 *   onApply      — (nextFilters) => void, called on "Show N results"
 *   resultCount  — int, shown on the action button
 */

const VIBES = [
  { key: 'family',     label: '👨‍👩‍👧 Family' },
  { key: 'quickbite',  label: '⚡ Quick bite' },
  { key: 'date_night', label: '🍷 Date night' },
  { key: 'rooftop',    label: '🌃 Rooftop' },
  { key: 'birthday',   label: '🎂 Birthday' },
  { key: 'late_night', label: '🌃 Late night' },
  { key: 'buffet',     label: '🍽 Buffet' },
  { key: 'cafe',       label: '☕ Cafe' },
];

const CUISINES = [
  'Biryani', 'Mughlai', 'North Indian', 'South Indian', 'Chinese',
  'Italian', 'Cafe', 'Continental', 'Mexican', 'Thai',
  'Bengali', 'Punjabi', 'Andhra', 'Hyderabadi', 'Desserts',
];

const COST_BUCKETS = [
  { key: 'under_300', label: 'Under ₹300' },
  { key: '300_800',   label: '₹300–₹800'  },
  { key: '800_plus',  label: '₹800+'      },
];

const MORE = [
  { key: 'open_now',        label: '⏱ Open now' },
  { key: 'has_offers',      label: '🏷 Has offers' },
  { key: 'creator_trusted', label: '⭐ Creator trusted (3+)' },
];

export default function FilterSheet({ open, onClose, filters, onApply, resultCount }) {
  // Local mutable copy. Apply pushes back to parent; cancel discards.
  const [local, setLocal] = useState(filters);

  // Sync from parent when sheet opens (in case parent state changed).
  useEffect(() => { if (open) setLocal(filters); }, [open, filters]);

  function toggleArr(key, value) {
    setLocal(f => {
      const arr = f[key] || [];
      const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
      return { ...f, [key]: next };
    });
  }

  function toggleBool(key) {
    setLocal(f => ({ ...f, [key]: !f[key] }));
  }

  function setCostBucket(key) {
    setLocal(f => ({ ...f, cost_bucket: f.cost_bucket === key ? null : key }));
  }

  function clearAll() {
    setLocal({
      veg_only:   false,
      open_now:   false,
      has_offers: false,
      vibes:      [],
      cuisines:   [],
      cost_bucket: null,
      creator_trusted: false,
    });
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.backdrop} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
        <View style={styles.grip} />
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.clearLink}>Clear all</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

          <Section title="Diet">
            <FilterChip label="🟢 Veg only"        selected={local.veg_only}        onPress={() => toggleBool('veg_only')} />
            <FilterChip label="🌱 Jain available"  selected={false}                  onPress={() => {}} />
          </Section>

          <Section title="Vibes">
            {VIBES.map(v => (
              <FilterChip key={v.key} label={v.label}
                selected={local.vibes.includes(v.key)}
                onPress={() => toggleArr('vibes', v.key)}
              />
            ))}
          </Section>

          <Section title="Cuisines">
            {CUISINES.map(c => (
              <FilterChip key={c} label={c}
                selected={local.cuisines.includes(c)}
                onPress={() => toggleArr('cuisines', c)}
              />
            ))}
          </Section>

          <Section title="Cost for two">
            {COST_BUCKETS.map(b => (
              <FilterChip key={b.key} label={b.label}
                selected={local.cost_bucket === b.key}
                onPress={() => setCostBucket(b.key)}
              />
            ))}
          </Section>

          <Section title="More">
            {MORE.map(m => (
              <FilterChip key={m.key} label={m.label}
                selected={local[m.key]}
                onPress={() => toggleBool(m.key)}
              />
            ))}
          </Section>

          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={() => onApply(local)} style={styles.applyBtn}>
            <Text style={styles.applyBtnText}>
              Show {resultCount != null ? resultCount : ''} results →
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.4)' },
  sheetWrap: {
    backgroundColor: lightColors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  grip: {
    width: 36, height: 4,
    backgroundColor: lightColors.border2,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: lightColors.ink,
    letterSpacing: -0.2,
  },
  clearLink: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: lightColors.yellowDeep,
  },

  body: { paddingHorizontal: 20 },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: lightColors.muted,
    marginBottom: 8,
    letterSpacing: 0.7,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  footer: {
    padding: 16,
    borderTopColor: lightColors.border,
    borderTopWidth: 1,
  },
  applyBtn: {
    backgroundColor: lightColors.yellow,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: lightColors.ink,
  },
});
