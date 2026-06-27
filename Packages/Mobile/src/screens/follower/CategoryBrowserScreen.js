import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  Modal, StyleSheet,
} from 'react-native';
import { toing as TZ, fonts, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { goToProduct } from '../../components/SectionRenderer';

/**
 * CategoryBrowserScreen — the Type-1 result page (contract: listing-category-browser).
 * Tap a category → a left rail of sub-categories + a right product grid + facet
 * filter chips, all on the live category_nodes tree (fashion / furniture). The
 * rail = a node's children; selecting a leaf loads its subtree products; selecting
 * a branch drills in. Filters + sort re-query the backend; the chip values are the
 * facet values actually present in the live set (aggregated server-side).
 *
 * Route params: { nodeId, vertical?, title? }. nodeId may be a category (rail =
 * its leaves) or a leaf (rail = its siblings, that leaf pre-selected).
 */

const RAIL_TINTS = [
  ['#FBEAF0', '#D4537E'], ['#EEEDFE', '#7F77DD'], ['#E1F5EE', '#1D9E75'],
  ['#FAEEDA', '#BA7517'], ['#E6F1FB', '#378ADD'], ['#FAECE7', '#D85A30'],
  ['#EAF3DE', '#639922'], ['#F1EFE8', '#5F5E5A'],
];
const tint = (i) => RAIL_TINTS[i % RAIL_TINTS.length];

const SORTS = [
  { key: 'new', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'discount', label: 'Discount' },
];

export default function CategoryBrowserScreen({ navigation, route }) {
  const params = route.params || {};
  const [railNode, setRailNode] = useState(null);   // the parent whose children fill the rail
  const [rail, setRail] = useState([]);
  const [selected, setSelected] = useState(null);   // the leaf currently shown in the grid
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState([]);       // [{key,label,role,values:[{value,count}]}]
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);

  const [activeFilters, setActiveFilters] = useState({});  // { facet_key: [values] }
  const [sort, setSort] = useState('new');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [draftSort, setDraftSort] = useState('new');

  const loadGrid = useCallback(async (node, opts = {}) => {
    if (!node) { setProducts([]); setTotal(0); setFilters([]); return; }
    setGridLoading(true);
    try {
      const res = await followerApi.listingNodeProducts(node.id, {
        filters: opts.filters || {}, sort: opts.sort || 'new', page: 1, page_size: 40,
      });
      const d = res.data || res;
      setProducts(Array.isArray(d.items) ? d.items : []);
      setFilters(Array.isArray(d.filters) ? d.filters : []);
      setTotal(d.total || 0);
    } catch (e) {
      console.error('[CategoryBrowser] grid load error:', e.message);
      setProducts([]); setTotal(0); setFilters([]);
    } finally {
      setGridLoading(false);
    }
  }, []);

  // Initial load — resolve the rail + the first leaf to show.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await followerApi.listingNodeChildren(params.nodeId);
        const d = res.data || res;
        const node = d.node;
        if (node.is_leaf && node.parent_id) {
          const r2 = await followerApi.listingNodeChildren(node.parent_id);
          const d2 = r2.data || r2;
          if (cancelled) return;
          setRailNode(d2.node); setRail(d2.children || []);
          setSelected(node);
          await loadGrid(node, { sort: 'new', filters: {} });
        } else {
          if (cancelled) return;
          setRailNode(node); setRail(d.children || []);
          const firstLeaf = (d.children || []).find((k) => k.is_leaf) || null;
          setSelected(firstLeaf);
          if (firstLeaf) await loadGrid(firstLeaf, { sort: 'new', filters: {} });
        }
      } catch (e) {
        console.error('[CategoryBrowser] init error:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.nodeId, loadGrid]);

  const onSelectRail = useCallback(async (child) => {
    if (child.is_leaf) {
      setSelected(child); setActiveFilters({}); setSort('new');
      loadGrid(child, { sort: 'new', filters: {} });
    } else {
      // drill into a branch — its children become the rail.
      try {
        const r = await followerApi.listingNodeChildren(child.id);
        const d = r.data || r;
        setRailNode(d.node); setRail(d.children || []);
        const firstLeaf = (d.children || []).find((k) => k.is_leaf) || null;
        setSelected(firstLeaf); setActiveFilters({}); setSort('new');
        loadGrid(firstLeaf, { sort: 'new', filters: {} });
      } catch (e) { console.error('[CategoryBrowser] drill error:', e.message); }
    }
  }, [loadGrid]);

  const openSheet = () => { setDraftFilters({ ...activeFilters }); setDraftSort(sort); setSheetOpen(true); };
  const toggleDraft = (key, value) => {
    setDraftFilters((prev) => {
      const cur = prev[key] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const out = { ...prev };
      if (next.length) out[key] = next; else delete out[key];
      return out;
    });
  };
  const applySheet = () => {
    setActiveFilters(draftFilters); setSort(draftSort); setSheetOpen(false);
    if (selected) loadGrid(selected, { sort: draftSort, filters: draftFilters });
  };
  const clearSheet = () => { setDraftFilters({}); setDraftSort('new'); };

  const activeCount = Object.values(activeFilters).reduce((n, v) => n + (v?.length || 0), 0);

  const breadcrumb = [railNode?.segment, railNode?.category, selected?.name]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('  ›  ');

  function renderProduct({ item }) {
    const showMrp = item.mrp != null && item.price != null && item.mrp > item.price;
    return (
      <TouchableOpacity style={s.pc} activeOpacity={0.85} onPress={() => goToProduct(navigation, item)}>
        <View style={s.pthumb}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={s.pimg} resizeMode="cover" />
            : <Text style={{ fontSize: 26, color: TZ.hint }}>🛍️</Text>}
        </View>
        <Text style={s.pname} numberOfLines={2}>{item.name}</Text>
        {item.brand?.name ? <Text style={s.pbrand} numberOfLines={1}>{item.brand.name}</Text> : null}
        <View style={s.prow}>
          <Text style={s.pprice}>{fmtMoney(item.price)}</Text>
          {showMrp ? <Text style={s.pmrp}>{fmtMoney(item.mrp)}</Text> : null}
          {item.discount_value ? <Text style={s.poff}>{item.discount_value}% off</Text> : null}
        </View>
        {item.rating != null
          ? <Text style={s.prate}>★ {item.rating}{item.review_count ? ` (${item.review_count})` : ''}</Text>
          : null}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={s.container}>
        <Header navigation={navigation} title={params.title || 'Browse'} />
        <View style={s.center}><ActivityIndicator size="large" color={TZ.pink} /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Header navigation={navigation} title={selected?.name || railNode?.category || params.title || 'Browse'} />
      {breadcrumb ? <Text style={s.crumb} numberOfLines={1}>{breadcrumb}</Text> : null}

      <View style={s.body}>
        {/* Left rail — sub-categories */}
        <ScrollView style={s.rail} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
          {rail.map((c, i) => {
            const on = selected && c.id === selected.id;
            const [bg, fg] = tint(i);
            return (
              <TouchableOpacity key={c.id} style={[s.ritem, on && s.ritemOn]} activeOpacity={0.8} onPress={() => onSelectRail(c)}>
                <View style={[s.rimg, { backgroundColor: bg }]}>
                  <Text style={{ fontSize: 18, color: fg }}>{c.is_leaf ? '◆' : '▸'}</Text>
                </View>
                <Text style={[s.rlbl, on && s.rlblOn]} numberOfLines={2}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Right pane — count + chips + grid */}
        <View style={s.pane}>
          <View style={s.ptop}>
            <Text style={s.pnm} numberOfLines={1}>{selected?.name || 'Pick a sub-category'}</Text>
            <Text style={s.pct}>{total} item{total === 1 ? '' : 's'}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <TouchableOpacity style={[s.chip, s.chipDark]} activeOpacity={0.8} onPress={openSheet}>
              <Text style={s.chipDarkTxt}>⚙  Filters{activeCount ? ` · ${activeCount}` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.chip} activeOpacity={0.8} onPress={openSheet}>
              <Text style={s.chipTxt}>Sort: {SORTS.find((x) => x.key === sort)?.label || 'Newest'} ▾</Text>
            </TouchableOpacity>
            {filters.map((f) => {
              const n = (activeFilters[f.key] || []).length;
              return (
                <TouchableOpacity key={f.key} style={[s.chip, n > 0 && s.chipOn]} activeOpacity={0.8} onPress={openSheet}>
                  <Text style={[s.chipTxt, n > 0 && s.chipOnTxt]}>{f.label}{n ? `: ${n}` : ''} ▾</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {gridLoading ? (
            <View style={s.center}><ActivityIndicator color={TZ.pink} /></View>
          ) : products.length === 0 ? (
            <View style={s.center}><Text style={s.empty}>No products here yet.</Text></View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(it, i) => String(it.id || i)}
              renderItem={renderProduct}
              numColumns={2}
              columnWrapperStyle={s.col}
              contentContainerStyle={s.gridPad}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>

      {/* Filter + sort sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Filter &amp; sort</Text>
              <TouchableOpacity onPress={clearSheet}><Text style={s.clear}>Clear all</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={s.fsec}>Sort by</Text>
              <View style={s.wrap}>
                {SORTS.map((o) => {
                  const on = draftSort === o.key;
                  return (
                    <TouchableOpacity key={o.key} style={[s.vpill, on && s.vpillOn]} onPress={() => setDraftSort(o.key)}>
                      <Text style={[s.vpillTxt, on && s.vpillTxtOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {filters.map((f) => (
                <View key={f.key}>
                  <Text style={s.fsec}>{f.label}</Text>
                  <View style={s.wrap}>
                    {f.values.map((v) => {
                      const on = (draftFilters[f.key] || []).includes(v.value);
                      return (
                        <TouchableOpacity key={v.value} style={[s.vpill, on && s.vpillOn]} onPress={() => toggleDraft(f.key, v.value)}>
                          <Text style={[s.vpillTxt, on && s.vpillTxtOn]}>{v.value}{v.count ? ` (${v.count})` : ''}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              {filters.length === 0 ? <Text style={s.empty}>No filters for this selection.</Text> : null}
            </ScrollView>
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setSheetOpen(false)}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={applySheet}><Text style={s.applyTxt}>Apply</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Header({ navigation, title }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.hbtn}><Text style={{ fontSize: 18, color: TZ.ink }}>←</Text></TouchableOpacity>
      <Text style={s.htitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity style={s.hbtn}><Text style={{ fontSize: 16, color: TZ.ink }}>⌕</Text></TouchableOpacity>
      <TouchableOpacity style={s.hbtn}><Text style={{ fontSize: 15, color: TZ.ink }}>⤴</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: TZ.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
  empty: { fontSize: 13, color: TZ.muted, fontFamily: fonts.sansRegular, textAlign: 'center', padding: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 48, paddingBottom: 11,
    paddingHorizontal: 14, backgroundColor: TZ.card, borderBottomWidth: 1, borderBottomColor: TZ.line,
  },
  hbtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  htitle: { flex: 1, fontSize: 16, fontWeight: '700', color: TZ.ink, fontFamily: fonts.sansBold },
  crumb: { fontSize: 11, color: TZ.hint, paddingHorizontal: 14, paddingTop: 8, fontFamily: fonts.sansRegular },

  body: { flex: 1, flexDirection: 'row' },
  rail: { width: 88, flexGrow: 0, borderRightWidth: 1, borderRightColor: TZ.line, backgroundColor: '#FCFCFD' },
  ritem: { paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', position: 'relative' },
  ritemOn: { backgroundColor: TZ.yellowTint },
  rimg: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  rlbl: { fontSize: 10, lineHeight: 12, color: '#52525B', textAlign: 'center', fontFamily: fonts.sansRegular },
  rlblOn: { color: TZ.ink, fontWeight: '700', fontFamily: fonts.sansBold },

  pane: { flex: 1, minWidth: 0 },
  ptop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  pnm: { fontSize: 13.5, fontWeight: '700', color: TZ.ink, flex: 1, fontFamily: fonts.sansBold },
  pct: { fontSize: 11, color: TZ.muted, marginLeft: 8, fontFamily: fonts.sansRegular },

  chips: { paddingHorizontal: 12, paddingBottom: 10, gap: 7 },
  chip: { borderWidth: 1, borderColor: TZ.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, marginRight: 7, backgroundColor: TZ.card },
  chipTxt: { fontSize: 11.5, color: TZ.ink, fontFamily: fonts.sansRegular },
  chipDark: { backgroundColor: TZ.ink, borderColor: TZ.ink },
  chipDarkTxt: { fontSize: 11.5, color: '#fff', fontFamily: fonts.sansBold, fontWeight: '700' },
  chipOn: { backgroundColor: TZ.pinkTint, borderColor: '#EDA9C2' },
  chipOnTxt: { color: TZ.pinkDark, fontWeight: '700' },

  gridPad: { paddingHorizontal: 12, paddingBottom: 40 },
  col: { gap: 10 },
  pc: { flex: 1, maxWidth: '48.5%', marginBottom: 12 },
  pthumb: { height: 122, borderRadius: 11, backgroundColor: TZ.pageBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pimg: { width: '100%', height: '100%' },
  pname: { fontSize: 12, color: TZ.ink, marginTop: 7, lineHeight: 16, fontFamily: fonts.sansRegular },
  pbrand: { fontSize: 10.5, color: TZ.muted, marginTop: 1, fontFamily: fonts.sansRegular },
  prow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 3, flexWrap: 'wrap' },
  pprice: { fontSize: 13, fontWeight: '800', color: TZ.ink, fontFamily: fonts.sansBold },
  pmrp: { fontSize: 11, color: TZ.hint, textDecorationLine: 'line-through', marginLeft: 5, fontFamily: fonts.sansRegular },
  poff: { fontSize: 11, fontWeight: '700', color: TZ.success, marginLeft: 6, fontFamily: fonts.sansBold },
  prate: { fontSize: 10.5, color: '#52525B', marginTop: 3, fontFamily: fonts.sansRegular },

  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: TZ.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: TZ.ink, fontFamily: fonts.sansBold },
  clear: { fontSize: 12, color: TZ.pink, fontWeight: '700', fontFamily: fonts.sansBold },
  fsec: { fontSize: 12, fontWeight: '700', color: TZ.muted, marginTop: 12, marginBottom: 7, fontFamily: fonts.sansBold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vpill: { borderWidth: 1, borderColor: TZ.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  vpillOn: { backgroundColor: TZ.pinkTint, borderColor: '#EDA9C2' },
  vpillTxt: { fontSize: 12, color: TZ.ink, fontFamily: fonts.sansRegular },
  vpillTxtOn: { color: TZ.pinkDark, fontWeight: '700', fontFamily: fonts.sansBold },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: TZ.line, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { fontSize: 13, color: TZ.ink, fontWeight: '700', fontFamily: fonts.sansBold },
  applyBtn: { flex: 2, backgroundColor: TZ.pink, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  applyTxt: { fontSize: 13, color: '#fff', fontWeight: '800', fontFamily: fonts.sansBold },
});
