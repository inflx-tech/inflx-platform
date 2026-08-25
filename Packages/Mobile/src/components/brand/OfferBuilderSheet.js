import React, { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { ProductPickerModal } from './ProductPicker';
import { buildDiscount, buildVolume, buildBogo, buildBundle, OFFER_TYPES } from '../../utils/offerBuilders';

/**
 * OfferBuilderSheet — build one offer, from anywhere that needs one.
 * Contract: features/brand-mobile-offers (A7), extracted by
 *           features/stage-2-build-a-campaign-from-the-phone (slice 6)
 * Board: 04-preview/mockups/stage2-screens.html panel ⑧ · action ledger #90–#95, #97
 *
 * WHY IT MOVED OUT OF THE LIBRARY SCREEN
 * This builder was written inside BrandOffersLibraryScreen. Stage 2's wizard needs the
 * same thing at step 4 section ② — "make a new one" — and building a second one would
 * have put two offer builders in the same app, validating against the same backend, only
 * one of which gets the next fix. That is the fault this programme has already had to
 * clean up four times.
 *
 * So it is a component now, and the library screen calls it exactly as the wizard does.
 * The validation still mirrors backend/src/services/offerConfig.validator via
 * utils/offerBuilders, so a shape the API would reject never leaves the phone.
 *
 * Props:
 *   visible    — show it
 *   onClose    — dismissed with nothing created
 *   onCreated  — (offer) => void, the created row. The library reloads its list; the
 *                wizard selects the new offer for the set it is building.
 *   activateByDefault — the wizard wants an offer that is live the moment it is used,
 *                because a draft offer reaches no shopper. The library keeps both buttons.
 */
export default function OfferBuilderSheet({ visible, onClose, onCreated, activateByDefault = false }) {
  const [name, setName]     = useState('');
  const [type, setType]     = useState('discount');
  const [sub, setSub]       = useState('pct');          // pct | flat
  const [value, setValue]   = useState('');
  const [vMode, setVMode]   = useState('spend');        // spend | quantity
  const [vTiers, setVTiers] = useState([{ threshold: '', pctOff: '' }]);
  const [bogoProduct, setBogoProduct] = useState(null);
  const [bogoBuy, setBogoBuy]   = useState('2');
  const [bogoFree, setBogoFree] = useState('1');
  const [bundleProducts, setBundleProducts] = useState([]);
  const [bundlePrice, setBundlePrice] = useState('');
  const [picker, setPicker] = useState(null);           // 'bogo' | 'bundle' | null
  const [acting, setActing] = useState(false);

  function reset() {
    setName(''); setValue(''); setSub('pct'); setType('discount');
    setVMode('spend'); setVTiers([{ threshold: '', pctOff: '' }]);
    setBogoProduct(null); setBogoBuy('2'); setBogoFree('1');
    setBundleProducts([]); setBundlePrice('');
    setPicker(null); setActing(false);
  }

  async function create(activate) {
    if (!name.trim()) { Alert.alert('Name required', 'Give the offer a name — creators and shoppers see it.'); return; }
    const built =
      type === 'volume' ? buildVolume({ mode: vMode, tiers: vTiers })
        : type === 'bogo' ? buildBogo({ product: bogoProduct, buyQty: bogoBuy, freeQty: bogoFree })
          : type === 'bundle' ? buildBundle({ products: bundleProducts, price: bundlePrice })
            : buildDiscount({ subType: sub, value });

    if (!built.ok) { Alert.alert('Check the offer', built.error); return; }

    setActing(true);
    const res = await brandApi.createOffer({
      name: name.trim(),
      offer_type: type,
      offer_config_json: built.config,
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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.scrim}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>New offer</Text>
            <Text style={s.sheetMeta}>Build discount, volume, BOGO or bundle offers right here.</Text>

            <Text style={s.label}>Offer name</Text>
            <TextInput style={s.input} value={name} onChangeText={setName}
              placeholder="e.g. Festive 20% Off" placeholderTextColor={P.muted3} />

            <Text style={s.label}>Offer type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {OFFER_TYPES.map(x => (
                <TouchableOpacity key={x.key} style={[s.chip, type === x.key && s.chipOn, { marginRight: 0 }]} onPress={() => setType(x.key)}>
                  <Text style={[s.chipTxt, type === x.key && s.chipTxtOn]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {type === 'discount' && (
              <>
                <Text style={s.label}>Discount type</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
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
                <View style={{ flexDirection: 'row', gap: 8 }}>
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
                      onChangeText={v => setVTiers(prev => prev.map((r, j) => j === i ? { ...r, threshold: v.replace(/[^\d.]/g, '') } : r))} />
                    <TextInput style={[s.input, { flex: 1 }]} value={t.pctOff} keyboardType="numeric"
                      placeholder="% off" placeholderTextColor={P.muted3}
                      onChangeText={v => setVTiers(prev => prev.map((r, j) => j === i ? { ...r, pctOff: v.replace(/[^\d.]/g, '') } : r))} />
                  </View>
                ))}
                <TouchableOpacity onPress={() => setVTiers(prev => [...prev, { threshold: '', pctOff: '' }])}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: P.ink, paddingVertical: 6 }}>+ Add tier</Text>
                </TouchableOpacity>
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
                  <Text style={{ fontSize: 13, color: bundleProducts.length ? P.ink : P.muted3 }} numberOfLines={1}>
                    {bundleProducts.length ? bundleProducts.map(p => p.name).join(', ') : 'Pick products'}
                  </Text>
                </TouchableOpacity>
                <Text style={s.label}>Bundle price (₹)</Text>
                <TextInput style={s.input} value={bundlePrice} keyboardType="numeric"
                  placeholder="e.g. 999" placeholderTextColor={P.muted3}
                  onChangeText={t => setBundlePrice(t.replace(/[^\d.]/g, ''))} />
              </>
            )}

            <View style={{ marginTop: 16, gap: 8 }}>
              <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting} onPress={() => create(true)}>
                <Text style={s.btnFillTxt}>{acting ? 'Working…' : activateByDefault ? 'Save and use it' : 'Save & activate'}</Text>
              </TouchableOpacity>
              {!activateByDefault && (
                <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting} onPress={() => create(false)}>
                  <Text style={[s.btnGhostTxt, { color: P.ink2 }]}>Save as draft</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.btn, s.btnPlain]} onPress={() => { reset(); onClose(); }}>
                <Text style={s.btnPlainTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {activateByDefault && (
              // A draft offer reaches no shopper, so the wizard never offers to save one.
              // Saying so beats a brand wondering why their new offer changes nothing.
              <Text style={s.note}>
                It goes live straight away — a draft offer reaches no shopper.
              </Text>
            )}
          </ScrollView>

          <ProductPickerModal
            visible={picker !== null}
            multi={picker === 'bundle'}
            selected={picker === 'bundle' ? bundleProducts : (bogoProduct ? [bogoProduct] : [])}
            onClose={() => setPicker(null)}
            onDone={(picked) => {
              if (picker === 'bundle') setBundleProducts(picked);
              else setBogoProduct(picked[0] || null);
              setPicker(null);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: P.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 26, maxHeight: '88%' },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '700', color: P.ink },
  sheetMeta:  { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted2, marginTop: 3, marginBottom: 6 },
  label:      { fontSize: 10.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 12, marginBottom: 5 },
  input:      { borderWidth: 1, borderColor: P.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, color: P.ink, backgroundColor: P.white },
  chip:       { borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn:     { backgroundColor: P.ink, borderColor: P.ink },
  chipTxt:    { fontSize: 12, fontWeight: '700', color: P.ink2 },
  chipTxtOn:  { color: P.white },
  btn:        { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnFill:    { backgroundColor: P.ink },
  btnFillTxt: { fontSize: 13, fontWeight: '800', color: P.white },
  btnGhost:   { borderWidth: 1, borderColor: P.border },
  btnGhostTxt:{ fontSize: 13, fontWeight: '700' },
  btnPlain:   {},
  btnPlainTxt:{ fontSize: 12.5, fontWeight: '700', color: P.muted2 },
  note:       { fontSize: 11, color: P.muted2, lineHeight: 16, marginTop: 10, textAlign: 'center' },
});
