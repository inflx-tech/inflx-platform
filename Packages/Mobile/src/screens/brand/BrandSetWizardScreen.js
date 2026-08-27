import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import DateField from '../../components/DateField';
import { brandApi } from '../../services/api';
import CreatorAvatar from '../../components/CreatorAvatar';
import OfferBuilderSheet from '../../components/brand/OfferBuilderSheet';
import * as draft from '../../utils/campaignDraft';
import {
  settledLine, byExpiry, daysLeft, expiryLine, AIM_LABEL,
  allocationFromTerms, allocationLabel,
} from '../../utils/agreementSummary';

/**
 * BrandSetWizardScreen — the four steps that build one set.
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 * Board: 04-preview/mockups/stage2-screens.html panels ④ ⑤ ⑥ ⑦ ⑧
 * Ledger: #64 (aim) · #65–#71 (basics) · #72–#77 (agreements) · #78–#82 (terms)
 *
 * THE ONE IDEA THAT MAKES FOUR STEPS FIT ON A PHONE
 * The old wizard asked the brand to invent commission, dates and terms for every creator.
 * After the handshake all of that already exists — so step 4 section ① is a READ-BACK, and
 * the only genuinely open decision in the whole flow is one offer.
 *
 * WHAT IS WRITTEN, AND WHEN
 *   step 1–2  → the SET is created or updated on the server (a real draft row)
 *   step 3–4  → creators, allocations and the offer are pencilled into utils/campaignDraft
 *   publish   → the Review screen turns each pencilled creator into one invite
 *
 * That split is what makes ledger #77 true — abandon here and no agreement is consumed,
 * because none was ever briefed.
 */

const STEPS = ['The aim', 'Basics', 'Creators', 'Terms'];

const AIM_CARDS = [
  {
    goal: 'conversion', title: 'Sales', chip: 'NO MONEY UP FRONT',
    body: 'Creators earn a commission on what they sell. They drive the traffic — you are not buying posts. No budget, no end date, and a shopper offer is required.',
  },
  {
    goal: 'engagement', title: 'Content', chip: 'YOU PAY A FEE',
    body: 'You buy agreed posts for an agreed fee. Nothing is being sold. Budget and end date are both calculated for you, and there is no shopper offer.',
  },
  {
    goal: 'hybrid', title: 'Both', chip: 'FEE + COMMISSION',
    body: 'A smaller fee, plus commission on sales. You specify deliverables and set a shopper offer.',
  },
];

// Batch A — founder, 2026-08-27: Instagram and YouTube only. The server still ACCEPTS the
// other five (campaignChannels.VALID_CHANNELS), and sets created before today keep whatever
// they were given — this narrows what a brand may newly pick, not what the platform knows.
// Contract: features/stage-2-walkthrough-fixes
const CHANNELS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
];

const FORMATS = [
  { type: 'reel', label: 'Instagram Reel' },
  { type: 'story', label: 'Instagram Story' },
  { type: 'post', label: 'Instagram Post' },
  { type: 'youtube_short', label: 'YouTube Short' },
];

export default function BrandSetWizardScreen({ route, navigation }) {
  const { campaignId, campaignName, setId: initialSetId } = route.params || {};

  const [setId, setSetId] = useState(initialSetId || null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!!initialSetId);
  const [saving, setSaving] = useState(false);

  // step 1
  const [goal, setGoal] = useState(null);
  const [aimLocked, setAimLocked] = useState(false);
  // step 2
  const [name, setName] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [channels, setChannels] = useState([]);
  const [formats, setFormats] = useState(FORMATS.map(f => ({ type: f.type, count: 0 })));
  const [derivedBudget, setDerivedBudget] = useState(null);
  // step 3
  const [agreements, setAgreements] = useState([]);
  const [picked, setPicked] = useState([]);            // agreement rows, pencilled
  // step 4
  const [offers, setOffers] = useState([]);
  const [chosenOffer, setChosenOffer] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const selling = goal === 'conversion' || goal === 'hybrid';
  const buyingContent = goal === 'engagement' || goal === 'hybrid';

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [ag, of] = await Promise.all([brandApi.listAgreements(), brandApi.getOffers()]);
      if (!alive) return;
      if (ag?.success) setAgreements(ag.data?.agreements || []);
      if (of?.success) setOffers(of.data?.offers || []);

      if (initialSetId) {
        const sres = await brandApi.getCampaignSets(campaignId);
        if (!alive) return;
        const found = (sres?.data?.sets || []).find(x => String(x.id) === String(initialSetId));
        if (found) hydrate(found);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allocation is set on its own screen and written straight into the draft store, so this
  // screen has to re-read it when it comes back into focus.
  useFocusEffect(useCallback(() => {
    if (!setId) return undefined;
    const sync = () => {
      const sd = draft.getSetDraft(campaignId, setId);
      setPicked(sd.creators);
      setChosenOffer(sd.offer);
    };
    sync();
    return draft.subscribe(campaignId, sync);
  }, [campaignId, setId]));

  function hydrate(set) {
    setGoal(set.goal || null);
    setAimLocked(!!set.goal);
    setName(set.name || '');
    setWindowStart(set.window_start ? String(set.window_start).slice(0, 10) : '');
    setWindowEnd(set.window_end ? String(set.window_end).slice(0, 10) : '');
    setDerivedBudget(set.set_budget != null ? Number(set.set_budget) : null);
    const cj = set.channels_json || null;
    setChannels(Array.isArray(cj?.allowed) ? cj.allowed : []);
    setMinChannels(cj?.minimum != null ? Number(cj.minimum) : 1);
    if (Array.isArray(set.formats_json) && set.formats_json.length) {
      setFormats(FORMATS.map(f => ({
        type: f.type,
        count: Number((set.formats_json.find(x => x.type === f.type) || {}).count || 0),
      })));
    }
    const sd = draft.getSetDraft(campaignId, set.id);
    setPicked(sd.creators);
    setChosenOffer(sd.offer);
    setStep(sd.creators.length ? 3 : 2);
  }

  // ── Step 3 pick-list: filtered by aim, minus anything already used elsewhere ──
  const inUseElsewhere = useMemo(
    () => draft.agreementIdsInUse(campaignId, setId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaignId, setId, picked.length]
  );

  const matching = useMemo(() => {
    const live = byExpiry(agreements).filter(a => !inUseElsewhere.has(a.id));
    // Ledger #74 — a sales set cannot show a content agreement. The terms would not mean the
    // same thing: one settled a commission, the other a fee for named deliverables.
    //
    // Batch A — the count of what this filters out used to be shown as a chip. Founder,
    // 2026-08-27: not necessary. So the wrong-aim agreements are simply not listed, and the
    // screen no longer says how many there were.
    return live.filter((a) => {
      const aim = (a.terms_json || {}).aim || null;
      return !(goal && aim && aim !== goal);
    });
  }, [agreements, goal, inUseElsewhere]);

  const pickedIds = useMemo(() => new Set(picked.map(p => p.agreement_id)), [picked]);

  function togglePick(a) {
    const exists = pickedIds.has(a.id);
    const next = exists
      ? picked.filter(p => p.agreement_id !== a.id)
      : [...picked, {
        agreement_id: a.id,
        influencer_id: a.influencer_id,
        name: a.influencer_name || a.instagram_handle || 'Creator',
        handle: a.instagram_handle || null,
        avatar: a.profile_image_url || null,
        terms: a.terms_json || {},
        expires_at: a.expires_at || null,
        // What she said she'd promote becomes her allocation, pre-filled. When the
        // agreement never named a scope this stays null and step 4 reads "Not set yet".
        alloc: allocationFromTerms(a.terms_json || {}),
      }];
    setPicked(next);
    if (setId) draft.setSetDraft(campaignId, setId, { creators: next });
  }

  // ── Saving the set (steps 1–2) ─────────────────────────────────────────────
  async function saveSetAndContinue() {
    if (!name.trim()) { Alert.alert('Name the set', 'Creators see this name on their invite.'); return; }
    if (buyingContent && (!windowStart || !windowEnd)) {
      Alert.alert('Posting window', 'A content set needs a window — it is what the set end date is calculated from.');
      return;
    }

    const body = {
      name: name.trim(),
      goal,
      influencer_mode: 'handpick',
      window_start: windowStart || null,
      window_end: buyingContent ? (windowEnd || null) : null,
      formats_json: buyingContent ? formats.filter(f => Number(f.count) > 0) : [],
      // Guidance only — it blocks nobody you have already agreed with.
      // Batch A — `minimum` is no longer sent: the brand can no longer choose one, and
      // storing a number nobody picked would be guidance we invented. The server treats it as
      // optional (campaignChannels.validateChannels) and describeChannels renders the list
      // without it. Existing sets keep whatever they were given.
      channels_json: selling && channels.length ? { allowed: channels } : null,
      // set_budget is DELIBERATELY not sent for a paid set: the server derives it from the
      // sum of this set's agreed fees and keeps it in step with every later invite (§5.2).
    };

    setSaving(true);
    const res = setId
      ? await brandApi.updateCampaignSet(campaignId, setId, body)
      : await brandApi.createCampaignSet(campaignId, body);
    setSaving(false);

    if (!res?.success) {
      Alert.alert('Could not save the set', res?.error?.message || 'Please try again.');
      return;
    }
    const saved = res.data?.set;
    if (saved?.id && !setId) setSetId(saved.id);
    setAimLocked(true);
    setStep(2);
  }

  function finishSet() {
    if (!setId) return;
    draft.setSetDraft(campaignId, setId, { creators: picked, offer: chosenOffer });
    navigation.goBack();
  }

  if (loading) {
    return <View style={[s.container, s.center]}><ActivityIndicator color={ig.text} /></View>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity
          onPress={() => (step === 0 ? navigation.goBack() : setStep(step - 1))}
          style={s.back}
          activeOpacity={0.6}
        >
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{name || 'New set'}</Text>
          <Text style={s.sub}>STEP {step + 1} OF 4 · {STEPS[step].toUpperCase()}</Text>
        </View>
      </View>

      <View style={s.rail}>
        {STEPS.map((_, i) => (
          <View key={i} style={[s.railSeg, i < step && s.railDone, i === step && s.railOn]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
        {step === 0 && <StepAim goal={goal} locked={aimLocked} onPick={setGoal} onContinue={() => setStep(1)} />}

        {step === 1 && (
          <StepBasics
            goal={goal} selling={selling} buyingContent={buyingContent}
            name={name} setName={setName}
            windowStart={windowStart} setWindowStart={setWindowStart}
            windowEnd={windowEnd} setWindowEnd={setWindowEnd}
            channels={channels} setChannels={setChannels}
            formats={formats} setFormats={setFormats}
            derivedBudget={derivedBudget}
            saving={saving}
            onBack={() => setStep(0)}
            onContinue={saveSetAndContinue}
          />
        )}

        {step === 2 && (
          <StepCreators
            matching={matching} pickedIds={pickedIds}
            onToggle={togglePick}
            onOpen={(a) => navigation.navigate('BrandAgreementDetail', { agreement: a })}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <StepTerms
            selling={selling} buyingContent={buyingContent}
            picked={picked} offers={offers} chosenOffer={chosenOffer}
            derivedBudget={derivedBudget}
            onSetAllocation={(c) => navigation.navigate('BrandAllocation', {
              campaignId, setId, agreementId: c.agreement_id, creatorName: c.name, current: c.alloc,
            })}
            onChooseOffer={(o) => {
              const next = o ? { brand_offer_id: o.id, name: o.name, offer_type: o.offer_type } : null;
              setChosenOffer(next);
              if (setId) draft.setSetDraft(campaignId, setId, { offer: next });
            }}
            onBuildOffer={() => setBuilderOpen(true)}
            onPreview={() => navigation.navigate('BrandBasketPreview', {
              campaignId, setId,
              offer: chosenOffer,
              commissionPct: picked[0]?.terms?.money?.commission_pct ?? null,
              creatorName: picked[0]?.name || null,
            })}
            onBack={() => setStep(2)}
            onDone={finishSet}
          />
        )}
      </ScrollView>

      <OfferBuilderSheet
        visible={builderOpen}
        activateByDefault
        onClose={() => setBuilderOpen(false)}
        onCreated={(offer) => {
          setBuilderOpen(false);
          if (!offer) return;
          setOffers(prev => [offer, ...prev]);
          const next = { brand_offer_id: offer.id, name: offer.name, offer_type: offer.offer_type };
          setChosenOffer(next);
          if (setId) draft.setSetDraft(campaignId, setId, { offer: next });
        }}
      />
    </View>
  );
}

/* ── Step 1 · the aim ──────────────────────────────────────────────────────── */
function StepAim({ goal, locked, onPick, onContinue }) {
  return (
    <>
      <Text style={s.wlab}>The aim</Text>
      <Text style={s.wq}>What is this set for?</Text>

      {AIM_CARDS.map((c) => {
        const on = goal === c.goal;
        const disabled = locked && !on;
        return (
          <TouchableOpacity
            key={c.goal}
            style={[s.opt, on && s.optOn, disabled && s.optOff]}
            activeOpacity={disabled ? 1 : 0.8}
            onPress={() => !disabled && onPick(c.goal)}
          >
            <View style={s.optHd}>
              <Text style={s.optT}>{c.title}</Text>
              <View style={[s.optChip, on && s.optChipOn]}>
                <Text style={[s.optChipT, on && s.optChipTOn]}>{c.chip}</Text>
              </View>
            </View>
            <Text style={s.optD}>{c.body}</Text>
          </TouchableOpacity>
        );
      })}

      <View style={s.sec}>
        <View style={s.noteN}>
          <Text style={s.noteT}>
            {locked
              ? 'The aim is fixed once the set is saved — the agreements you brief into it were made against it.'
              : 'You cannot change the aim after creators are added — their agreements were made against it.'}
          </Text>
        </View>
      </View>

      <View style={s.sec}>
        <TouchableOpacity style={[s.btn, s.btnPri, !goal && s.btnOff]} disabled={!goal} onPress={onContinue} activeOpacity={0.85}>
          <Text style={s.btnPriT}>Continue</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ── Step 2 · basics ───────────────────────────────────────────────────────── */
function StepBasics(p) {
  const {
    goal, selling, buyingContent, name, setName, windowStart, setWindowStart,
    windowEnd, setWindowEnd, channels, setChannels,
    formats, setFormats, derivedBudget, saving, onBack, onContinue,
  } = p;

  const toggleChannel = (k) =>
    setChannels(channels.includes(k) ? channels.filter(c => c !== k) : [...channels, k]);

  const bump = (type, by) =>
    setFormats(formats.map(f => (f.type === type ? { ...f, count: Math.max(0, Number(f.count) + by) } : f)));

  return (
    <>
      <View style={s.sec2}>
        <Text style={s.dh}>Name and dates</Text>
        <Text style={s.label}>Set name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Sarees" placeholderTextColor={ig.mut2} />

        {/* Batch A — calendars, not text boxes. `YYYY-MM-DD` typed on a phone is four ways
            to fail: wrong format, wrong month, a date already past, or a typo nobody catches
            until a deadline is missed. DateField is pure JS deliberately — an over-the-air
            bundle cannot add a native module, and its value is the same string as before.

            The greyed "Ends · Never" is gone on a SALES set. It was there to teach a brand
            coming from the old wizard where the field went; that wizard is retired and the
            lesson is no longer worth a row on the screen.

            A CONTENT set keeps both halves — its window is real, not derived. */}
        {buyingContent ? (
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 9 }}>
            <View style={{ flex: 1 }}>
              <DateField label="Posting window from" value={windowStart} onChange={setWindowStart} placeholder="Choose a date" />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="To" value={windowEnd} onChange={setWindowEnd} placeholder="Choose a date" minDate={windowStart || undefined} />
            </View>
          </View>
        ) : (
          <DateField label="Starts" value={windowStart} onChange={setWindowStart} placeholder="Choose a start date" style={{ marginTop: 9 }} />
        )}

        {buyingContent && (
          <Text style={s.help}>
            The set ends when the last agreed post is due — <Text style={s.helpB}>calculated, not typed.</Text>
          </Text>
        )}
      </View>

      {/* Batch A — Budget is gone from a SALES set: it always read "None", because
          commission comes out of a sale that already happened and nothing is held.

          It STAYS on a content set, where it is the figure the wallet must cover before the
          campaign can publish. Removing it there would not crash — the campaign would simply
          refuse to go live weeks later, which is worse. */}
      {buyingContent && (
        <View style={s.sec2}>
          <Text style={s.dh}>Budget</Text>
          <View style={[s.input, s.inputCalc]}>
            <Text style={s.calcT}>
              {derivedBudget != null ? `₹${derivedBudget.toLocaleString('en-IN')} · calculated` : 'Calculated at step 3'}
            </Text>
          </View>
          <Text style={s.help}>
            Adds up from what you agreed with each creator at step 3. Your wallet must cover it
            before you can publish.
          </Text>
        </View>
      )}

      {buyingContent && (
        <View style={s.sec2}>
          <Text style={s.dh}>What you are buying</Text>
          {FORMATS.map((f) => {
            const row = formats.find(x => x.type === f.type) || { count: 0 };
            return (
              <View key={f.type} style={s.stepRow}>
                <Text style={s.stepRowK}>{f.label}</Text>
                <View style={s.stepper}>
                  <TouchableOpacity style={s.stepBtn} onPress={() => bump(f.type, -1)} activeOpacity={0.7}>
                    <Icon name="minus" size={14} color={ig.text} />
                  </TouchableOpacity>
                  <Text style={[s.stepN, Number(row.count) === 0 && { color: ig.mut2 }]}>{row.count}</Text>
                  <TouchableOpacity style={s.stepBtn} onPress={() => bump(f.type, 1)} activeOpacity={0.7}>
                    <Icon name="plus" size={14} color={ig.text} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {selling && (
        <View style={s.sec2}>
          <Text style={s.dh}>How they will drive traffic</Text>
          <View style={[s.chips, { marginTop: 6 }]}>
            {CHANNELS.map(c => (
              <TouchableOpacity key={c.key} style={[s.chip, channels.includes(c.key) && s.chipOn]} onPress={() => toggleChannel(c.key)} activeOpacity={0.8}>
                <Text style={[s.chipT, channels.includes(c.key) && s.chipTOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}


      <View style={[s.sec, { flexDirection: 'row', gap: 8 }]}>
        <TouchableOpacity style={[s.btn, s.btnSec, { flex: 1 }]} onPress={onBack} activeOpacity={0.85}>
          <Text style={s.btnSecT}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnPri, { flex: 1 }]} disabled={saving} onPress={onContinue} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={ig.bg} /> : <Text style={s.btnPriT}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ── Step 3 · the agreements pick-list ─────────────────────────────────────── */
function StepCreators({ matching, pickedIds, onToggle, onOpen, onBack, onContinue }) {
  return (
    <>
      <View style={s.sec2}>
        <Text style={s.dh}>Who is in this set?</Text>
        <Text style={s.lead}>
          <Text style={s.leadB}>These people already agreed terms with you.</Text> Tick who belongs in this set.
        </Text>
        <View style={[s.chips, { marginTop: 10 }]}>
          <View style={[s.chip, s.chipOn]}>
            <Text style={[s.chipT, s.chipTOn]}>Matching agreements · {matching.length}</Text>
          </View>
        </View>
      </View>

      {matching.map((a) => {
        const on = pickedIds.has(a.id);
        const d = daysLeft(a.expires_at);
        const soon = d != null && d <= 14;
        return (
          <View key={a.id} style={s.pickRow}>
            <TouchableOpacity onPress={() => onToggle(a)} activeOpacity={0.7} style={[s.cbx, on && s.cbxOn]}>
              {on && <Icon name="check" size={12} color={ig.bg} />}
            </TouchableOpacity>
            <TouchableOpacity style={s.pickMain} activeOpacity={0.7} onPress={() => onToggle(a)}>
              <CreatorAvatar name={a.influencer_name || a.instagram_handle} avatarUrl={a.profile_image_url} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={s.pickName}>{a.influencer_name || a.instagram_handle || 'Creator'}</Text>
                <Text style={s.pickTerms} numberOfLines={2}>{settledLine(a.terms_json)}</Text>
                <Text style={[s.pickExp, { color: soon ? ig.red : ig.green }]}>
                  {a.created_at ? `AGREED ${fmtShort(a.created_at)} · ` : ''}{expiryLine(a.expires_at)}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onOpen(a)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="chevron-right" size={20} color={ig.mut2} />
            </TouchableOpacity>
          </View>
        );
      })}

      {matching.length === 0 && (
        <View style={s.empty}>
          <Icon name="handshake-outline" size={28} color={ig.mut2} />
          <Text style={s.emptyT}>No agreements match this aim</Text>
          <Text style={s.emptyS}>
            An agreement settled for a different aim would not mean the same thing here. Agree terms
            for this aim first, and brief afterwards.
          </Text>
        </View>
      )}

      <View style={s.sec}>
        <View style={s.lock}>
          <Icon name="lock-outline" size={15} color={ig.mut} />
          <Text style={s.lockT}>
            <Text style={s.lockB}>You cannot add someone who has not agreed.</Text> Agree first, brief after.
          </Text>
        </View>
      </View>

      <View style={[s.sec, { flexDirection: 'row', gap: 8 }]}>
        <TouchableOpacity style={[s.btn, s.btnSec, { flex: 1 }]} onPress={onBack} activeOpacity={0.85}>
          <Text style={s.btnSecT}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.btnPri, { flex: 1 }, pickedIds.size === 0 && s.btnOff]}
          disabled={pickedIds.size === 0}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          <Text style={s.btnPriT}>Continue · {pickedIds.size} picked</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ── Step 4 · terms ────────────────────────────────────────────────────────── */
function StepTerms(p) {
  const {
    selling, buyingContent, picked, offers, chosenOffer, derivedBudget,
    onSetAllocation, onChooseOffer, onBuildOffer, onPreview, onBack, onDone,
  } = p;

  const everyoneAllocated = !selling || picked.every(c => c.alloc?.alloc_scope);
  // Batch A — the offer clause is gone. Founder, 2026-08-27: "dont make this mandatory".
  // Nothing underneath ever required it: campaign_sets has no offer columns at all, and the
  // offer lives on campaign_influencers, per creator, nullable. The wizard invented the rule.
  // Allocation stays compulsory — a different rule, and a real one: a contracted creator with
  // no allocation is contracted and invisible in the shopping app.
  const canFinish = picked.length > 0 && everyoneAllocated;

  return (
    <>
      <View style={s.sec2}>
        <Text style={s.dh}>① What each creator gets · already agreed</Text>
        {picked.map((c) => {
          const t = c.terms || {};
          return (
            <View key={c.agreement_id} style={s.card}>
              <View style={s.cardHd}>
                <Text style={s.cardT} numberOfLines={1}>{c.name}</Text>
                <Text style={s.cardMoney}>
                  {t.money?.commission_pct != null ? `${t.money.commission_pct}%` : ''}
                  {t.money?.fee != null ? `₹${Number(t.money.fee).toLocaleString('en-IN')}` : ''}
                </Text>
              </View>
              <View style={s.cardBd}>
                <KV k="Post by" v={t.time?.post_by ? fmtShort(t.time.post_by) : (t.time?.window_end ? fmtShort(t.time.window_end) : '—')} />
                <KV k="What was settled" v={settledLine(t) || '—'} />
                {selling && (
                  <>
                    <KV
                      k="She can sell"
                      v={allocationLabel(c.alloc)}
                      danger={!c.alloc?.alloc_scope}
                    />
                    <TouchableOpacity
                      style={[s.mini, c.alloc?.alloc_scope ? s.miniSec : s.miniPri]}
                      onPress={() => onSetAllocation(c)}
                      activeOpacity={0.85}
                    >
                      <Text style={c.alloc?.alloc_scope ? s.miniSecT : s.miniPriT}>
                        {c.alloc?.alloc_scope ? 'Change what she can sell' : 'Set what she can sell'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        <View style={[s.noteY, { marginTop: 4 }]}>
          <Text style={s.noteYT}>
            Editing an agreed term is allowed but <Text style={s.noteYB}>never silent</Text>. Change a
            creator&apos;s commission and she is told which term moved, by name, when the invite arrives.
          </Text>
        </View>
      </View>

      {selling ? (
        <View style={s.sec2}>
          <Text style={s.dh}>② What their followers get · your decision</Text>
          <Text style={s.lead}>
            A shopper needs a reason to buy through her rather than walk into your shop.{' '}
            <Text style={s.leadB}>That reason is this offer.</Text>
          </Text>

          {offers.length === 0 && (
            <Text style={[s.help, { marginTop: 10 }]}>
              You have no saved offers yet. Build one — it goes live straight away and can be reused
              in any later campaign.
            </Text>
          )}

          {offers.map((o) => {
            const on = chosenOffer?.brand_offer_id === o.id;
            const expired = o.status === 'archived';
            return (
              <TouchableOpacity
                key={o.id}
                style={[s.offer, on && s.offerOn, expired && s.offerDim]}
                activeOpacity={0.8}
                onPress={() => onChooseOffer(on ? null : o)}
              >
                <View style={s.offerHd}>
                  <Text style={s.offerT} numberOfLines={1}>{o.name}</Text>
                  {on && <Text style={s.offerPick}>SELECTED</Text>}
                </View>
                <Text style={s.offerS}>
                  {String(o.offer_type || 'discount').toUpperCase()}
                  {o.status ? ` · ${String(o.status).toUpperCase()}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={[s.btn, s.btnSec, { marginTop: 10 }]} onPress={onBuildOffer} activeOpacity={0.85}>
            <Text style={s.btnSecT}>Make a new one</Text>
          </TouchableOpacity>

          {!!chosenOffer && (
            <TouchableOpacity style={[s.btn, s.btnSec, { marginTop: 8 }]} onPress={onPreview} activeOpacity={0.85}>
              <Text style={s.btnSecT}>See what a shopper pays</Text>
            </TouchableOpacity>
          )}

          <View style={[s.noteN, { marginTop: 12 }]}>
            <Text style={s.noteT}>
              <Text style={s.noteB}>Only one offer applies per basket</Text> — the best one for that
              shopper. Never stacked. A creator&apos;s own offer wins a tie.
            </Text>
          </View>
        </View>
      ) : (
        <View style={s.sec2}>
          <Text style={s.dh}>② What their followers get</Text>
          <View style={s.lock}>
            <Icon name="lock-outline" size={15} color={ig.mut} />
            <Text style={s.lockT}>
              <Text style={s.lockB}>Not applicable on a content set.</Text> You are buying posts, not
              selling through her — there is no basket for an offer to apply to.
            </Text>
          </View>
        </View>
      )}

      {buyingContent && (
        <View style={s.sec2}>
          <Text style={s.dh}>Payment</Text>
          {derivedBudget != null && derivedBudget > 0 ? (
            <>
              <KV k="On both signing" v={`₹${Math.round(derivedBudget * 0.25).toLocaleString('en-IN')}`} />
              <KV k="When you confirm live" v={`₹${Math.round(derivedBudget * 0.25).toLocaleString('en-IN')}`} />
              <KV k="30 days after" v={`₹${Math.round(derivedBudget * 0.5).toLocaleString('en-IN')}`} />
              <Text style={s.help}>
                Your wallet must hold ₹{derivedBudget.toLocaleString('en-IN')} plus the platform fee before you can publish.
              </Text>
            </>
          ) : (
            <Text style={s.help}>
              The stages appear once the fees are in — they are a quarter on signing, a quarter when
              you confirm the post is live, and the rest thirty days later.
            </Text>
          )}
        </View>
      )}

      <View style={[s.sec, { flexDirection: 'row', gap: 8 }]}>
        <TouchableOpacity style={[s.btn, s.btnSec, { flex: 1 }]} onPress={onBack} activeOpacity={0.85}>
          <Text style={s.btnSecT}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.btnPri, { flex: 1 }, !canFinish && s.btnOff]}
          disabled={!canFinish}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={s.btnPriT}>Save this set</Text>
        </TouchableOpacity>
      </View>

      {!canFinish && (
        <View style={s.sec}>
          <Text style={s.blockT}>
            {picked.length === 0 ? 'Pick at least one creator at step 3.'
              : 'Every creator on a sales set must have something to sell.'}
          </Text>
        </View>
      )}
    </>
  );
}

function KV({ k, v, danger }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, danger && { color: ig.red }]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const fmtShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 9 },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  rail: { flexDirection: 'row', gap: 5, paddingHorizontal: 14, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  railSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: ig.lineSoft },
  railOn: { backgroundColor: ig.text },
  railDone: { backgroundColor: ig.green },

  wlab: { paddingHorizontal: 14, paddingTop: 12, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase' },
  wq: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 11, fontSize: 17, fontWeight: '800', color: ig.text, lineHeight: 23 },

  opt: { marginHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: ig.line, borderRadius: 12, padding: 12 },
  optOn: { borderColor: ig.text, borderWidth: 1.5, backgroundColor: ig.bgSoft },
  optOff: { opacity: 0.4 },
  optHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optT: { fontSize: 13.5, fontWeight: '800', color: ig.text },
  optChip: { backgroundColor: ig.lineSoft, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  optChipOn: { backgroundColor: ig.text },
  optChipT: { fontSize: 9, fontWeight: '800', color: ig.mut },
  optChipTOn: { color: ig.bg },
  optD: { fontSize: 11, color: ig.mut, fontWeight: '650', marginTop: 4, lineHeight: 16 },

  sec: { paddingHorizontal: 14, paddingVertical: 11 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  dh: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 9 },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, color: ig.mut, textTransform: 'uppercase', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12.5, fontWeight: '700', color: ig.text },
  inputCalc: { backgroundColor: ig.bgSoft, borderStyle: 'dashed', justifyContent: 'center' },
  calcT: { fontSize: 12.5, fontWeight: '700', color: ig.mut },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 8, lineHeight: 15 },
  helpB: { color: ig.text, fontWeight: '800' },
  lead: { fontSize: 11.5, color: ig.text2, fontWeight: '650', lineHeight: 17 },
  leadB: { fontWeight: '800', color: ig.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipOn: { backgroundColor: ig.text, borderColor: ig.text },
  chipGhost: { borderStyle: 'dashed', backgroundColor: ig.bgSoft },
  chipDim: { opacity: 0.4 },
  chipT: { fontSize: 11, fontWeight: '700', color: ig.text2 },
  chipTOn: { color: ig.bg },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  stepRowK: { fontSize: 12, fontWeight: '700', color: ig.text2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: ig.line, alignItems: 'center', justifyContent: 'center' },
  stepN: { minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: '800', color: ig.text },

  lock: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: ig.bgSoft, borderWidth: 1, borderStyle: 'dashed', borderColor: ig.line, borderRadius: 11, padding: 12 },
  lockT: { flex: 1, fontSize: 11, color: ig.mut, fontWeight: '700', lineHeight: 16 },
  lockB: { color: ig.text, fontWeight: '800' },

  noteN: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 12 },
  noteT: { fontSize: 11.5, color: ig.mut, fontWeight: '700', lineHeight: 17 },
  noteB: { color: ig.text, fontWeight: '800' },
  noteY: { backgroundColor: ig.yBg, borderRadius: 11, padding: 12 },
  noteYT: { fontSize: 11.5, color: ig.yInk, fontWeight: '700', lineHeight: 17 },
  noteYB: { fontWeight: '800' },

  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  pickMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cbx: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: ig.line, alignItems: 'center', justifyContent: 'center' },
  cbxOn: { backgroundColor: ig.text, borderColor: ig.text },
  pickName: { fontSize: 13, fontWeight: '800', color: ig.text },
  pickTerms: { fontSize: 10.5, color: ig.text2, fontWeight: '650', marginTop: 2, lineHeight: 15 },
  pickExp: { fontSize: 9.5, fontWeight: '800', marginTop: 4, letterSpacing: 0.2 },

  card: { borderWidth: 1, borderColor: ig.line, borderRadius: 12, overflow: 'hidden', marginBottom: 9 },
  cardHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: ig.bgSoft, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  cardT: { flex: 1, fontSize: 12.5, fontWeight: '800', color: ig.text },
  cardMoney: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  cardBd: { paddingHorizontal: 12, paddingVertical: 8 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { fontSize: 11.5, color: ig.mut, fontWeight: '650' },
  rowV: { flex: 1, fontSize: 11.5, fontWeight: '800', color: ig.text, textAlign: 'right' },

  mini: { borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 9 },
  miniSec: { borderWidth: 1, borderColor: ig.line },
  miniSecT: { fontSize: 11.5, fontWeight: '800', color: ig.text },
  miniPri: { backgroundColor: ig.text },
  miniPriT: { fontSize: 11.5, fontWeight: '800', color: ig.bg },

  offer: { borderWidth: 1, borderColor: ig.line, borderRadius: 11, padding: 11, marginTop: 8 },
  offerOn: { borderColor: ig.text, borderWidth: 1.5, backgroundColor: ig.bgSoft },
  offerDim: { opacity: 0.5 },
  offerHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  offerT: { flex: 1, fontSize: 12.5, fontWeight: '800', color: ig.text },
  offerPick: { fontSize: 9, fontWeight: '800', color: ig.green, letterSpacing: 0.3 },
  offerS: { fontSize: 10, fontWeight: '700', color: ig.mut, marginTop: 3, letterSpacing: 0.2 },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnSecT: { fontSize: 13, fontWeight: '800', color: ig.text },
  btnOff: { backgroundColor: ig.lineSoft },
  blockT: { fontSize: 11, color: ig.red, fontWeight: '700', textAlign: 'center', lineHeight: 16 },

  empty: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 26, gap: 6 },
  emptyT: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 4 },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 17 },
});
