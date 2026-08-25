import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * ProductPicker — the ONE "choose products from this brand's catalogue" component.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (slice 1)
 * Board: 04-preview/mockups/stage2-screens.html panel ⑦ · action ledger #86 · #87 · #93
 *
 * WHY THIS EXISTS AS ONE COMPONENT
 * The brand app carried TWO pickers doing this job before Stage 2:
 *   · screens/brand/BrandProductPickerScreen — a full screen with search, flat list,
 *     no images, ids-and-names out
 *   · components/brand/ProductPickerSheet — a 95-line modal, flat list, no search,
 *     no images, objects out
 * The action ledger names FOUR callers for this picker (allocation #86, offer scope
 * #93, the parcel builder #115, the creator tagging products in a post #123). Adding
 * a third implementation for allocation would have guaranteed they drift — which is
 * the exact fault behind four of Stage 1's twenty-one bugs (two creator searches, two
 * listing-tree endpoints, two ask composers, a group flow pointed at the wrong screen).
 *
 * So this is a merge, not an addition. Both previous callers now come through here and
 * BOTH KEEP THEIR EXISTING CONTRACT — the screen still hands back (ids, names), the
 * offer builder still hands back [{id, name}] — because changing a caller's contract
 * while merging is how a merge becomes a regression.
 *
 * WHAT THE BOARD ASKS FOR, BEYOND WHAT EITHER HAD
 *   · grouped by category, with a per-group select-all
 *   · product images and prices
 *   · search within the chosen category
 *   · a running count AND total value
 *   · an "Other · uncategorised" group that stays VISIBLE with a nudge to tag them
 *
 * That last one is not a nicety. Every practice product currently carries no category
 * link, so without the Other group this picker would render empty on the first walk and
 * read as broken. Hiding uncategorised stock would also hide real stock.
 */

const UNCATEGORISED = '__other__';
const money = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);

/** Both callers pass `selected` differently. Accept either and normalise to a Set of ids. */
function idsFrom(selected) {
  if (!Array.isArray(selected)) return new Set();
  return new Set(
    selected
      .map((s) => (s && typeof s === 'object' ? s.id : s))
      .filter((v) => v != null)
      .map(String)
  );
}

/**
 * The label a product is grouped under. `category_label` is the listing-tree node name
 * (added to GET /brands/me/products by this same slice); `section` is the older free-text
 * field and stays as the fallback so nothing that has one loses its grouping.
 */
function groupKeyOf(p) {
  const label = (p.category_label || p.section || '').trim();
  return label || UNCATEGORISED;
}

export function ProductPicker({
  multi = true,
  selected = [],
  onDone,
  onCancel,
  title,
  subtitle,
  doneLabel,
  /** Offer scope (#93) — a product not live in the store cannot carry an offer. */
  warnUnlisted = false,
  /**
   * Hide anything not live in the store. The basket preview needs this: an offer cannot
   * apply to an unlisted product, so offering one to pick is offering a refusal. Checked
   * against production on 2026-08-25 — every practice product is currently is_active
   * false, so without this the preview would list eighteen products and refuse all of them.
   */
  onlyLive = false,
}) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);
  const [q, setQ]             = useState('');
  const [cat, setCat]         = useState(null);         // null = All
  const [picked, setPicked]   = useState(() => idsFrom(selected));

  useEffect(() => {
    let alive = true;
    brandApi.listProducts()
      .then((res) => {
        if (!alive) return;
        if (res?.success) {
          const all = res.data?.products || res.data || [];
          setRows(onlyLive ? all.filter(r => r.is_active !== false) : all);
        } else setFailed(true);
      })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyLive]);

  const byId = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(String(r.id), r));
    return m;
  }, [rows]);

  /** Every category present, with its full count — the chip row. Other always sorts last. */
  const categories = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => {
      const k = groupKeyOf(r);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const named = [...counts.entries()]
      .filter(([k]) => k !== UNCATEGORISED)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (counts.has(UNCATEGORISED)) named.push([UNCATEGORISED, counts.get(UNCATEGORISED)]);
    return named.map(([key, n]) => ({ key, n }));
  }, [rows]);

  /** Search narrows within the chosen category, exactly as the board words it (#87). */
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = new Map();
    rows.forEach((r) => {
      const k = groupKeyOf(r);
      if (cat && k !== cat) return;
      if (needle && !String(r.name || '').toLowerCase().includes(needle)) return;
      if (!out.has(k)) out.set(k, []);
      out.get(k).push(r);
    });
    const named = [...out.entries()]
      .filter(([k]) => k !== UNCATEGORISED)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (out.has(UNCATEGORISED)) named.push([UNCATEGORISED, out.get(UNCATEGORISED)]);
    return named.map(([key, items]) => ({ key, items }));
  }, [rows, q, cat]);

  const uncategorisedTotal = useMemo(
    () => rows.filter((r) => groupKeyOf(r) === UNCATEGORISED).length,
    [rows]
  );

  const totalValue = useMemo(() => {
    let sum = 0;
    picked.forEach((id) => {
      const p = byId.get(id);
      if (p && p.price != null) sum += Number(p.price) || 0;
    });
    return sum;
  }, [picked, byId]);

  function toggle(id) {
    const key = String(id);
    setPicked((prev) => {
      if (!multi) return prev.has(key) ? new Set() : new Set([key]);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleGroup(items) {
    if (!multi) return;
    const keys = items.map((i) => String(i.id));
    const allOn = keys.every((k) => picked.has(k));
    setPicked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function done() {
    // Rows out, not bare ids. Every caller wants at least the name, and re-fetching the
    // catalogue to resolve a name is how a picked product ends up displayed as "Product".
    const out = [...picked]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        name: p.name || 'Product',
        price: p.price != null ? Number(p.price) : null,
        image_url: p.image_url || null,
        category_label: p.category_label || p.section || null,
        is_active: p.is_active !== false,
      }));
    if (typeof onDone === 'function') onDone(out);
  }

  const count = picked.size;
  const unlistedPicked = warnUnlisted
    ? [...picked].map((id) => byId.get(id)).filter((p) => p && p.is_active === false).length
    : 0;

  return (
    <View style={s.wrap}>
      <View style={s.nav}>
        {!!onCancel && (
          <TouchableOpacity onPress={onCancel} style={s.close} activeOpacity={0.6}>
            <Icon name="close" size={21} color={ig.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>{title || (multi ? 'Choose products' : 'Choose a product')}</Text>
          <Text style={s.navSub}>
            {subtitle || (count === 0
              ? `Nothing chosen yet · ${rows.length} in your store`
              : `${count} selected of ${rows.length}`)}
          </Text>
        </View>
      </View>

      <View style={s.searchWrap}>
        <Icon name="magnify" size={16} color={ig.mut2} />
        <TextInput
          style={s.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search by name…"
          placeholderTextColor={ig.mut2}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={ig.mut2} />
          </TouchableOpacity>
        )}
      </View>

      {categories.length > 1 && (
        <View style={s.chipsRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ key: null, n: rows.length }, ...categories]}
            keyExtractor={(c) => String(c.key)}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
            renderItem={({ item }) => {
              const on = cat === item.key;
              return (
                <TouchableOpacity
                  style={[s.chip, on && s.chipOn]}
                  activeOpacity={0.7}
                  onPress={() => setCat(item.key)}
                >
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>
                    {item.key === null ? 'All' : item.key === UNCATEGORISED ? 'Other' : item.key} · {item.n}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          contentContainerStyle={groups.length === 0 ? { flexGrow: 1 } : { paddingBottom: 108 }}
          renderItem={({ item: group }) => {
            const keys = group.items.map((i) => String(i.id));
            const onCount = keys.filter((k) => picked.has(k)).length;
            const isOther = group.key === UNCATEGORISED;
            return (
              <View style={s.group}>
                <View style={s.groupHd}>
                  <Text style={s.groupT}>
                    {isOther ? 'OTHER' : String(group.key).toUpperCase()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleGroup(group.items)}
                    disabled={!multi}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={s.groupN}>
                      {onCount} of {group.items.length}
                      {isOther ? ' · UNCATEGORISED' : ''}
                      {multi ? ' · SELECT ALL' : ''}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={s.grid}>
                  {group.items.map((p) => {
                    const on = picked.has(String(p.id));
                    return (
                      <TouchableOpacity
                        key={String(p.id)}
                        style={s.cell}
                        activeOpacity={0.75}
                        onPress={() => toggle(p.id)}
                      >
                        <View style={[s.img, on && s.imgOn]}>
                          {p.image_url
                            ? <Image source={{ uri: p.image_url }} style={s.imgFill} resizeMode="cover" />
                            : <Icon name="package-variant" size={18} color={ig.mut2} />}
                          <View style={[s.tick, on && s.tickOn]}>
                            {on && <Icon name="check" size={11} color={ig.bg} />}
                          </View>
                        </View>
                        <Text style={s.cellName} numberOfLines={2}>{p.name}</Text>
                        <Text style={s.cellPrice}>{money(p.price)}</Text>
                        {p.is_active === false && (
                          <Text style={s.cellOff}>not live</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isOther && (
                  <Text style={s.otherNote}>
                    {uncategorisedTotal} product{uncategorisedTotal === 1 ? '' : 's'} have no
                    category. They&apos;re still sellable — worth tagging them on the web.
                  </Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="package-variant" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>
                {failed ? 'Could not load your products'
                  : q ? 'No products match that'
                  : onlyLive ? 'Nothing is live in your store yet'
                    : 'You have no products yet'}
              </Text>
              <Text style={s.emptyS}>
                {failed ? 'Check your connection and try again.'
                  : q ? 'Try a shorter search, or clear the category filter.'
                    : onlyLive
                      ? 'An offer can only apply to a product a shopper can actually buy. Publish some products on the web dashboard first.'
                      : 'Add products on the web dashboard, then you can name exactly which ones a creator sells.'}
              </Text>
            </View>
          }
        />
      )}

      {count > 0 && (
        <View style={s.bar}>
          {unlistedPicked > 0 && (
            <Text style={s.barWarn}>
              {unlistedPicked} of these {unlistedPicked === 1 ? 'is' : 'are'} not live in your
              store — an offer can&apos;t apply to them.
            </Text>
          )}
          <Text style={s.barN}>
            {count} selected{totalValue > 0 ? ` · ${money(totalValue)} total value` : ''}
          </Text>
          <TouchableOpacity style={s.barBtn} onPress={done} activeOpacity={0.85}>
            <Text style={s.barT}>{doneLabel || (multi ? `Use these ${count}` : 'Use it')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Modal wrapper — the shape the offer builders already call with. */
export function ProductPickerModal({ visible, onClose, ...rest }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.sheet}>
          <ProductPicker {...rest} onCancel={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export default ProductPicker;

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  close: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 11, color: ig.mut, marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 11,
    borderWidth: 1, borderColor: ig.line, borderRadius: 9,
  },
  search: { flex: 1, fontSize: 13, color: ig.text, paddingVertical: 9 },

  chipsRow: { paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: ig.bg },
  chipOn: { backgroundColor: ig.text, borderColor: ig.text },
  chipTxt: { fontSize: 11, fontWeight: '700', color: ig.text2 },
  chipTxtOn: { color: ig.bg },

  group: { borderTopWidth: 1, borderTopColor: ig.lineSoft, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 4 },
  groupHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  groupT: { fontSize: 10, fontWeight: '800', color: ig.text2, letterSpacing: 0.2 },
  groupN: { fontSize: 9.5, fontWeight: '800', color: ig.mut2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cell: { width: '25%', paddingHorizontal: 3, marginBottom: 10 },
  img: {
    width: '100%', aspectRatio: 4 / 5, borderRadius: 7, backgroundColor: ig.lineSoft,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  imgOn: { borderWidth: 2, borderColor: ig.text },
  imgFill: { width: '100%', height: '100%' },
  tick: {
    position: 'absolute', top: 3, right: 3, width: 17, height: 17, borderRadius: 5,
    borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  tickOn: { backgroundColor: ig.text, borderColor: ig.text },
  cellName: { fontSize: 8.5, fontWeight: '700', color: ig.text2, marginTop: 3, lineHeight: 11 },
  cellPrice: { fontSize: 9, fontWeight: '800', color: ig.text },
  cellOff: { fontSize: 8, fontWeight: '700', color: ig.red, marginTop: 1 },

  otherNote: { fontSize: 9.5, color: ig.mut, lineHeight: 14, marginBottom: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 7 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4, textAlign: 'center' },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },

  bar: {
    position: 'absolute', left: 12, right: 12, bottom: 16,
    backgroundColor: ig.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, gap: 8,
  },
  barWarn: { fontSize: 10.5, fontWeight: '700', color: '#FFC9BC', lineHeight: 15 },
  barN: { fontSize: 12, fontWeight: '700', color: ig.bg },
  barBtn: { backgroundColor: ig.bg, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  barT: { fontSize: 12.5, fontWeight: '800', color: ig.text },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: ig.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    height: '85%', overflow: 'hidden',
  },
});
