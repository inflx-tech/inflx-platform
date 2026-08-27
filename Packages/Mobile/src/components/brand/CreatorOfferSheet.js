import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import DateField from '../DateField';
import OfferBuilderSheet from './OfferBuilderSheet';
import { buildWindow } from '../../utils/offerBuilders';

/**
 * CreatorOfferSheet — the offer one creator gives her followers.
 * Contract: features/stage-2-offers-parity (P5)
 * Board: 04-preview/mockups/offers.html panels ① and ②
 *
 * THE FOUNDER'S MODEL, WHICH IS ALSO THE DATABASE'S
 * "if brand wants to give offer to particular influencer, he open at creator level and can give
 *  an offer... this offer is two levels: one is already created in offers engine, or create one
 *  at that moment dedicatedly for that campaign, set, influencer."
 *
 * That is exactly what `campaign_influencers` has always held: `brand_offer_id` for a library
 * offer, `offer_type` + `offer_config_json` for a bespoke one, and `offer_valid_from` /
 * `offer_valid_until` for her window. `campaign_sets` has no offer columns at all — the wizard's
 * old set-level question was storing an answer the schema had nowhere to put.
 *
 * TWO COLUMNS, TWO MEANINGS, NEVER BOTH
 * A library pick writes `brand_offer_id` and nothing else. A bespoke build writes the type and
 * config and no id. Writing both would leave nobody able to say which one a shopper actually
 * got — and the server snapshots a library offer's config at attach time precisely so a later
 * edit to the library cannot silently change a deal already struck.
 *
 * HER OWN DATES
 * "set date is for all creators... one individual creator may be work from different time."
 * A set has one start for everybody. Creators do not all begin on it: one signs late, one is
 * asked to hold until a launch. So the window is hers.
 */
export default function CreatorOfferSheet({ visible, creator, value, onSave, onClose }) {
  const [offers, setOffers] = useState(null);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState(null);        // the chosen offer, either shape
  const [from, setFrom] = useState(null);
  const [until, setUntil] = useState(null);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPicked(value || null);
    setFrom(value?.valid_from ? String(value.valid_from).slice(0, 10) : null);
    setUntil(value?.valid_until ? String(value.valid_until).slice(0, 10) : null);
    setErr(null);
    brandApi.getOffers()
      .then((res) => {
        if (!res?.success) { setErr(res?.error?.message || 'Could not load your offers.'); return; }
        // Archived offers cannot be attached — the server refuses them, so offering one here
        // would be offering a refusal.
        setOffers((res.data?.offers || []).filter(o => o.status !== 'archived'));
      })
      .catch(e => setErr(e?.message || 'Could not load your offers.'));
  }, [visible, value]);

  /** Noon, so a calendar day cannot slide into the day before when the server reads it in UTC. */
  const at = (iso) => (iso ? new Date(`${iso}T12:00:00`).toISOString() : null);

  function save() {
    const win = buildWindow({ startsAt: from, endsAt: until });
    if (!win.ok) { Alert.alert('Check the dates', win.error); return; }
    if (!picked) { Alert.alert('Pick an offer', 'Choose one from your library, or build a new one.'); return; }
    onSave({ ...picked, valid_from: at(from), valid_until: at(until) });
    onClose();
  }

  function clear() {
    onSave(null);
    onClose();
  }

  if (!visible) return null;

  const name = creator?.name || 'this creator';
  const short = name.split(' ')[0];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{short}’s offer</Text>
              <Text style={s.sub}>WHAT HER FOLLOWERS GET · OPTIONAL</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={19} color={ig.mut} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            <Text style={s.lead}>
              A shopper needs a reason to buy through {short} rather than walk into your shop. If
              you want to give one, this is it.
            </Text>

            <Text style={s.label}>From your library</Text>
            {offers === null && !err && <ActivityIndicator color={ig.text} style={{ paddingVertical: 18 }} />}
            {!!err && <Text style={s.err}>{err}</Text>}
            {offers?.length === 0 && (
              <Text style={s.empty}>
                Nothing in your library yet. Build one below — it will be hers alone.
              </Text>
            )}
            {(offers || []).map((o) => {
              const on = picked?.brand_offer_id === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[s.row, on && s.rowOn]}
                  activeOpacity={0.85}
                  // A library pick writes the id and clears any bespoke config, so the two
                  // shapes can never both be present.
                  onPress={() => setPicked({ brand_offer_id: o.id, name: o.name, offer_type: o.offer_type })}
                >
                  <View style={[s.cbx, on && s.cbxOn]}>{on && <Icon name="check" size={11} color={ig.bg} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowT}>{o.name}</Text>
                    <Text style={s.rowM}>
                      {String(o.offer_type || '').replace('_', ' ').toUpperCase()} · {String(o.status || '').toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={s.label}>Or make one just for {short}</Text>
            <TouchableOpacity style={s.btnSec} onPress={() => setBuilding(true)} activeOpacity={0.85}>
              <Text style={s.btnSecT}>Build a new offer</Text>
            </TouchableOpacity>
            <Text style={s.hint}>
              Saved against this campaign, this set and {short}. It does not join your library.
            </Text>

            {!!picked && !picked.brand_offer_id && (
              <View style={s.made}>
                <Text style={s.madeT}>{picked.name || 'Built for her'}</Text>
                <Text style={s.madeM}>{String(picked.offer_type || '').replace('_', ' ').toUpperCase()} · JUST FOR {short.toUpperCase()}</Text>
              </View>
            )}

            <Text style={s.label}>When it runs</Text>
            <DateField label="Starts" value={from} onChange={setFrom} placeholder="From the day she is contracted" />
            <DateField label="Ends" value={until} onChange={setUntil} placeholder="No deadline" minDate={from || undefined} />
            <Text style={s.hint}>
              Hers alone — the set’s dates cover everybody, and creators do not all start on the
              same day. Leave either blank for no limit.
            </Text>
          </ScrollView>

          <View style={{ gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={s.btnPri} onPress={save} activeOpacity={0.85}>
              <Text style={s.btnPriT}>Give {short} this offer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSec} onPress={clear} activeOpacity={0.85}>
              <Text style={s.btnSecT}>She gets no offer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* The same builder the library uses. A second one would be the fault this programme has
          already cleaned up four times. `onCreated` hands back the saved row, which is then
          attached to HER — the library keeps it too, because it was created through the library
          endpoint; what makes it hers is the attachment, not where it lives. */}
      <OfferBuilderSheet
        visible={building}
        inline
        onClose={() => setBuilding(false)}
        onCreated={(made) => {
          setBuilding(false);
          // A bespoke offer: type + config, NO brand_offer_id. The two shapes are mutually
          // exclusive on purpose — with both present nobody could say which one a shopper got.
          if (made) setPicked({ offer_type: made.offer_type, offer_config_json: made.offer_config_json, name: made.name });
        }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ig.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 26, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, marginTop: 2 },
  lead: { fontSize: 12, fontWeight: '650', color: ig.mut, lineHeight: 17, marginBottom: 4 },
  label: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  err: { fontSize: 12, fontWeight: '700', color: ig.red, paddingVertical: 10 },
  empty: { fontSize: 11.5, fontWeight: '650', color: ig.mut, lineHeight: 17, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowOn: { backgroundColor: ig.bgSoft },
  cbx: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: ig.line, alignItems: 'center', justifyContent: 'center' },
  cbxOn: { backgroundColor: ig.text, borderColor: ig.text },
  rowT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  rowM: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, marginTop: 2 },
  made: { borderWidth: 1, borderColor: ig.green, backgroundColor: ig.greenBg, borderRadius: 10, padding: 11, marginTop: 10 },
  madeT: { fontSize: 12.5, fontWeight: '800', color: ig.green },
  madeM: { fontSize: 9.5, fontWeight: '800', color: ig.green, letterSpacing: 0.4, marginTop: 2, opacity: 0.85 },
  hint: { fontSize: 11, fontWeight: '650', color: ig.mut, lineHeight: 16, marginTop: 6 },
  btnPri: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnPriT: { fontSize: 12.5, fontWeight: '800', color: ig.bg },
  btnSec: { borderWidth: 1, borderColor: ig.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnSecT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
});
