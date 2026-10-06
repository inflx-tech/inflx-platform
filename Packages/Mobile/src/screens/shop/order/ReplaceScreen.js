/**
 * Return or replace — one item of a delivered deal is not right (shopper-deal-orders · board R1–R7 ·
 * the founder's rules D2, D3, D5 of 5 Oct 2026).
 *
 *   R1  what does she want?   One item is not right  ·  Return the whole deal
 *   R2  which item, and what is wrong: the size doesn't fit · it arrived damaged · it isn't as shown
 *       ("I changed my mind" is not here: for that the whole deal goes back, or she keeps it all)
 *   R3  the size doesn't fit → another size of the same product that is in stock → Request replacement
 *   R7  …and no other size is in stock → she keeps it, or returns the whole deal
 *   R4  damaged / not as shown, and the store has one → the same item again → Request replacement
 *   R5  …and the store has no more → INFLX refunds that item's share; she keeps the rest
 *       (a buy-one-get-one pair has no one-item refund: the pair goes back together)
 *   then "Replacement requested" / "Refund requested" — INFLX decides, as it decides a return.
 *
 * Nothing is worked out here. Which sizes are in stock, whether the same item can be sent again,
 * each item's share and every amount are the server's (GET …/replace); the server also decides what
 * a request becomes, and refuses it if the stock moved while she was choosing — she is then shown
 * the choices again. "Return the whole deal" is the Return screen she already knows (R6).
 *
 * route.params: { lineId } — any item of the deal.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty } from '../../../components/shop/bitsShop';
import { K, b } from '../../../components/shop/orderBits';
import { CO } from '../../../components/shop/copyOrder';
import { CR, untilLabel } from '../../../components/shop/copyReturn';
import { CS, inr } from '../../../components/shop/copyShop';
import { fonts } from '../../../theme/tokens';

const about = (x) => [x.colour, x.size].filter(Boolean).join(' · ');

function Mini({ item, sub, big, testID }) {
  return (
    <View style={st.mini} testID={testID}>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={big ? st.thumbBig : st.thumb} /> : <View style={big ? st.thumbBig : st.thumb} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.name} numberOfLines={1}>{item.name}</Text>
        {about(item) ? <Text style={st.meta}>{about(item)}{item.qty > 1 ? ` ×${item.qty}` : ''}</Text> : null}
        {sub ? <Text style={st.meta}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export default function ReplaceScreen({ navigation, route }) {
  const { lineId } = route.params || {};
  const [pv, setPv] = useState(null);
  const [err, setErr] = useState(null);
  const [offline, setOffline] = useState(false);       // it could not be read at all (not a refusal)
  const [step, setStep] = useState('choose');          // choose · item · size · same · refund · pair
  const [itemId, setItemId] = useState(null);
  const [reason, setReason] = useState(null);
  const [pick, setPick] = useState({ colour: null, size: null });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);        // the server's sentence when a request is refused
  const [done, setDone] = useState(null);

  const read = useCallback(() => {
    setErr(null); setOffline(false);
    return followerApi.replacePreview(lineId).then((r) => {
      if (r && r.success) { setPv(r.data); return r.data; }
      const lost = !r || !r.error || r.error.code === 'NETWORK_ERROR';
      setOffline(lost);
      setErr(lost ? CS.loadError : r.error.message);
      return null;
    }).catch(() => { setOffline(true); setErr(CS.loadError); return null; });
  }, [lineId]);
  useEffect(() => { read(); }, [read]);

  const item = pv && itemId ? pv.items.find((x) => x.id === itemId) || null : null;
  const reasonLabel = pv && reason ? (pv.reasons.find((r) => r.key === reason) || {}).label : null;
  const wholeDeal = (why) => navigation.replace('ReturnItem', { lineId, ...(why ? { reason: why } : {}) });

  // R2 → where the reason and the stock lead.
  function onward() {
    setProblem(null); setPick({ colour: null, size: null });
    if (reason === 'wrong_size') setStep('size');
    else if (item.same_in_stock) setStep('same');
    else if (item.refund) setStep('refund');
    else setStep('pair');
  }
  function back() {
    setProblem(null);
    if (step === 'choose' || done) navigation.goBack();
    else if (step === 'item') setStep('choose');
    else setStep('item');
  }

  async function send(body, expect) {
    setBusy(true); setProblem(null);
    let r = null;
    try { r = await followerApi.replaceLine(itemId, { reason, ...body, expect }); } catch { r = null; }
    setBusy(false);
    if (r && r.success) { setDone(r.data); return; }
    const e = (r && r.error) || {};
    setProblem(e.message || CS.loadError);
    // The stock moved while she was choosing: the choices are read again and she picks again.
    if (e.field === 'expect' || e.code === 'STOCK_UNAVAILABLE') { await read(); setStep('item'); }
  }

  if (done) {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={done.word} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={{ padding: 20 }} testID="replace-requested">
          <Text style={st.big}>{done.word}</Text>
          {item ? <Mini item={item} sub={reasonLabel} /> : null}
          <Text style={st.hint}>{CR.lookingAtIt}</Text>
          <TouchableOpacity style={b.primary} onPress={() => navigation.navigate('Orders')} testID="replace-orders"><Text style={b.primaryText}>{CO.myOrders}</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }
  const title = step === 'choose' ? CR.returnOrReplace : CR.oneItem;
  if (!pv) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <TopBar title={title} onBack={back} />
        {err ? <Empty title={err} action={offline ? CS.retry : undefined} onAction={offline ? read : undefined} testID="replace-refused" /> : <Loading />}
      </SafeAreaView>
    );
  }

  const canAsk = pv.items.some((x) => x.can);
  const head = pv.deal ? (
    <View style={st.dealHead}>
      {pv.deal.line ? <Text style={st.name} testID="replace-deal-line">{pv.deal.line}</Text> : null}
      <Text style={st.meta} numberOfLines={1}>{CO.dealFrom(pv.deal.creator, pv.deal.brand)}</Text>
    </View>
  ) : null;
  const noteBox = (
    <>
      <Text style={st.lab}>{CR.tellUs}</Text>
      <TextInput value={note} onChangeText={setNote} placeholder={CR.writeNote} style={st.note} multiline maxLength={500} testID="replace-note" />
    </>
  );
  const problemLine = problem ? <Text style={b.problem} testID="replace-problem">{problem}</Text> : null;
  // R7 and the pair: nothing can be done for this one item — she keeps it, or the whole deal goes back.
  const keepOrReturn = (headline, why) => (
    <>
      <View style={st.banner} testID="replace-none">
        <Text style={st.bannerHead}>{headline}</Text>
        <Text style={st.bannerText}>{CR.keepOrReturn}</Text>
      </View>
      {pv.whole.can ? (
        <TouchableOpacity style={[b.secondary, { marginTop: 12 }]} onPress={() => wholeDeal(why)} testID="replace-whole-deal">
          <Text style={b.secondaryText}>{CR.wholeDeal}</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  let body = null;
  if (step === 'choose') {
    body = (
      <>
        {head}
        <TouchableOpacity style={[st.opt, !canAsk && st.optOff]} disabled={!canAsk} onPress={() => { setProblem(null); setStep('item'); }} testID="replace-one-item"
          accessibilityRole="button" accessibilityState={{ disabled: !canAsk }}>
          <View style={{ flex: 1 }}>
            <Text style={st.optHead}>{CR.oneItem}</Text>
            <Text style={st.meta}>{CR.oneItemSub}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={K.ink2} />
        </TouchableOpacity>
        <TouchableOpacity style={[st.opt, !pv.whole.can && st.optOff]} disabled={!pv.whole.can} onPress={() => wholeDeal(null)} testID="replace-whole"
          accessibilityRole="button" accessibilityState={{ disabled: !pv.whole.can }}>
          <View style={{ flex: 1 }}>
            <Text style={st.optHead}>{CR.wholeDeal}</Text>
            <Text style={st.meta}>{CR.wholeDealSub(pv.whole.count, inr(pv.whole.amount))}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={K.ink2} />
        </TouchableOpacity>
        <Text style={st.hint} testID="replace-until">{CR.openUntil(untilLabel(pv.until))}</Text>
        {problemLine}
      </>
    );
  } else if (step === 'item') {
    const ready = !!item && item.can && !!reason;
    body = (
      <>
        <Text style={st.lab}>{CR.whichItem}</Text>
        {pv.items.map((x) => (
          <TouchableOpacity key={x.id} style={[st.pickRow, itemId === x.id && st.pickOn, !x.can && st.optOff]} disabled={!x.can} onPress={() => setItemId(x.id)}
            testID={`replace-item-${x.id}`} accessibilityRole="radio" accessibilityState={{ checked: itemId === x.id, disabled: !x.can }}>
            <Icon name={itemId === x.id ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={K.ink} />
            <Mini item={x} sub={x.can ? null : x.why} />
          </TouchableOpacity>
        ))}
        <Text style={[st.lab, { marginTop: 14 }]}>{CR.whatWrong}</Text>
        {pv.reasons.map((r) => (
          <TouchableOpacity key={r.key} style={st.reason} onPress={() => setReason(r.key)} testID={`replace-reason-${r.key}`} accessibilityRole="radio" accessibilityState={{ checked: reason === r.key }}>
            <Icon name={reason === r.key ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={K.ink} />
            <Text style={st.reasonText}>{r.label}</Text>
          </TouchableOpacity>
        ))}
        {problemLine}
        <TouchableOpacity style={[b.primary, !ready && b.primaryDis]} disabled={!ready} onPress={onward} testID="replace-continue" accessibilityState={{ disabled: !ready }}>
          <Text style={b.primaryText}>{CR.next}</Text>
        </TouchableOpacity>
      </>
    );
  } else if (step === 'size') {
    const colours = item.colours || [];
    const colour = pick.colour != null ? pick.colour : (colours.find((c) => c.sizes.some((s) => s.current)) || colours[0] || {}).colour;
    const row = colours.find((c) => (c.colour || null) === (colour || null)) || colours[0] || { sizes: [] };
    const have = colours.flatMap((c) => c.sizes).find((s) => s.current);
    const gone = row.sizes.filter((s) => !s.current && !s.in_stock).map((s) => s.size);
    body = (
      <>
        <Mini item={item} sub={reasonLabel} big testID="replace-about" />
        {item.replaced ? keepOrReturn(CR.replacedOnce, 'wrong_size') : !item.other_size ? (
          <>
            {row.sizes.length ? (
              <>
                <Text style={st.lab}>{CO.size}</Text>
                <View style={b.wrap}>{row.sizes.map((s) => <View key={s.size} style={[b.size, b.sizeOut]}><Text style={[b.chipText, b.outText]}>{s.size}</Text></View>)}</View>
              </>
            ) : null}
            {keepOrReturn(CR.noOtherSize, 'wrong_size')}
          </>
        ) : (
          <>
            {colours.some((c) => c.colour) ? (
              <>
                <Text style={st.lab}>{CO.colour(colour || '')}</Text>
                <View style={b.wrap}>
                  {colours.map((c) => (
                    <TouchableOpacity key={c.colour || 'one'} onPress={() => setPick({ colour: c.colour, size: null })} style={[b.chip, (c.colour || null) === (colour || null) && b.chipOn]}
                      testID={`replace-colour-${c.colour}`} accessibilityState={{ selected: (c.colour || null) === (colour || null) }}>
                      <Text style={[b.chipText, (c.colour || null) === (colour || null) && b.chipTextOn]}>{c.colour}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={[st.lab, { marginTop: 10 }]}>{CO.size}</Text>
            <View style={b.wrap}>
              {row.sizes.map((s) => {
                const off = s.current || !s.in_stock;
                const on = pick.size === s.size && (pick.colour != null ? pick.colour : colour) === colour;
                return (
                  <TouchableOpacity key={s.size} disabled={off} onPress={() => setPick({ colour, size: s.size })} style={[b.size, on && b.chipOn, off && b.sizeOut]}
                    testID={`replace-size-${s.size}`} accessibilityState={{ selected: !!on, disabled: !!off }}>
                    <Text style={[b.chipText, on && b.chipTextOn, off && b.outText]}>{s.size}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={st.hint} testID="replace-sizes-hint">{CR.sizesHint(have && row.sizes.includes(have) ? have.size : null, gone)}</Text>
            {pick.size ? (
              <View style={st.card} testID="replace-what">
                <Text style={st.name}>{CR.replacement([item.name, pick.size].filter(Boolean).join(' · '))}</Text>
                <Text style={st.meta}>{CR.dealStays}</Text>
              </View>
            ) : null}
            <Text style={st.hint}>{CR.storeBrings(item.size)}</Text>
            {problemLine}
            <TouchableOpacity style={[b.primary, (!pick.size || busy) && b.primaryDis]} disabled={!pick.size || busy} onPress={() => send({ colour, size: pick.size }, 'replace')}
              testID="replace-request" accessibilityState={{ disabled: !pick.size || busy }}>
              <Text style={b.primaryText}>{CR.requestReplacement}</Text>
            </TouchableOpacity>
          </>
        )}
      </>
    );
  } else if (step === 'same') {
    const off = !note.trim() || busy;
    body = (
      <>
        <Mini item={item} sub={reasonLabel} big testID="replace-about" />
        <View style={st.card} testID="replace-what">
          <View style={st.rowBetween}><Text style={st.name}>{CR.sameItem}</Text><View style={st.chipOk}><Text style={st.chipOkText}>{CR.inStock}</Text></View></View>
          <Text style={st.meta}>{[item.name, about(item)].filter(Boolean).join(' · ')}</Text>
        </View>
        {noteBox}
        <Text style={st.hint}>{CR.sameHint}</Text>
        {problemLine}
        <TouchableOpacity style={[b.primary, off && b.primaryDis]} disabled={off} onPress={() => send({ note: note.trim() }, 'replace')} testID="replace-request" accessibilityState={{ disabled: !!off }}>
          <Text style={b.primaryText}>{CR.requestReplacement}</Text>
        </TouchableOpacity>
      </>
    );
  } else if (step === 'refund') {
    const off = !note.trim() || busy;
    const keep = pv.items.filter((x) => x.id !== item.id);
    body = (
      <>
        <Mini item={item} sub={reasonLabel} big testID="replace-about" />
        <View style={st.banner} testID="replace-share">
          <Text style={st.bannerHead}>{CR.noMore}</Text>
          <Text style={st.bannerText}>{CR.shareRefund(inr(item.refund.amount))}</Text>
        </View>
        <Text style={st.hint} testID="replace-refund-text">{CR.storeCollects} {item.refund.text}</Text>
        {keep.length ? <Text style={[st.lab, { marginTop: 12 }]}>{CR.youKeep}</Text> : null}
        {keep.map((x) => <Mini key={x.id} item={x} testID={`replace-keep-${x.id}`} />)}
        <View style={{ height: 6 }} />
        {noteBox}
        {problemLine}
        <TouchableOpacity style={[b.primary, off && b.primaryDis]} disabled={off} onPress={() => send({ note: note.trim() }, 'refund_item')} testID="replace-request" accessibilityState={{ disabled: !!off }}>
          <Text style={b.primaryText}>{CR.requestRefundItem}</Text>
        </TouchableOpacity>
      </>
    );
  } else {
    body = (
      <>
        <Mini item={item} sub={reasonLabel} big testID="replace-about" />
        {keepOrReturn(`${CR.noMore} ${CR.pairTogether}`, reason)}
      </>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={title} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" testID={`replace-${step}`}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

// The Cancel and Return screens' own look, so the three read as one family.
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  big: { fontFamily: fonts.sansBold, fontSize: 22, color: K.ink, textAlign: 'center', marginTop: 12, marginBottom: 14 },
  dealHead: { backgroundColor: K.surface, borderRadius: 12, padding: 10, marginBottom: 12 },
  name: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 2, lineHeight: 17 },
  lab: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink2, marginBottom: 6, marginTop: 4 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 10, lineHeight: 17 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: K.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  optOff: { opacity: 0.45 },
  optHead: { fontFamily: fonts.sansBold, fontSize: 14.5, color: K.ink },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: K.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  pickOn: { borderColor: K.ink, borderWidth: 1.5 },
  mini: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  thumb: { width: 38, height: 46, borderRadius: 7, backgroundColor: '#EDECE6' },
  thumbBig: { width: 44, height: 56, borderRadius: 8, backgroundColor: '#EDECE6' },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  reasonText: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: K.ink },
  card: { backgroundColor: K.surface, borderRadius: 12, padding: 12, marginTop: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chipOk: { backgroundColor: K.okSoft, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  chipOkText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: K.ok },
  banner: { backgroundColor: K.warnSoft, borderRadius: 12, padding: 12, marginTop: 12 },
  bannerHead: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.warn },
  bannerText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.warn, marginTop: 3, lineHeight: 18 },
  note: { borderWidth: 1.5, borderColor: K.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 72, textAlignVertical: 'top', fontFamily: fonts.sansRegular, fontSize: 14, color: K.ink },
});
