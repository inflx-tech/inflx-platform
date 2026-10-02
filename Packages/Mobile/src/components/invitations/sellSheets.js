/**
 * creator-terms-v2 — what the brand gives a creator to sell (T2, T3, T4, T6).
 * Contract: features/creator-terms-v2 · rules Docs/OFFER_TERMS_POSTS_RULES.md §2
 *
 *   OffersSheet          T2 · the brand's offers valid on the posting day or the day after, as a
 *                        checklist with "Select all", an "ends soon" warning, and the ones left out
 *                        T6 · none valid → build one on the website, or give products instead
 *   ProductsSheet        T3 · None / All products without offers / Choose products
 *   ChooseProductsModal  T4 · category → all / tick some (with a price filter), or search — only
 *                        products not in any offer on or after the posting date
 *
 * The server is the judge: it re-checks every offer's dates and freezes the product list at sending.
 *
 * ui-walk-fixes (board C): ChooseProductsModal is a full-screen pop-up built like a screen, so it
 * follows the screens' rule — "Use N products" is a strip under the list (BottomBar), never
 * floating over it, and the list is a FormScroll because it holds the search and price boxes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Modal, Linking } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, Chip } from '../settings/primitives';
import { CheckboxRow } from '../discovery/bits';
import { BottomBar } from '../shell/BottomBar';
import { FormScroll, FormArea } from '../shell/FormScroll';
import { Header } from '../../screens/brand/BrandPitchSettingsScreen';
import { C5, first, rupees5 } from './copy5';

const S = C5.sell;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-10' → '10 Oct' */
export function dayMonth(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
}
function nextDay(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return '';
  const x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1));
  return x.toISOString().slice(0, 10);
}
const span = (a, b) => `${dayMonth(a)} – ${dayMonth(b)}`;
export const BUILD_OFFER_URL = 'https://inflx.in/dashboard/products/offers/new';

/* ───────────────────────────────────────────────────────── T2 / T6 offers */

export function OffersSheet({ visible, campaignId, setId, postingDate, creatorName, value, onUse, onClose }) {
  const f = first(creatorName);
  const [data, setData] = useState(null);     // { offers, hidden }
  const [err, setErr] = useState(false);
  const [picked, setPicked] = useState([]);
  useEffect(() => {
    if (!visible) return;
    setPicked((value || []).map(o => o.id));
    setErr(false);
    brandApi.offerChoices(campaignId, setId)
      .then(r => { if (r.success) setData(r.data); else setErr(true); })
      .catch(() => setErr(true));
  }, [visible]); // eslint-disable-line
  const offers = (data && data.offers) || [];
  const all = offers.length > 0 && picked.length === offers.length;
  const toggle = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const hiddenLine = data && data.hidden && data.hidden.length
    ? S.hidden(data.hidden.length, data.hidden.slice(0, 3).map(h => (h.why === 'starts' ? S.hiddenStarts(dayMonth(h.date)) : h.why === 'ends' ? S.hiddenEnds(dayMonth(h.date)) : S.hiddenEnded(dayMonth(h.date)))).join(', '))
    : null;
  const use = () => onUse(offers.filter(o => picked.includes(o.id)));

  if (data && !offers.length) {
    return (
      <Sheet visible={visible} onClose={onClose} testID="offers-sheet">
        <Text style={s.title}>{S.offersTitle(f)}</Text>
        <View style={s.emptyCard} testID="offers-empty">
          <Text style={s.emptyTitle}>{S.noOffersTitle(dayMonth(postingDate))}</Text>
          <Text style={s.emptyBody}>{S.noOffersBody(dayMonth(postingDate), dayMonth(nextDay(postingDate)))}</Text>
        </View>
        <SecondaryButton label={`🔗 ${S.buildOnWeb}`} onPress={() => Linking.openURL(BUILD_OFFER_URL).catch(() => {})} testID="offers-build-web" />
        <View style={{ height: 8 }} />
        <PrimaryButton label={S.close} onPress={onClose} testID="offers-close" />
      </Sheet>
    );
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="offers-sheet">
      <Text style={s.title}>{S.offersTitle(f)}</Text>
      <Text style={s.hint}>{S.offersHint(dayMonth(postingDate))}</Text>
      {err ? <Text style={s.err}>{S.loadFailed}</Text> : null}
      {!data && !err ? <Text style={s.hint}>…</Text> : null}
      {offers.length ? (
        <View style={s.selRow}>
          <CheckboxRow checked={all} onPress={() => setPicked(all ? [] : offers.map(o => o.id))} testID="offers-select-all"><Text style={s.rowSub}>{S.selectAll}</Text></CheckboxRow>
          <Text style={s.rowSub}>{S.picked(picked.length, offers.length)}</Text>
        </View>
      ) : null}
      <ScrollView style={{ maxHeight: 380 }}>
        {offers.map(o => (
          <CheckboxRow key={o.id} checked={picked.includes(o.id)} onPress={() => toggle(o.id)} testID={`offer-${o.id}`}>
            <Text style={s.rowName}>{o.name}</Text>
            <Text style={s.rowSub}>{o.type_label} · {o.products} {o.products === 1 ? 'product' : 'products'}{o.gifts ? ` + ${o.gifts} gift${o.gifts > 1 ? 's' : ''}` : ''} · {span(o.starts_on, o.ends_on)}</Text>
            {o.ends_soon ? <Text style={s.soon}>{S.endsSoon(dayMonth(o.ends_on), o.ends_soon.days_after_posting)}</Text> : null}
          </CheckboxRow>
        ))}
        {hiddenLine ? <Text style={s.hint} testID="offers-hidden">{hiddenLine}</Text> : null}
      </ScrollView>
      <View style={{ height: 10 }} />
      <PrimaryButton label={S.give(picked.length)} onPress={use} testID="offers-give" />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────── T3 products without offers */

/**
 * value: { mode:'none'|'all'|'chosen', ids, products, allCount }
 * onUse(value) · onChoose() opens T4.
 */
export function ProductsSheet({ visible, campaignId, setId, postingDate, value, onUse, onChoose, onClose }) {
  const [mode, setMode] = useState('none');
  const [free, setFree] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setMode(value && value.mode ? value.mode : 'none');
    brandApi.productsWithoutOffersForSet(campaignId, setId).then(r => setFree(r.success ? r.data.products : [])).catch(() => setFree([]));
  }, [visible]); // eslint-disable-line
  const chosenN = value && value.ids ? value.ids.length : 0;
  const cats = value && value.products ? [...new Set(value.products.map(p => p.leaf_name).filter(Boolean))].slice(0, 2).join(', ') : '';
  const Option = ({ k, title, sub, testID }) => (
    <TouchableOpacity style={[s.option, mode === k && s.optionOn]} onPress={() => { if (k === 'chosen') { onChoose(); return; } setMode(k); }} testID={testID}>
      <View style={[s.radio, mode === k && s.radioOn]}>{mode === k ? <View style={s.radioDot} /> : null}</View>
      <View style={{ flex: 1 }}><Text style={s.rowName}>{title}</Text><Text style={s.rowSub}>{sub}</Text></View>
    </TouchableOpacity>
  );
  function done() {
    if (mode === 'all') return onUse({ mode: 'all', ids: [], products: [], allCount: free ? free.length : 0 });
    if (mode === 'chosen') return onUse(value);
    return onUse({ mode: 'none', ids: [], products: [], allCount: 0 });
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="products-sheet">
      <Text style={s.title}>{S.productsTitle}</Text>
      <Text style={s.hint}>{S.productsHint()}</Text>
      <View style={{ height: 8 }} />
      <Option k="none" title={S.none} sub={S.noneSub} testID="products-none" />
      <Option k="all" title={S.all} sub={free ? S.allSub(free.length) : '…'} testID="products-all" />
      <Option k="chosen" title={S.choose} sub={S.chooseSub(chosenN, cats)} testID="products-choose" />
      {mode === 'chosen' && chosenN ? (
        <TouchableOpacity style={s.changeBtn} onPress={onChoose} testID="products-change"><Text style={s.link}>✎ {S.change(chosenN)}</Text></TouchableOpacity>
      ) : null}
      <Text style={s.hint}>{S.giveTheOffer}</Text>
      <View style={{ height: 10 }} />
      <PrimaryButton label={S.done} onPress={done} testID="products-done" />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────── T4 choosing products */

function findPath(nodes, id, trail = []) {
  for (const n of nodes || []) {
    if (n.id === id) return [...trail, n];
    const hit = findPath(n.children, id, [...trail, n]);
    if (hit) return hit;
  }
  return null;
}

export function ChooseProductsModal({ visible, campaignId, setId, value, onUse, onClose }) {
  const [tab, setTab] = useState(0);           // 0 categories · 1 search
  const [tree, setTree] = useState(null);
  const [node, setNode] = useState(null);
  const [mode, setMode] = useState('all');      // 'all' | 'pick' (inside a category)
  const [q, setQ] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState({});      // id → product
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const start = {};
    for (const p of (value && value.products) || []) start[p.id] = p;
    for (const id of (value && value.ids) || []) if (!start[id]) start[id] = { id };
    setPicked(start); setNode(null); setTab(0); setQ(''); setRows(null); setMode('all');
    brandApi.getListingTree().then(r => setTree(r.success ? (r.data.tree || []) : [])).catch(() => setTree([]));
  }, [visible]); // eslint-disable-line

  useEffect(() => {
    if (!visible) return;
    const params = {};
    if (tab === 1) { if (!q.trim()) { setRows(null); return; } params.q = q.trim(); }
    else if (node) params.node = node.id;
    else { setRows(null); return; }
    if (min !== '') params.price_min = min;
    if (max !== '') params.price_max = max;
    setErr(false);
    const tm = setTimeout(() => {
      brandApi.productsWithoutOffersForSet(campaignId, setId, params)
        .then(r => { if (r.success) setRows(r.data.products); else setErr(true); })
        .catch(() => setErr(true));
    }, tab === 1 ? 300 : 0);
    return () => clearTimeout(tm);
  }, [visible, tab, node, q, min, max]); // eslint-disable-line

  const children = useMemo(() => ((node ? node.children : tree) || []).filter(n => (n.product_count || 0) > 0), [node, tree]);
  const path = node && tree ? (findPath(tree, node.id) || [node]) : [];
  const pickedIds = Object.keys(picked);
  const toggle = (p) => setPicked(prev => { const n = { ...prev }; if (n[p.id]) delete n[p.id]; else n[p.id] = p; return n; });
  const allIn = rows && rows.length > 0 && rows.every(p => picked[p.id]);
  const takeAll = () => setPicked(prev => { const n = { ...prev }; if (allIn) { for (const p of rows) delete n[p.id]; } else { for (const p of rows) n[p.id] = p; } return n; });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.screen} testID="choose-products">
        <Header title={S.chooseTitle} onBack={onClose} />
        <View style={s.seg}>
          {S.tabs.map((label, i) => (
            <TouchableOpacity key={label} style={[s.segItem, tab === i && s.segOn]} onPress={() => setTab(i)} testID={`choose-tab-${i}`}>
              <Text style={[s.segText, tab === i && s.segTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FormArea>
        <FormScroll contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" testID="choose-list">
          {tab === 1 ? (
            <TextInput style={s.search} value={q} onChangeText={setQ} placeholder={S.searchPlaceholder} placeholderTextColor={T.ink3} autoFocus testID="choose-search" />
          ) : (
            <>
              <View style={s.crumbs}>
                <TouchableOpacity onPress={() => setNode(null)}><Text style={s.crumb}>ALL</Text></TouchableOpacity>
                {path.map(n => (
                  <TouchableOpacity key={n.id} onPress={() => setNode(n)}><Text style={s.crumb}> › {String(n.name).toUpperCase()}</Text></TouchableOpacity>
                ))}
                {rows ? <Text style={s.crumbMut}> · {S.freeCount(rows.length)}</Text> : null}
              </View>
              {children.map(n => (
                <TouchableOpacity key={n.id} style={s.nodeRow} onPress={() => setNode(n)} testID={`choose-node-${n.id}`}>
                  <Text style={s.rowName}>{n.name}</Text><Text style={s.chev}>›</Text>
                </TouchableOpacity>
              ))}
              {node && rows ? (
                <View style={s.chipRow}>
                  <Chip label={S.allIn(rows.length)} selected={mode === 'all'} onPress={() => { setMode('all'); if (!allIn) takeAll(); }} testID="choose-all" />
                  <Chip label={S.tickSome} selected={mode === 'pick'} onPress={() => setMode('pick')} testID="choose-pick" />
                  <Chip label="Filters" selected={showFilter} onPress={() => setShowFilter(v => !v)} testID="choose-filters" />
                </View>
              ) : null}
            </>
          )}
          {showFilter && (tab === 1 || node) ? (
            <View style={s.filter}>
              <Text style={s.rowSub}>Price</Text>
              <TextInput style={s.priceIn} value={min} onChangeText={setMin} placeholder="from" keyboardType="numeric" placeholderTextColor={T.ink3} testID="choose-min" />
              <Text style={s.rowSub}>–</Text>
              <TextInput style={s.priceIn} value={max} onChangeText={setMax} placeholder="to" keyboardType="numeric" placeholderTextColor={T.ink3} testID="choose-max" />
            </View>
          ) : null}
          {err ? <Text style={s.err}>{S.loadFailed}</Text> : null}
          {(rows || []).map(p => (
            <CheckboxRow key={p.id} checked={!!picked[p.id]} onPress={() => toggle(p)} testID={`choose-product-${p.id}`}>
              <Text style={s.rowName}>{p.name}</Text>
              <Text style={s.rowSub}>{rupees5(p.price)}{p.next_offer ? ` · joins "${p.next_offer.name}" ${dayMonth(p.next_offer.from)}, stays normal price for her` : ''}{!p.next_offer && p.last_offer ? ` · offer ended ${dayMonth(p.last_offer.until)}` : ''}</Text>
            </CheckboxRow>
          ))}
          {rows && !rows.length ? <Text style={s.hint}>Nothing here without an offer.</Text> : null}
          <Text style={s.hint}>{S.notHere}</Text>
        </FormScroll>
        </FormArea>
        <BottomBar testID="choose-actions">
          <PrimaryButton label={S.use(pickedIds.length)} onPress={() => onUse(pickedIds, Object.values(picked))} testID="choose-use" />
        </BottomBar>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  title: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 6 },
  err: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.danger, marginTop: 6 },
  link: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  selRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  rowSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  soon: { fontFamily: fonts.sansBold, fontSize: 11.5, color: T.state.yourMove.fg, marginTop: 3, lineHeight: 15 },
  emptyCard: { backgroundColor: T.surface, borderRadius: 14, padding: 16, alignItems: 'center', marginVertical: 10 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  option: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderColor: T.border, borderRadius: 12, padding: 11, marginBottom: 8 },
  optionOn: { borderColor: T.ink, backgroundColor: T.surface },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  radioOn: { borderColor: T.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.ink },
  changeBtn: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: T.ink, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  seg: { flexDirection: 'row', backgroundColor: T.surface, borderRadius: 12, padding: 3, marginHorizontal: 16, marginTop: 8 },
  segItem: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: '#fff' },
  segText: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2 },
  segTextOn: { color: T.ink },
  search: { height: 42, borderRadius: 12, backgroundColor: T.surface, paddingHorizontal: 12, fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  crumb: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink3, letterSpacing: 0.4 },
  crumbMut: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3 },
  nodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  chev: { fontSize: 16, color: T.ink3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  priceIn: { width: 80, height: 36, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, paddingHorizontal: 8, fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink },
});
