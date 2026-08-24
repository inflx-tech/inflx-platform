import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandCategoryPickerScreen — choose a category from the listing tree.
 * Contract: features/collab-terms-by-aim (item 9)
 *
 * The founder: "if we select category, as a promotion material then, it should appear from
 * our listing engine tree."
 *
 * WHAT TYPING COST:
 * The category was a free-text box. "Ethnic Wear", "ethnic wear" and "Ethnicwear" were
 * three different things to the platform, none of them linked to anything the listing
 * engine knows about — so an agreement naming a category could never be connected to the
 * products inside it.
 *
 * Picking a node stores its id as well as its name, which is what makes the deferred piece
 * possible later: constraining her post to the products inside the agreed category.
 *
 * The list is FLAT with a readable path — "Women › Ethnic Wear › Saree" — rather than an
 * expanding tree. There are 195 leaves in fashion; searching a flat list beats opening
 * three levels on a phone, and the path says where each one sits.
 */

export default function BrandCategoryPickerScreen({ route, navigation }) {
  const { selectedId, onDone } = route.params || {};
  const [nodes, setNodes] = useState([]);
  const [vertical, setVertical] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    brandApi.getListingTree().then(res => {
      setLoading(false);
      if (res.success) {
        setNodes(res.data?.nodes || []);
        setVertical(res.data?.vertical || null);
      }
    });
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Leaves are what a collaboration should name — "Women" is not a category anyone
    // promotes. Branches stay searchable so typing "ethnic" still finds its children.
    const leaves = nodes.filter(n => n.is_leaf);
    if (!needle) return leaves;
    return leaves.filter(n => String(n.path || n.name).toLowerCase().includes(needle));
  }, [nodes, q]);

  function pick(node) {
    // The NAME travels with the id, exactly as the product picker does: an agreement should
    // still read properly if the tree is reorganised later.
    if (typeof onDone === 'function') onDone(node.id, node.path || node.name);
    navigation.goBack();
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.close} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>Pick a category</Text>
          <Text style={s.navSub}>
            {loading ? 'Loading…' : `${shown.length} to choose from`}
          </Text>
        </View>
      </View>

      <View style={s.searchWrap}>
        <Icon name="magnify" size={16} color={ig.mut2} />
        <TextInput
          style={s.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search — try sarees, shirts, kurta"
          placeholderTextColor={ig.mut2}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={ig.mut2} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(n) => String(n.id)}
          renderItem={({ item }) => {
            const on = item.id === selectedId;
            // "Women › Ethnic Wear › Saree" reads better split: the trail in grey above,
            // the thing itself in black.
            const parts = String(item.path || item.name).split(' › ');
            const leaf = parts.pop();
            return (
              <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => pick(item)}>
                <View style={{ flex: 1 }}>
                  {parts.length > 0 && <Text style={s.trail}>{parts.join(' › ')}</Text>}
                  <Text style={[s.leaf, on && s.leafOn]}>{leaf}</Text>
                </View>
                {on && <Icon name="check" size={17} color={ig.green} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="file-tree-outline" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>
                {vertical === null ? 'No category list for your kind of business'
                  : q ? 'Nothing matches that' : 'No categories found'}
              </Text>
              <Text style={s.emptyS}>
                {vertical === null
                  ? 'Category lists exist for fashion and furniture today. You can still offer your whole store, or name specific products.'
                  : q ? 'Try a shorter search.' : 'This is unexpected — tell us and we will look.'}
              </Text>
            </View>
          }
          contentContainerStyle={shown.length === 0 ? { flexGrow: 1 } : { paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  close: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 11, color: ig.mut, marginTop: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 11,
    borderWidth: 1, borderColor: ig.line, borderRadius: 9,
  },
  search: { flex: 1, fontSize: 13, color: ig.text, paddingVertical: 9 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: ig.lineSoft,
  },
  trail: { fontSize: 10.5, color: ig.mut2, marginBottom: 2 },
  leaf: { fontSize: 13.5, fontWeight: '700', color: ig.text },
  leafOn: { color: ig.green },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 7 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4, textAlign: 'center' },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },
});
