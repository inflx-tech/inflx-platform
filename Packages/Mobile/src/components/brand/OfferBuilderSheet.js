import React, { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { ProductPickerModal } from './ProductPicker';
import CategoryPickerModal from './CategoryPickerModal';
import DateField from '../DateField';
import {
  buildDiscount, buildVolume, buildBogo, buildBundle, buildFreeGift, buildWindow,
  OFFER_TYPES, OFFER_SCOPES, AVAILING_MODES, applicabilityHint,
} from '../../utils/offerBuilders';

/**
 * OfferBuilderSheet — build one offer, from anywhere that needs one.
 * Contract: features/brand-mobile-offers (A7) · extracted by stage-2-build-a-campaign-from-the-phone
 *           · brought to parity by features/stage-2-offers-parity
 *
 * WHY IT IS A COMPONENT
 * It was written inside BrandOffersLibraryScreen. The campaign wizard needs the same thing, and
 * building a second one would have put two offer builders in one app, validating against one
 * backend, only one of which gets the next fix.
 *
 * WHAT BATCH B ADDED, AND WHY EACH ONE MATTERED
 *
 *   1. **What the offer applies to.** The single worst defect in this file's history:
 *      `buildDiscount` and `buildVolume` both hardcoded `scope: 'store'`, so every discount
 *      and every volume offer built on a phone covered the WHOLE STORE whatever the brand
 *      wanted. Both offers in production are whole-store and nobody can now say whether that
 *      was chosen or imposed.
 *
 *   2. **Free gift** — the fifth type. On web, absent here, so a brand who wanted to give
 *      something away had to open a laptop.
 *
 *   3. **Where a shopper may redeem it** (`availing_modes`). The phone never sent it, and
 *      `createOffer` deliberately omits the column when unsupplied so the NOT NULL DEFAULT
 *      applies — meaning every phone-built offer silently became redeemable both in-store and
 *      online. Nobody chose that.
 *
 *   4. **A validity window.** The founder's explicit ask. The columns, the API and the refusal
 *      at checkout all existed already; there was simply no way to enter a date. Web does not
 *      have this either.
 *
 * Every config shape is produced by utils/offerBuilders, which `offerParity.test.js` runs
 * against web's own builder on the same input and compares object to object.
 *
 * Props:
 *   visible, onClose, onCreated(offer)
 *   activateByDefault — the wizard wants an offer live the moment it is used; a draft offer
 *                       reaches no shopper. The library keeps both buttons.
 *   inline            — build the config and hand it back WITHOUT saving it to the library.
 *                       Founder, 2026-08-27: an offer made for one creator is "dedicatedly for
 *                       that campaign, set, influencer" — it should not clutter a library it
 *                       was never meant to join. The server validates this path exactly as it
 *                       validates a library offer (campaign.controller resolveOfferAttachment
 *                       routes it through the same validateOfferConfig), so nothing is skipped
 *                       — only the row in brand_offers is.
 */
export default function OfferBuilderSheet({ visible, onClose, onCreated, activateByDefault = false, inline = false }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('discount');

  // discount
  const [sub, setSub] = useState('pct');
  const [value, setValue] = useState('');

  // volume
  const [vMode, setVMode] = useState('spend');
  const [vTiers, setVTiers] = useState([{ threshold: '', pctOff: '' }]);

  // scope — shared by discount and volume, which are the two the server scopes
  const [scope, setScope] = useState('store');
  const [category, setCategory] = useState(null);       // { id, name, path }
  const [scopeProducts, setScopeProducts] = useState([]);

  // bogo / bundle / free gift
  const [bogoProduct, setBogoProduct] = useState(null);
  const [bogoBuy, setBogoBuy] = useState('2');
  const [bogoFree, setBogoFree] = useState('1');
  const [bundleProducts, setBundleProducts] = useState([]);
  const [bundlePrice, setBundlePrice] = useState('');
  const [giftPairs, setGiftPairs] = useState([{ main: null, gift: null }]);

  // where and when
  const [modes, setModes] = useState(['pay_at_store', 'online_order']);
  const [startsAt, setStartsAt] = useState(null);
  const [endsAt, setEndsAt] = useState(null);

  const [picker, setPicker] = useState(null);   // 'scope' | 'bogo' | 'bundle' | 'gift-main-N' | 'gift-N'
  const [catOpen, setCatOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const scoped = type === 'discount' || type === 'volume';

  function reset() {
    setName(''); setValue(''); setSub('pct'); setType('discount');
    setVMode('spend'); setVTiers([{ threshold: '', pctOff: '' }]);
    setScope('store'); setCategory(null); setScopeProducts([]);
    setBogoProduct(null); setBogoBuy('2'); setBogoFree('1');
    setBundleProducts([]); setBundlePrice('');
    setGiftPairs([{ main: null, gift: null }]);
    setModes(['pay_at_store', 'online_order']);
    setStartsAt(null); setEndsAt(null);
    setPicker(null); setCatOpen(false); setActing(false);
  }

  const toggleMode = (k) =>
    setModes(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));

  /** Noon, so a calendar day cannot slide into the day before when the server reads it in UTC. */
  const at = (iso) => (iso ? new Date(`${iso}T12:00:00`).toISOString() : null);

  async function create(activate) {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the offer a name — creators and shoppers see it.');
      return;
    }
    if (!modes.length) {
      Alert.alert('Where can it be used?', 'Pick at least one place a shopper can use this offer.');
      return;
    }

    const scopeArgs = { scope, category: category?.name, categoryNodeId: category?.id, products: scopeProducts };
    const built =
      type === 'volume' ? buildVolume({ mode: vMode, tiers: vTiers, ...scopeArgs })
        : type === 'bogo' ? buildBogo({ product: bogoProduct, buyQty: bogoBuy, freeQty: bogoFree })
          : type === 'bundle' ? buildBundle({ products: bundleProducts, price: bundlePrice })
            : type === 'free_gift' ? buildFreeGift({ pairs: giftPairs })
              : buildDiscount({ subType: sub, value, ...scopeArgs });

    if (!built.ok) { Alert.alert('Check the offer', built.error); return; }

    const win = buildWindow({ startsAt, endsAt });
    if (!win.ok) { Alert.alert('Check the dates', win.error); return; }

    // inline — hand the config back rather than creating a library row. Everything above
    // this line has already run: the same validation, the same shape, the same refusals.
    if (inline) {
      const made = {
        offer_type: type,
        offer_config_json: built.config,
        availing_modes: modes,
        name: name.trim(),
        valid_from: at(win.window.startsAt),
        valid_until: at(win.window.endsAt),
      };
      reset();
      if (typeof onCreated === 'function') onCreated(made);
      return;
    }

    setActing(true);
    const res = await brandApi.createOffer({
      name: name.trim(),
      offer_type: type,
      offer_config_json: built.config,
      // Sent explicitly, always. Leaving it out is what silently made every phone-built offer
      // redeemable both ways.
      availing_modes: modes,
      store_starts_at: at(win.window.startsAt),
      store_ends_at: at(win.window.endsAt),
    });
    let offer = res?.success ? (res.data?.offer || null) : null;
    if (offer && activate) {
      const up = await brandApi.updateOffer(offer.id, { status: 'active' });
      if (up?.success) offer = up.data?.offer || { ...offer, status: 'active' };
    }
    setActing(false);

    if (!res?.success) {
      Alert.alert('Failed', res?.error?.message || 'Could not create the offer.');
      return;
    }
    reset();
    if (typeof onCreated === 'function') onCreated(offer);
  }

  if (!visible) return null;

  const hint = applicabilityHint(type, scope);
  const setPair = (i, half, p) =>
    setGiftPairs(prev => prev.map((r, j) => (j === i ? { ...r, [half]: p } : r)));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.scrim}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>New offer</Text>
            <Text style={s.sheetMeta}>Discount, volume, BOGO, bundle or a free gift.</Text>

            <Text style={s.label}>Offer name</Text>
            <TextInput style={s.input} value={name} onChangeText={setName}
              placeholder="e.g. Festive 20% Off" placeholderTextColor={P.muted3} />

            <Text style={s.label}>Offer type</Text>
            <View style={s.wrap}>
              {OFFER_TYPES.map(x => (
                <TouchableOpacity key={x.key} style={[s.chip, type === x.key && s.chipOn, { marginRight: 0 }]} onPress={() => setType(x.key)}>
                  <Text style={[s.chipTxt, type === x.key && s.chipTxtOn]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {type === 'discount' && (
              <>
                <Text style={s.label}>Discount type</Text>
                <View style={s.wrap}>
                  {[{ k: 'pct', l: '% percentage' }, { k: 'flat', l: '₹ flat off' }].map(x => (
                    <TouchableOpacity key={x.k} style={[s.chip, sub === x.k && s.chipOn, { marginRight: 0 }]} onPress={() => setSub(x.k)}>
                      <Text style={[s.chipTxt, sub === x.k && s.chipTxtOn]}>{x.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.label}>{sub === 'pct' ? 'Percentage off (1–100)' : 'Amount off (₹)'}</Text>
                <TextInput style={s.input} value={value} onChangeText={t => setValue(t.replace(/[^\d.]/g, ''))}
                  keyboardType="numeric" placeholder={sub === 'pct' ? 'e.g. 20' : 'e.g. 150'} placeholderTextColor={P.muted3} />
              </>
            )}

            {type === 'volume' && (
              <>
                <Text style={s.label}>Tier on</Text>
                <View style={s.wrap}>
                  {[{ k: 'spend', l: '₹ spend' }, { k: 'quantity', l: '# quantity' }].map(x => (
                    <TouchableOpacity key={x.k} style={[s.chip, vMode === x.k && s.chipOn, { marginRight: 0 }]} onPress={() => setVMode(x.k)}>
                      <Text style={[s.chipTxt, vMode === x.k && s.chipTxtOn]}>{x.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.label}>Tiers — {vMode === 'spend' ? 'spend ₹ → % off' : 'buy N → % off'}</Text>
                {vTiers.map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} value={t.threshold} keyboardType="numeric"
                      placeholder={vMode === 'spend' ? '₹ 2000' : 'qty 3'} placeholderTextColor={P.muted3}
                      onChangeText={v => setVTiers(prev => prev.map((r, j) => (j === i ? { ...r, threshold: v.replace(/[^\d.]/g, '') } : r)))} />
                    <TextInput style={[s.input, { flex: 1 }]} value={t.pctOff} keyboardType="numeric"
                      placeholder="% off" placeholderTextColor={P.muted3}
                      onChangeText={v => setVTiers(prev => prev.map((r, j) => (j === i ? { ...r, pctOff: v.replace(/[^\d.]/g, '') } : r)))} />
                  </View>
                ))}
                <TouchableOpacity onPress={() => setVTiers(prev => [...prev, { threshold: '', pctOff: '' }])}>
                  <Text style={s.addLink}>+ Add tier</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── What it applies to. THE fix. ─────────────────────────────── */}
            {scoped && (
              <>
                <Text style={s.label}>What it applies to</Text>
                <View style={s.wrap}>
                  {[
                    { k: 'store', l: 'Whole store' },
                    { k: 'category', l: 'A category' },
                    { k: 'products', l: 'Chosen products' },
                  ].map(x => (
                    <TouchableOpacity
                      key={x.k}
                      style={[s.chip, scope === x.k && s.chipOn, { marginRight: 0 }]}
                      onPress={() => setScope(x.k)}
                    >
                      <Text style={[s.chipTxt, scope === x.k && s.chipTxtOn]}>{x.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {scope === 'category' && (
                  <TouchableOpacity style={[s.input, { marginTop: 8 }]} onPress={() => setCatOpen(true)}>
                    <Text style={{ fontSize: 13, color: category ? P.ink : P.muted3 }} numberOfLines={2}>
                      {category ? category.path : 'Pick a category'}
                    </Text>
                  </TouchableOpacity>
                )}

                {scope === 'products' && (
                  <TouchableOpacity style={[s.input, { marginTop: 8 }]} onPress={() => setPicker('scope')}>
                    <Text style={{ fontSize: 13, color: scopeProducts.length ? P.ink : P.muted3 }} numberOfLines={2}>
                      {scopeProducts.length
                        ? `${scopeProducts.length} product${scopeProducts.length === 1 ? '' : 's'} · ${scopeProducts.map(p => p.name).join(', ')}`
                        : 'Pick the products'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {type === 'bogo' && (
              <>
                <Text style={s.label}>Product</Text>
                <TouchableOpacity style={s.input} onPress={() => setPicker('bogo')}>
                  <Text style={{ fontSize: 13, color: bogoProduct ? P.ink : P.muted3 }} numberOfLines={1}>
                    {bogoProduct ? bogoProduct.name : 'Pick a product'}
                  </Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Buy qty</Text>
                    <TextInput style={s.input} value={bogoBuy} keyboardType="numeric"
                      onChangeText={t => setBogoBuy(t.replace(/[^\d]/g, ''))} placeholderTextColor={P.muted3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Free qty</Text>
                    <TextInput style={s.input} value={bogoFree} keyboardType="numeric"
                      onChangeText={t => setBogoFree(t.replace(/[^\d]/g, ''))} placeholderTextColor={P.muted3} />
                  </View>
                </View>
              </>
            )}

            {type === 'bundle' && (
              <>
                <Text style={s.label}>Products (pick 2 or more)</Text>
                <TouchableOpacity style={s.input} onPress={() => setPicker('bundle')}>
                  <Text style={{ fontSize: 13, color: bundleProducts.length ? P.ink : P.muted3 }} numberOfLines={2}>
                    {bundleProducts.length ? bundleProducts.map(p => p.name).join(', ') : 'Pick products'}
                  </Text>
                </TouchableOpacity>
                <Text style={s.label}>Bundle price (₹)</Text>
                <TextInput style={s.input} value={bundlePrice} keyboardType="numeric"
                  placeholder="e.g. 999" placeholderTextColor={P.muted3}
                  onChangeText={t => setBundlePrice(t.replace(/[^\d.]/g, ''))} />
              </>
            )}

            {/* ── Free gift — the fifth type, new on the phone ─────────────── */}
            {type === 'free_gift' && (
              <>
                {giftPairs.map((pair, i) => (
                  <View key={i} style={s.pair}>
                    <Text style={s.pairT}>Pairing {i + 1}</Text>
                    <Text style={s.label}>When they buy</Text>
                    <TouchableOpacity style={s.input} onPress={() => setPicker(`gift-main-${i}`)}>
                      <Text style={{ fontSize: 13, color: pair.main ? P.ink : P.muted3 }} numberOfLines={1}>
                        {pair.main ? pair.main.name : 'Pick the qualifying product'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={s.label}>Give them free</Text>
                    <TouchableOpacity style={s.input} onPress={() => setPicker(`gift-free-${i}`)}>
                      <Text style={{ fontSize: 13, color: pair.gift ? P.ink : P.muted3 }} numberOfLines={1}>
                        {pair.gift ? pair.gift.name : 'Pick the gift'}
                      </Text>
                    </TouchableOpacity>
                    {giftPairs.length > 1 && (
                      <TouchableOpacity onPress={() => setGiftPairs(prev => prev.filter((_, j) => j !== i))}>
                        <Text style={[s.addLink, { color: P.muted2 }]}>Remove this pairing</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {/* Web allows more than one pairing, so this does too: "buy a saree, get a
                    bindi set" and "buy a lehenga, get a clutch" are ONE offer with two
                    pairings, not two offers competing for the same basket. */}
                <TouchableOpacity onPress={() => setGiftPairs(prev => [...prev, { main: null, gift: null }])}>
                  <Text style={s.addLink}>+ Add another pairing</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Where a shopper can use it ───────────────────────────────── */}
            <Text style={s.label}>Where a shopper can use it</Text>
            <View style={s.wrap}>
              {AVAILING_MODES.map(m => {
                const on = modes.includes(m.key);
                return (
                  <TouchableOpacity key={m.key} style={[s.chip, on && s.chipOn, { marginRight: 0 }]} onPress={() => toggleMode(m.key)}>
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* The sentence web shows and the phone did not. A paper bill has no basket, so it
                cannot be scoped — saying so here beats a brand wondering for a month why the
                offer never applies in the shop. */}
            <Text style={s.hint}>{hint}</Text>

            {/* ── When it runs ─────────────────────────────────────────────── */}
            <Text style={s.label}>When it runs</Text>
            <DateField label="Starts" value={startsAt} onChange={setStartsAt} placeholder="No start limit" />
            <DateField
              label="Ends"
              value={endsAt}
              onChange={setEndsAt}
              placeholder="No end limit"
              minDate={startsAt || undefined}
            />
            <Text style={s.hint}>
              Leave either blank for no limit. A shopper is refused outside these dates.
            </Text>

            <View style={{ marginTop: 16, gap: 8 }}>
              <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting} onPress={() => create(true)}>
                <Text style={s.btnFillTxt}>
                  {acting ? 'Working…' : inline ? 'Use this offer' : activateByDefault ? 'Save and use it' : 'Save & activate'}
                </Text>
              </TouchableOpacity>
              {!activateByDefault && !inline && (
                <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting} onPress={() => create(false)}>
                  <Text style={[s.btnGhostTxt, { color: P.ink2 }]}>Save as draft</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting} onPress={() => { reset(); onClose(); }}>
                <Text style={s.btnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CategoryPickerModal
        visible={catOpen}
        selectedId={category?.id}
        onPick={setCategory}
        onClose={() => setCatOpen(false)}
      />

      <ProductPickerModal
        visible={!!picker}
        onClose={() => setPicker(null)}
        multi={picker === 'bundle' || picker === 'scope'}
        onlyLive
        title={picker === 'scope' ? 'Which products?' : 'Pick a product'}
        onDone={(picked) => {
          const list = Array.isArray(picked) ? picked : [picked].filter(Boolean);
          if (picker === 'bundle') setBundleProducts(list);
          else if (picker === 'scope') setScopeProducts(list);
          else if (picker === 'bogo') setBogoProduct(list[0] || null);
          else if (picker?.startsWith('gift-main-')) setPair(Number(picker.split('-')[2]), 'main', list[0] || null);
          else if (picker?.startsWith('gift-free-')) setPair(Number(picker.split('-')[2]), 'gift', list[0] || null);
          setPicker(null);
        }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: P.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 26, maxHeight: '92%' },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: P.ink, fontFamily: fonts?.display },
  sheetMeta: { fontSize: 12, color: P.muted2, marginTop: 2, marginBottom: 4 },
  label: { fontSize: 10.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 12, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: P.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, color: P.ink, marginBottom: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: P.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  chipOn: { backgroundColor: P.ink, borderColor: P.ink },
  chipTxt: { fontSize: 11.5, fontWeight: '800', color: P.muted2 },
  chipTxtOn: { color: P.bg },
  hint: { fontSize: 11, color: P.muted2, fontWeight: '650', marginTop: 7, lineHeight: 16 },
  addLink: { fontSize: 12.5, fontWeight: '800', color: P.ink, paddingVertical: 6 },
  pair: { borderWidth: 1, borderColor: P.line, borderRadius: 10, padding: 11, marginTop: 9 },
  pairT: { fontSize: 11, fontWeight: '800', color: P.ink },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnFill: { backgroundColor: P.ink },
  btnFillTxt: { fontSize: 13, fontWeight: '800', color: P.bg },
  btnGhost: { borderWidth: 1, borderColor: P.line },
  btnGhostTxt: { fontSize: 13, fontWeight: '800', color: P.muted2 },
});
