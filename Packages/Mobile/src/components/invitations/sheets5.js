/**
 * Item 5 — the bottom sheets: the follower offer for one creator (I6), a special offer (I7),
 * the category / product picker behind "What she can sell", the decline sheet (I14) and
 * "View terms sent" (I10).
 * Contract: features/item5-invitations
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { Sheet } from '../settings/sheets';
import { PrimaryButton, SecondaryButton, DangerButton, SwitchRow, FieldError, Chip } from '../settings/primitives';
import { NumberField } from '../../screens/brand/BrandPitchSettingsScreen';
import { CheckboxRow } from '../discovery/bits';
import DateField from '../DateField';
import { buildDiscount, buildVolume, buildBogo, buildWindow } from '../../utils/offerBuilders';
import { TextField4 } from '../campaigns/bits4';
import { KV5 } from './bits5';
import { C5, MSG5, DECLINE_REASONS, first, rupees5, fmtPct5, aimLabel5, modeLabel5, longDate5, MIN_SHOPPABLE_POSTS } from './copy5';

/* ────────────────────────────────────────────── the brand's products */

/** Every published product of the signed-in brand (item 3's endpoint, all pages). */
export async function loadBrandProducts() {
  const me = await brandApi.getMe();
  if (!me.success) return { ok: false, rows: [] };
  const brandId = me.data.brand ? me.data.brand.id : me.data.id;
  const rows = [];
  for (let page = 1; page <= 10; page += 1) {
    const r = await brandApi.getBrandProducts(brandId, { page, limit: 50 });
    if (!r.success) return { ok: rows.length > 0, rows };
    rows.push(...(r.data.rows || []));
    if (rows.length >= (r.data.total || 0) || !(r.data.rows || []).length) break;
  }
  return { ok: true, rows, brandId };
}

/** Distinct categories among the brand's products: [{ id, name, count }]. */
export function categoriesOf(products) {
  const m = new Map();
  for (const p of products || []) {
    if (!p.categoryNodeId) continue;
    const cur = m.get(p.categoryNodeId) || { id: p.categoryNodeId, name: p.categoryName || p.categoryPath || 'Category', count: 0 };
    cur.count += 1; m.set(p.categoryNodeId, cur);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** "One-line summary" of a library offer, from its config. */
export function offerLine(o) {
  const c = o.offer_config_json || o.config || {};
  const scope = c.scope === 'category' ? (c.category || 'a category') : c.scope === 'products' ? `${(c.products || []).length} products` : 'whole store';
  switch (o.offer_type || o.offerType) {
    case 'discount': return `${c.sub_type === 'flat' ? rupees5(c.value) : fmtPct5(c.value)} off · ${scope}`;
    case 'volume': return `Buy more, save more · ${scope}`;
    case 'bogo': return `Buy ${c.buy_qty || 1}, get ${c.free_qty || 1} free`;
    case 'bundle': return `Bundle · ${(c.products || []).length} products`;
    case 'free_gift': return 'Free gift';
    default: return '';
  }
}

/* ───────────────────────────────────────────────── category / products */

/**
 * "Some categories" picks ONE category (the row stores one category node); "Chosen products"
 * picks many. `kind` = 'category' | 'products'.
 */
export function ScopePickerSheet5({ visible, kind, products, value, onApply, onClose }) {
  const [sel, setSel] = useState(new Set());
  const [cat, setCat] = useState(null);
  useEffect(() => { if (visible) { setSel(new Set(value && value.productIds ? value.productIds : [])); setCat(value && value.categoryNodeId ? value.categoryNodeId : null); } }, [visible]); // eslint-disable-line
  const cats = useMemo(() => categoriesOf(products), [products]);
  const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Sheet visible={visible} onClose={onClose} testID={`scope-sheet-${kind}`}>
      <Text style={s.title}>{kind === 'category' ? C5.terms.pickCategory : C5.terms.pickProducts}</Text>
      {!products || !products.length ? <Text style={s.hint}>{C5.terms.noProducts}</Text> : null}
      <ScrollView style={{ maxHeight: 360 }}>
        {kind === 'category' ? cats.map(c => (
          <TouchableOpacity key={c.id} style={s.row} onPress={() => setCat(c.id)} testID={`category-${c.id}`}>
            <View style={{ flex: 1 }}><Text style={s.rowName}>{c.name}</Text><Text style={s.rowSub}>{C5.terms.products(c.count)}</Text></View>
            <View style={[s.radio, cat === c.id && s.radioOn]}>{cat === c.id ? <View style={s.radioDot} /> : null}</View>
          </TouchableOpacity>
        )) : (products || []).map(p => (
          <CheckboxRow key={p.id} checked={sel.has(p.id)} onPress={() => toggle(p.id)} testID={`product-${p.id}`}>
            <Text style={s.rowName}>{p.name}</Text>
            <Text style={s.rowSub}>{[p.price != null ? rupees5(p.price) : null, p.categoryName].filter(Boolean).join(' · ')}</Text>
          </CheckboxRow>
        ))}
      </ScrollView>
      <View style={{ height: 10 }} />
      <PrimaryButton label={C5.terms.change === 'Change' ? 'Use these' : 'Use these'} testID="scope-apply"
        disabled={kind === 'category' ? !cat : sel.size === 0}
        onPress={() => {
          if (kind === 'category') { const c = cats.find(x => x.id === cat); onApply({ scope: 'category', categoryNodeId: cat, categoryName: c ? c.name : null, productIds: [], products: [] }); }
          else { const ids = [...sel]; onApply({ scope: 'products', categoryNodeId: null, categoryName: null, productIds: ids, products: (products || []).filter(p => sel.has(p.id)).map(p => ({ id: p.id, name: p.name, price: p.price })) }); }
        }} />
      <SecondaryButton label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

/* ────────────────────────────────────────────── the preview box (I6, I7) */

function useBasketPreview({ visible, example, commissionPct, candidate }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!visible || !example || !candidate) { setPreview(null); return undefined; }
    const body = { product_ids: [example.id], commission_pct: commissionPct === '' ? null : commissionPct };
    if (candidate.brandOfferId) body.brand_offer_id = candidate.brandOfferId;
    else if (candidate.offerType) { body.offer_type = candidate.offerType; body.offer_config_json = candidate.offerConfigJson; }
    brandApi.previewBasket(body).then(r => { if (alive) setPreview(r.success ? r.data : null); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
  }, [visible, example && example.id, commissionPct, JSON.stringify(candidate || null)]); // eslint-disable-line
  return preview;
}

function PreviewBox5({ preview, example, firstName }) {
  if (!preview || !example) return null;
  return (
    <View style={s.preview} testID="offer-preview">
      <Text style={s.previewMain}>{C5.offer.preview(example.price, example.name, preview.shopper_pays)}</Text>
      {preview.creator_earns != null ? <Text style={s.previewSub}>{C5.offer.earns(firstName, preview.creator_earns, preview.commission_pct)}</Text> : null}
    </View>
  );
}

/* ──────────────────────────────────────────────────── I6 follower offer */

/**
 * value: null | { kind:'library', brandOfferId, name, line } | { kind:'special', … }
 * onUse(value | null) · onSpecial() opens I7.
 */
export function OfferSheet5({ visible, creatorName, value, commissionPct, example, onUse, onSpecial, onClose }) {
  const f = first(creatorName);
  const [offers, setOffers] = useState(null);
  const [choice, setChoice] = useState('none'); // none | library | special
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setChoice(value ? value.kind : 'none'); setPicked(value && value.kind === 'library' ? value.brandOfferId : null);
    brandApi.getOffers().then(r => setOffers(r.success ? (r.data.offers || []).filter(o => o.status !== 'archived') : [])).catch(() => setOffers([]));
  }, [visible]); // eslint-disable-line
  const candidate = choice === 'library' && picked ? { brandOfferId: picked } : (choice === 'special' && value && value.kind === 'special' ? { offerType: value.offerType, offerConfigJson: value.offerConfigJson } : null);
  const preview = useBasketPreview({ visible, example, commissionPct, candidate });
  const canUse = choice === 'none' || (choice === 'library' && !!picked) || (choice === 'special' && value && value.kind === 'special');
  function use() {
    if (choice === 'none') return onUse(null);
    if (choice === 'library') { const o = (offers || []).find(x => x.id === picked); return onUse({ kind: 'library', brandOfferId: picked, name: o ? o.name : 'Saved offer', line: o ? offerLine(o) : '' }); }
    return onUse(value);
  }
  const Option = ({ k, title, sub, testID }) => (
    <TouchableOpacity style={[s.option, choice === k && s.optionOn]} onPress={() => { if (k === 'special') { onSpecial(); return; } setChoice(k); }} testID={testID}>
      <View style={{ flex: 1 }}><Text style={s.rowName}>{title}</Text><Text style={s.rowSub}>{sub}</Text></View>
      <View style={[s.radio, choice === k && s.radioOn]}>{choice === k ? <View style={s.radioDot} /> : null}</View>
    </TouchableOpacity>
  );
  return (
    <Sheet visible={visible} onClose={onClose} testID="offer-sheet">
      <Text style={s.eyebrow}>{C5.offer.header}</Text>
      <Text style={s.title}>{C5.offer.title(f)}</Text>
      <ScrollView style={{ maxHeight: 420 }}>
        <Option k="none" title={C5.offer.none} sub={C5.offer.noneSub} testID="offer-none" />
        <Option k="library" title={C5.offer.saved} sub={C5.offer.savedSub} testID="offer-library" />
        {choice === 'library' ? (
          <View style={s.sub}>
            {offers && !offers.length ? <Text style={s.hint}>{C5.offer.noSaved}</Text> : null}
            {(offers || []).map(o => (
              <TouchableOpacity key={o.id} style={s.row} onPress={() => setPicked(o.id)} testID={`saved-offer-${o.id}`}>
                <View style={{ flex: 1 }}><Text style={s.rowName}>{o.name}</Text><Text style={s.rowSub}>{offerLine(o)}</Text></View>
                <View style={[s.radio, picked === o.id && s.radioOn]}>{picked === o.id ? <View style={s.radioDot} /> : null}</View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <Option k="special" title={C5.offer.special} sub={C5.offer.specialSub(f)} testID="offer-special" />
        {value && value.kind === 'special' ? <View style={s.sub}><Text style={s.rowName}>{value.name || C5.offer.specialLine}</Text><Text style={s.rowSub}>{value.line}</Text></View> : null}
        <PreviewBox5 preview={preview} example={example} firstName={f} />
      </ScrollView>
      <View style={{ height: 10 }} />
      <PrimaryButton label={C5.offer.use} onPress={use} disabled={!canUse} testID="offer-use" />
    </Sheet>
  );
}

/* ───────────────────────────────────────────────────── I7 special offer */

/**
 * Three kinds only (money off, buy more save more, buy one get one). "Applies to" is hidden
 * for buy one get one because the engine ignores scope for it. Dates default to the set's
 * posting date with no end. onUse({ kind:'special', offerType, offerConfigJson, name, saveToLibrary, validFrom, validUntil, line }).
 */
export function SpecialOfferSheet5({ visible, creatorName, products, postingDate, commissionPct, example, value, onUse, onClose }) {
  const f = first(creatorName);
  const [kind, setKind] = useState('discount');
  const [sub, setSub] = useState('pct');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState('store');
  const [cat, setCat] = useState(null);
  const [prodIds, setProdIds] = useState([]);
  const [tiers, setTiers] = useState([{ threshold: '', pctOff: '' }]);
  const [bogoProduct, setBogoProduct] = useState(null);
  const [buyQty, setBuyQty] = useState('1');
  const [freeQty, setFreeQty] = useState('1');
  const [from, setFrom] = useState(null);
  const [until, setUntil] = useState(null);
  const [save, setSave] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [picker, setPicker] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setErr(''); setPicker(null);
    const v = value && value.kind === 'special' ? value : null;
    setKind(v ? v.offerType : 'discount'); setName(v ? v.name || '' : ''); setSave(v ? !!v.saveToLibrary : false);
    setFrom(v && v.validFrom ? v.validFrom : (postingDate || null)); setUntil(v && v.validUntil ? v.validUntil : null);
    const c = v ? v.offerConfigJson || {} : {};
    setSub(c.sub_type || 'pct'); setAmount(c.value != null ? String(c.value) : '');
    setScope(c.scope || 'store'); setCat(c.category_node_id ? { id: c.category_node_id, name: c.category } : null); setProdIds((c.products || []).map(p => p.id));
    setTiers(c.tiers && c.tiers.length ? c.tiers.map(t => ({ threshold: String(t.min_spend || t.min_qty || ''), pctOff: String(t.pct_off || '') })) : [{ threshold: '', pctOff: '' }]);
    setBogoProduct(c.product || null); setBuyQty(String(c.buy_qty || 1)); setFreeQty(String(c.free_qty || 1));
  }, [visible]); // eslint-disable-line

  const scoped = kind !== 'bogo';
  const cats = useMemo(() => categoriesOf(products), [products]);
  const prods = () => (products || []).filter(p => prodIds.includes(p.id)).map(p => ({ id: p.id, name: p.name, price: p.price }));

  function build() {
    const scopeArgs = { scope, category: cat ? cat.name : null, categoryNodeId: cat ? cat.id : null, products: prods() };
    if (kind === 'discount') {
      if (!(Number(amount) > 0) || (sub === 'pct' && Number(amount) > 100)) return { error: MSG5.OFFER_AMOUNT };
      if ((scope === 'category' && !cat) || (scope === 'products' && !prodIds.length)) return { error: MSG5.OFFER_SCOPE };
      const b = buildDiscount({ subType: sub, value: amount, ...scopeArgs });
      return b.ok ? { config: b.config } : { error: MSG5.OFFER_AMOUNT };
    }
    if (kind === 'volume') {
      if ((scope === 'category' && !cat) || (scope === 'products' && !prodIds.length)) return { error: MSG5.OFFER_SCOPE };
      const b = buildVolume({ mode: 'spend', tiers, ...scopeArgs });
      return b.ok ? { config: b.config } : { error: MSG5.OFFER_AMOUNT };
    }
    if (!bogoProduct) return { error: MSG5.OFFER_SCOPE };
    const b = buildBogo({ product: bogoProduct, buyQty, freeQty });
    return b.ok ? { config: b.config } : { error: MSG5.OFFER_AMOUNT };
  }
  const built = visible ? build() : { error: 'x' };
  const preview = useBasketPreview({ visible, example, commissionPct, candidate: built.config ? { offerType: kind, offerConfigJson: built.config } : null });

  function use() {
    const b = build();
    if (b.error) { setErr(b.error); return; }
    const win = buildWindow({ startsAt: from, endsAt: until });
    if (!win.ok) { setErr(MSG5.OFFER_DATES); return; }
    const line = offerLine({ offer_type: kind, offer_config_json: b.config });
    onUse({ kind: 'special', offerType: kind, offerConfigJson: b.config, name: name.trim() || null, saveToLibrary: save, validFrom: from || null, validUntil: until || null, line });
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="special-offer-sheet">
      <Text style={s.eyebrow}>{C5.special.header(creatorName)}</Text>
      <Text style={s.title}>{C5.special.title(f)}</Text>
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
        <View style={s.chips}>{C5.special.kinds.map(([k, l]) => <Chip key={k} label={l} selected={kind === k} onPress={() => { setKind(k); setErr(''); }} testID={`kind-${k}`} />)}</View>
        {kind === 'discount' ? (
          <>
            <Text style={s.label}>{C5.special.type}</Text>
            <View style={s.chips}><Chip label="%" selected={sub === 'pct'} onPress={() => setSub('pct')} testID="sub-pct" /><Chip label="₹" selected={sub === 'flat'} onPress={() => setSub('flat')} testID="sub-flat" /></View>
            <Text style={s.label}>{C5.special.amount}</Text>
            <NumberField value={amount} onChangeText={setAmount} placeholder={sub === 'pct' ? '12' : '500'} suffix={sub === 'pct' ? '%' : null} prefix={sub === 'flat' ? '₹' : null} decimal testID="special-amount" />
          </>
        ) : null}
        {kind === 'volume' ? (
          <>
            <Text style={s.label}>{C5.special.tiers}</Text>
            {tiers.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <NumberField value={t.threshold} onChangeText={(v) => setTiers(prev => prev.map((r, j) => (j === i ? { ...r, threshold: v } : r)))} placeholder={C5.special.tierSpend} prefix="₹" testID={`tier-${i}-spend`} />
                <NumberField value={t.pctOff} onChangeText={(v) => setTiers(prev => prev.map((r, j) => (j === i ? { ...r, pctOff: v } : r)))} placeholder={C5.special.tierOff} suffix="%" decimal testID={`tier-${i}-off`} />
              </View>
            ))}
            <TouchableOpacity onPress={() => setTiers(prev => [...prev, { threshold: '', pctOff: '' }])} testID="add-tier"><Text style={s.link}>+ {C5.special.addTier}</Text></TouchableOpacity>
          </>
        ) : null}
        {kind === 'bogo' ? (
          <>
            <Text style={s.label}>{C5.special.product}</Text>
            <TouchableOpacity style={s.field} onPress={() => setPicker('bogo')} testID="bogo-product"><Text style={s.fieldText}>{bogoProduct ? bogoProduct.name : C5.terms.pickProducts}</Text></TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={s.label}>{C5.special.buy}</Text><NumberField value={buyQty} onChangeText={setBuyQty} placeholder="1" testID="bogo-buy" /></View>
              <View style={{ flex: 1 }}><Text style={s.label}>{C5.special.free}</Text><NumberField value={freeQty} onChangeText={setFreeQty} placeholder="1" testID="bogo-free" /></View>
            </View>
          </>
        ) : null}
        {scoped ? (
          <>
            <Text style={s.label}>{C5.special.applies}</Text>
            <View style={s.chips}>{C5.special.scopes.map(([k, l]) => <Chip key={k} label={l} selected={scope === k} onPress={() => { setScope(k); if (k !== 'store') setPicker(k); }} testID={`applies-${k}`} />)}</View>
            {scope === 'category' && cat ? <Text style={s.hint}>{cat.name} · <Text style={s.link} onPress={() => setPicker('category')}>{C5.terms.change}</Text></Text> : null}
            {scope === 'products' && prodIds.length ? <Text style={s.hint}>{C5.terms.products(prodIds.length)} · <Text style={s.link} onPress={() => setPicker('products')}>{C5.terms.change}</Text></Text> : null}
          </>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <View style={{ flex: 1 }}><DateField label={C5.special.from} value={from} onChange={setFrom} testID="special-from" /></View>
          <View style={{ flex: 1 }}><DateField label={C5.special.until} value={until} onChange={setUntil} placeholder={C5.special.noEnd} minDate={from || undefined} testID="special-until" /></View>
        </View>
        <SwitchRow label={C5.special.save} hint={C5.special.saveHint} value={save} onValueChange={setSave} testID="special-save" />
        {save ? <TextField4 label={C5.special.nameLabel} value={name} onChangeText={setName} placeholder={C5.special.namePlaceholder(f)} max={60} testID="special-name" /> : null}
        <PreviewBox5 preview={preview} example={example} firstName={f} />
        <FieldError text={err} />
      </ScrollView>
      <View style={{ height: 10 }} />
      <PrimaryButton label={C5.offer.use} onPress={use} testID="special-use" />
      <ScopePickerSheet5 visible={picker === 'category' || picker === 'products'} kind={picker === 'category' ? 'category' : 'products'} products={products}
        value={{ categoryNodeId: cat ? cat.id : null, productIds: prodIds }}
        onApply={(v) => { if (v.scope === 'category') setCat({ id: v.categoryNodeId, name: v.categoryName }); else setProdIds(v.productIds); setPicker(null); }} onClose={() => setPicker(null)} />
      <ScopePickerSheet5 visible={picker === 'bogo'} kind="products" products={products} value={{ productIds: bogoProduct ? [bogoProduct.id] : [] }}
        onApply={(v) => { const p = v.products[0]; setBogoProduct(p ? { id: p.id, name: p.name, price: p.price } : null); setPicker(null); }} onClose={() => setPicker(null)} />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────── I14 decline */

export function DeclineSheet5({ visible, onDecline, onClose, busy }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setReason(null); setNote(''); setErr(''); } }, [visible]);
  function go() {
    if (!reason) { setErr(MSG5.DECLINE_REASON); return; }
    if (note.length > 200) { setErr(MSG5.DECLINE_NOTE_LONG); return; }
    onDecline({ reason, note: note.trim() || undefined });
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="decline-sheet">
      <Text style={s.eyebrow}>{C5.creator.detail.decline.toUpperCase()}</Text>
      <Text style={s.title}>{C5.creator.detail.declineTitle}</Text>
      <View style={s.chips}>{DECLINE_REASONS.map(([code, label]) => <Chip key={code} label={label} selected={reason === code} onPress={() => { setReason(code); setErr(''); }} testID={`reason-${code}`} />)}</View>
      <TextField4 label={C5.creator.detail.anythingElse} value={note} onChangeText={setNote} max={200} multiline hint={C5.creator.detail.declineHint} testID="decline-note" />
      <FieldError text={err} />
      <View style={{ height: 8 }} />
      <DangerButton label={busy ? '…' : C5.creator.detail.declineButton} onPress={busy ? () => {} : go} testID="decline-confirm" />
      <SecondaryButton label={C5.creator.detail.notYet} onPress={onClose} />
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────── I10 terms sent */

/** The terms exactly as sent, read-only (server shape: invitation.terms). */
export function TermsSentSheet5({ visible, invitation, onClose }) {
  const t = invitation && invitation.terms;
  return (
    <Sheet visible={visible} onClose={onClose} testID="terms-sent-sheet">
      <Text style={s.title}>{C5.set.termsTitle}</Text>
      {t ? (
        <View>
          {t.commissionPct != null ? <KV5 k={C5.terms.commission} v={fmtPct5(t.commissionPct)} /> : null}
          {t.fee != null ? <KV5 k={t.goal === 'hybrid' ? C5.terms.fixedFee : C5.terms.fee} v={rupees5(t.fee)} /> : null}
          {t.scope ? <KV5 k={C5.terms.sell} v={t.scope.words} /> : null}
          {t.offer ? <KV5 k={C5.terms.offer} v={t.offer.kind === 'none' ? C5.terms.none : (t.offer.name || C5.offer.specialLine)} /> : null}
          {t.shoppablePostsMin != null ? <KV5 k={C5.terms.shoppable} v={C5.terms.shoppableValue(t.shoppablePostsMin || MIN_SHOPPABLE_POSTS)} /> : null}
          {t.deliverablesWords ? <KV5 k={C5.terms.delivers} v={t.deliverablesWords} /> : null}
          {t.usageRights ? <KV5 k={C5.terms.reuse} v={t.usageRights.words} /> : null}
          {t.note ? <Text style={s.quote}>“{t.note}”</Text> : null}
          <Text style={s.hint}>{C5.set.termsHint}</Text>
        </View>
      ) : <Text style={s.hint}>…</Text>}
      <View style={{ height: 10 }} />
      <SecondaryButton label="Close" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 4 },
  title: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, marginBottom: 12 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 10, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 6 },
  link: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  rowSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  radioOn: { borderColor: T.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.ink },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { borderColor: T.ink },
  sub: { paddingLeft: 8, marginBottom: 8 },
  preview: { backgroundColor: T.surface, borderRadius: 12, padding: 12, marginTop: 8 },
  previewMain: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  previewSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 4, lineHeight: 17 },
  field: { height: 44, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 6 },
  fieldText: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink },
  quote: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, fontStyle: 'italic', marginTop: 10, lineHeight: 18 },
});

export { aimLabel5, modeLabel5, longDate5 };
