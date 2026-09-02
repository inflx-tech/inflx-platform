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
import CreatorOfferSheet from '../../components/brand/CreatorOfferSheet';
import * as draft from '../../utils/campaignDraft';
import {
  settledLine, byExpiry, daysLeft, expiryLine, AIM_LABEL,
  allocationFromTerms, allocationLabel, offerLine,
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

import * as setShape from '../../utils/setShape';

const STEPS = ['The aim', 'Basics', 'Creators', 'Terms'];

const AIM_CARDS = [
  {
    goal: 'conversion', title: 'Sales', chip: 'NO MONEY UP FRONT',
    // Batch A — this said "a shopper offer is required". It is not, and after Batch A the
    // wizard will happily save without one, so the card was contradicting the button.
    body: 'Creators earn a commission on what they sell. They drive the traffic — you are not buying posts. No budget and no end date. A shopper offer is optional.',
  },
  {
    goal: 'engagement', title: 'Content', chip: 'YOU PAY A FEE',
    body: 'You buy agreed posts for an agreed fee. Nothing is being sold. Budget and end date are both calculated for you, and there is no shopper offer.',
  },
  {
    goal: 'hybrid', title: 'Both', chip: 'FEE + COMMISSION',
    // Batch A — used to end "...and set a shopper offer", which read as a requirement. It is
    // not one any more, on any set type. A card that promises a step the wizard no longer
    // asks for is a small lie that costs trust the first time a brand notices.
    body: 'A smaller fee, plus commission on sales. You specify the deliverables, and she sells too.',
  },
];

// stage-a — CHANNELS and FORMATS moved to CreatorTermsScreen.js (SB-30): both are now asked
// per creator, not once for the set. See that file for the Batch A note on why it is
// Instagram and YouTube only.

export default function BrandSetWizardScreen({ route, navigation }) {
  // stage-a — "Build a set from these" (SB-24) hands over WHO by id, not by value, so
  // this screen reads the deferred pool fresh rather than trusting a snapshot that could
  // be stale by the time a brand actually opens the wizard.
  const { campaignId, campaignName, setId: initialSetId, seedDeferredIds } = route.params || {};

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
  // stage-a — a set is one aim, one go-live day, one way of shooting. The window above is
  // kept only so an older draft being edited does not lose what it already had.
  const [goLiveDate, setGoLiveDate] = useState('');
  const [shootMode, setShootMode] = useState(null);
  const [invitesClose, setInvitesClose] = useState('');
  const [derivedBudget, setDerivedBudget] = useState(null);
  // step 3
  const [agreements, setAgreements] = useState([]);
  // Whether the live ready-to-brief list has actually arrived. The auto-drop below MUST NOT
  // run against an empty list that has simply not loaded yet — that would clear every creator
  // the brand had picked, on every entry, and look exactly like the app losing their work.
  const [agreementsLoaded, setAgreementsLoaded] = useState(false);
  const [picked, setPicked] = useState([]);            // agreement rows, pencilled
  // step 4
  // stage-2-offers-parity — whose offer sheet is open. The offer belongs to a creator now:
  // campaign_influencers has always stored it, and campaign_sets has no offer columns at all.
  const [offerFor, setOfferFor] = useState(null);

  const selling = goal === 'conversion' || goal === 'hybrid';
  const buyingContent = goal === 'engagement' || goal === 'hybrid';

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      // The offers list is no longer fetched here: CreatorOfferSheet loads it when it opens,
      // which is the only place an offer is now chosen. Fetching it on every wizard entry was
      // a request nobody read.
      const ag = await brandApi.listAgreements();
      if (!alive) return;
      if (ag?.success) { setAgreements(ag.data?.agreements || []); setAgreementsLoaded(true); }

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
    };
    sync();
    return draft.subscribe(campaignId, sync);
  }, [campaignId, setId]));

  // ── A lapsed agreement leaves the set on its own ───────────────────────────
  //
  // Founder, 2026-08-28: "if that is expired means auto deleted... even he adds set and came
  // after somedays if that is expired means auto deleted."
  //
  // He is right, and it is better than what was here. An agreement that has lapsed CANNOT be
  // briefed — the server refuses it, and there is no judgement for a brand to make. Refusing
  // to publish and making them work out which creator to remove was the app handing over its
  // own homework.
  //
  // Agreements run 90 days (handshake_settings.agreement_expiry_days), so this is rare. When
  // it does happen it is on a set left open a long time, which is exactly when a brand has
  // least idea what changed underneath them.
  //
  // NEVER SILENTLY. A creator who simply vanishes reads as a mis-tap, or worse goes unnoticed
  // until the campaign is live without her.
  useEffect(() => {
    if (!setId || !agreementsLoaded) return;
    const live = new Set(agreements.map(a => String(a.id)));
    const sd = draft.getSetDraft(campaignId, setId);
    const gone = sd.creators.filter(c => !live.has(String(c.agreement_id)));
    if (!gone.length) return;

    const kept = sd.creators.filter(c => live.has(String(c.agreement_id)));
    draft.setSetDraft(campaignId, setId, { creators: kept });
    setPicked(kept);

    const names = gone.map(c => c.name).filter(Boolean);
    Alert.alert(
      names.length === 1 ? `${names[0]} was taken out` : `${names.length} creators were taken out`,
      `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} no longer available to brief — the ` +
      `agreement has lapsed, or has been used in another set. Agree with ${names.length === 1 ? 'her' : 'them'} ` +
      'again from the Creators tab to include ' + (names.length === 1 ? 'her.' : 'them.'),
    );
  }, [agreementsLoaded, agreements, campaignId, setId]);

  function hydrate(set) {
    setGoal(set.goal || null);
    setAimLocked(!!set.goal);
    setName(set.name || '');
    setWindowStart(set.window_start ? String(set.window_start).slice(0, 10) : '');
    setWindowEnd(set.window_end ? String(set.window_end).slice(0, 10) : '');
    // stage-a — a set created before set-first has none of these. Leaving them blank is
    // correct: goLiveDayOf() still reads its old window, and the brand is asked for the
    // launch day the first time they edit it. Nothing is invented on their behalf.
    setGoLiveDate(setShape.dayOf(set.go_live_date) || '');
    setShootMode(set.shoot_mode || null);
    setInvitesClose(setShape.dayOf(set.invites_close_at) || '');
    setDerivedBudget(set.set_budget != null ? Number(set.set_budget) : null);
    // stage-a — channels_json/formats_json used to hydrate here from the set. They now
    // live per creator (SB-30); a set built before today keeps whatever it was given, and
    // the server still resolves it as every creator's fallback. Removing this also removes
    // a dead setter call for a "minimum channels" state variable that was never declared
    // with useState — so opening an existing set to edit it threw a ReferenceError every
    // time. batchAWizardTrim.test.js has asserted that variable gone since Batch A and was
    // failing until now.
    const sd = draft.getSetDraft(campaignId, set.id);
    setPicked(sd.creators);
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

    // stage-a — this used to demand a posting window on a content set. The wizard no longer
    // writes one, so the guard would have blocked every NEW content set from saving while
    // still letting an edited old one through, because hydrate() fills the window from the
    // stored row. It now asks for what the set actually needs, for every aim, from the same
    // rule the server uses.
    const shape = setShape.validateSetShape({
      go_live_date: goLiveDate || null,
      shoot_mode: shootMode || null,
      invites_close_at: invitesClose || null,
    });
    if (!shape.ok) { Alert.alert('Check the dates', shape.error); return; }
    if (!setShape.basicsReady({ name, go_live_date: goLiveDate, shoot_mode: shootMode })) {
      Alert.alert(
        'A set needs all three',
        'A name, the day everyone goes live, and how they shoot. Everything else is per creator.'
      );
      return;
    }

    const body = {
      name: name.trim(),
      goal,
      influencer_mode: 'handpick',
      // stage-a — ONE go-live day, not a window. Every creator in this set posts on it.
      // The old window is no longer written by the wizard; existing sets keep theirs, and
      // goLiveDayOf() falls back to it for anything created before set-first.
      go_live_date: goLiveDate || null,
      shoot_mode: shootMode || null,
      invites_close_at: invitesClose || null,
      // stage-a — channels_json/formats_json are no longer sent here. Founder, 2026-09-01:
      // both moved down to per creator (SB-30) — every creator's posts and channels are her
      // own, not a set default. A set built before today keeps whatever it was given, and the
      // server still honours it as a fallback for a creator with no override of her own.
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
    // stage-a — the moment this set is genuinely new (never had a setId before), seed it
    // from the deferred pool if that's why the brand is here. Written to the draft store
    // directly, synchronously, before setSetId — the wizard's own focus-resync (keyed on
    // setId) picks up what is already there rather than racing it.
    if (saved?.id && !setId) {
      if (Array.isArray(seedDeferredIds) && seedDeferredIds.length) {
        const dres = await brandApi.getDeferredCreators(campaignId);
        if (dres?.success) {
          const wanted = new Set(seedDeferredIds);
          const rows = (dres.data?.deferred || []).filter((d) => wanted.has(d.id));
          draft.seedFromDeferred(campaignId, saved.id, rows);
        }
      }
      setSetId(saved.id);
    }
    setAimLocked(true);
    setStep(2);
  }

  function finishSet() {
    if (!setId) return;
    // No set-level offer any more — it is written per creator, on `picked`. Older drafts may
    // still carry one and invitePayload still honours it, so the field is not purged.
    draft.setSetDraft(campaignId, setId, { creators: picked });
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
            buyingContent={buyingContent}
            name={name} setName={setName}
            goLiveDate={goLiveDate} setGoLiveDate={setGoLiveDate}
            shootMode={shootMode} setShootMode={setShootMode}
            invitesClose={invitesClose} setInvitesClose={setInvitesClose}
            derivedBudget={derivedBudget}
            saving={saving}
            onBack={() => setStep(0)}
            onContinue={saveSetAndContinue}
          />
        )}

        {step === 2 && (
          <StepCreators
            matching={matching} pickedIds={pickedIds} picked={picked}
            onToggle={togglePick}
            onOpen={(a) => navigation.navigate('BrandAgreementDetail', { agreement: a })}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <StepTerms
            selling={selling} buyingContent={buyingContent}
            picked={picked}
            derivedBudget={derivedBudget}
            onGiveOffer={setOfferFor}
            onSetAllocation={(c) => navigation.navigate('BrandAllocation', {
              campaignId, setId, agreementId: c.agreement_id, creatorName: c.name, current: c.alloc,
            })}
            onSetTerms={(c) => navigation.navigate('CreatorTerms', {
              campaignId, setId, agreementId: c.agreement_id, creatorName: c.name,
              selling, buyingContent, current: c,
            })}
            onBack={() => setStep(2)}
            onDone={finishSet}
          />
        )}
      </ScrollView>

      {/* stage-2-offers-parity — HER offer. Two routes in, exactly as the founder described:
          pick one from the library, or build one for her alone. Optional either way. */}
      <CreatorOfferSheet
        visible={!!offerFor}
        creator={offerFor}
        value={offerFor?.offer || null}
        onClose={() => setOfferFor(null)}
        onPreview={(creator, offer) => navigation.navigate('BrandBasketPreview', {
          campaignId,
          setId,
          offer,
          commissionPct: creator?.terms?.money?.commission_pct ?? null,
          creatorName: creator?.name || null,
        })}
        onSave={(next) => {
          // stage-a — written straight to the shared draft, same as allocation, not only to
          // local state. CreatorTermsScreen (SB-30) reads and writes this same store from a
          // separate route; if this stayed local-only, opening it right after choosing an
          // offer would resync `picked` from the store and silently drop the offer nobody
          // had persisted yet. The focus subscription below picks the change straight back up.
          draft.setCreatorOffer(campaignId, setId, offerFor?.agreement_id, next);
          setOfferFor(null);
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
    buyingContent, name, setName,
    goLiveDate, setGoLiveDate, shootMode, setShootMode, invitesClose, setInvitesClose,
    derivedBudget, saving, onBack, onContinue,
  } = p;

  // The picker greys out anything sooner than the server would accept, so the brand can
  // never choose a day and then be refused. Both numbers come from one place.
  const earliest = setShape.earliestGoLiveDay();
  const ready = setShape.basicsReady({ name, go_live_date: goLiveDate, shoot_mode: shootMode });

  // Choosing a launch day proposes a sensible close for invitations — three days before,
  // never in the past. The brand can change it; they should not have to think about it.
  const pickGoLive = (d) => {
    setGoLiveDate(d);
    if (!invitesClose || invitesClose > d) setInvitesClose(setShape.suggestedInvitesClose(d) || '');
  };

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
        {/* stage-a — ONE day, for every aim. The founder, 2026-08-29:
              "post by date is one where all social posts of creators in that set go live on
               that date.....so all commission,content and both go live in that date"
            It is not a deadline she can beat and not one she can miss. A window cannot say
            that, which is why the two date boxes became one. Shop posts on INFLX still have
            no deadline of their own — they only have to be APPROVED by this day. */}
        <DateField
          label="Everyone goes live on"
          value={goLiveDate}
          onChange={pickGoLive}
          placeholder="Choose the launch day"
          minDate={earliest}
          style={{ marginTop: 9 }}
        />
        <Text style={s.hint}>
          Every creator in this set posts on social media that day. Shop posts on INFLX can go
          up any time before it.
        </Text>

        {/* Two options, not three. The column accepts a third — 'remote', meaning nothing is
            sent at all — but offering it here would let a brand pick a path where her address
            screen never appears and no parcel is ever tracked. setShape.SHOOT_MODES_OFFERED
            is the one list, mirrored from the server. */}
        <Text style={[s.label, { marginTop: 14 }]}>How they shoot</Text>
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 6 }}>
          {setShape.SHOOT_MODES_OFFERED.map((m) => {
            const on = shootMode === m;
            const copy = setShape.SHOOT_MODE_COPY[m];
            return (
              <TouchableOpacity
                key={m}
                style={[s.modeCard, on && s.modeCardOn]}
                onPress={() => setShootMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.modeTitle, on && s.modeTitleOn]}>{copy.title}</Text>
                <Text style={[s.modeSub, on && s.modeSubOn]}>{copy.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {shootMode === 'visit' && (
          <Text style={s.hint}>A store visit is marked done by both of you.</Text>
        )}
        {shootMode === 'shipment' && (
          <Text style={s.hint}>She sends her address, you ship, and she marks it done.</Text>
        )}

        <DateField
          label="Invitations close"
          value={invitesClose}
          onChange={setInvitesClose}
          placeholder="Choose a date"
          minDate={setShape.today()}
          maxDate={goLiveDate || undefined}
          style={{ marginTop: 14 }}
        />
        <Text style={s.hint}>
          After this day nobody else can be asked into this set. Leave enough time to sign and
          shoot.
        </Text>

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

      {/* stage-a — "what you are buying" (formats) and "how they drive traffic" (channels)
          used to live here, once for the whole set. Founder, 2026-09-01: move both down to
          per creator (SB-30) — every creator's posts and channels are her own, not a set
          default. See StepTerms and CreatorTermsScreen. */}

      <View style={[s.sec, { flexDirection: 'row', gap: 8 }]}>
        <TouchableOpacity style={[s.btn, s.btnSec, { flex: 1 }]} onPress={onBack} activeOpacity={0.85}>
          <Text style={s.btnSecT}>Back</Text>
        </TouchableOpacity>
        {/* A set cannot continue without all three. The button is greyed rather than the
            brand tapping it and reading a 422 — setShape.basicsReady is the one answer. */}
        <TouchableOpacity
          style={[s.btn, s.btnPri, { flex: 1 }, !ready && s.btnOff]}
          disabled={saving || !ready}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color={ig.bg} /> : <Text style={s.btnPriT}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ── Step 3 · the agreements pick-list ─────────────────────────────────────── */
function StepCreators({ matching, pickedIds, picked, onToggle, onOpen, onBack, onContinue }) {
  // stage-a — creators seeded from the deferred pool (SB-24 "Build a set from these")
  // have no agreement to appear in `matching` at all; without this they would be in
  // `picked` (and counted) but literally invisible on this step — ticked but unseen.
  const seeded = (picked || []).filter((c) => String(c.agreement_id || '').startsWith('deferred:'));

  return (
    <>
      {seeded.length > 0 && (
        <View style={s.sec2}>
          <Text style={s.dh}>Already included · {seeded.length}</Text>
          <Text style={s.lead}>Brought in from the deferred pool. Their terms carried over unchanged.</Text>
          {seeded.map((c) => (
            <View key={c.agreement_id} style={s.pickRow}>
              <CreatorAvatar name={c.name} avatarUrl={c.avatar} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={s.pickName}>{c.name}</Text>
                {c.deferred_from?.note ? (
                  <Text style={s.pickTerms} numberOfLines={2}>&quot;{c.deferred_from.note}&quot;</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => onToggle({ id: c.agreement_id })} activeOpacity={0.7}>
                <Text style={s.removeSeeded}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

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
    selling, buyingContent, picked, derivedBudget,
    onSetAllocation, onGiveOffer, onSetTerms, onBack, onDone,
  } = p;

  const everyoneAllocated = !selling || picked.every(c => c.alloc?.alloc_scope);
  // Batch A — the offer clause is gone. Founder, 2026-08-27: "dont make this mandatory".
  // Nothing underneath ever required it: campaign_sets has no offer columns at all, and the
  // offer lives on campaign_influencers, per creator, nullable. The wizard invented the rule.
  // Allocation stays compulsory — a different rule, and a real one: a contracted creator with
  // no allocation is contracted and invisible in the shopping app.
  //
  // stage-a — formats is the same shape of rule as allocation, for the same reason: a
  // buying-content creator with nothing to deliver is contracted and unsignable, not merely
  // unsold. Channels stays guidance-only, like the set-level ask it replaced.
  const everyoneHasFormats = !buyingContent || picked.every(c => draft.hasFormats(c));
  const canFinish = picked.length > 0 && everyoneAllocated && everyoneHasFormats;

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

                    {/* stage-2-offers-parity — HER offer. Optional, and shown on the row so a
                        brand can read the whole deal without opening anything. */}
                    <KV k="Her shoppers get" v={offerLine(c.offer)} />
                    <TouchableOpacity
                      style={[s.mini, s.miniSec]}
                      onPress={() => onGiveOffer(c)}
                      activeOpacity={0.85}
                    >
                      <Text style={s.miniSecT}>
                        {c.offer ? 'Change her offer' : 'Give her an offer'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* stage-a — where she posts and what she makes, moved down from the set
                    (SB-30). A commission-only creator sees neither: channels is guidance for
                    a SELLING creator, formats is only asked when a fee is buying content. */}
                {(selling || buyingContent) && (
                  <>
                    {buyingContent && (
                      <KV
                        k="What she makes"
                        v={draft.hasFormats(c) ? c.formats_json.map(f => `${f.count} ${f.type}`).join(' · ') : 'Not set yet'}
                        danger={!draft.hasFormats(c)}
                      />
                    )}
                    {selling && (
                      <KV k="Where she posts" v={c.channels_json?.allowed?.length ? c.channels_json.allowed.join(' · ') : 'Not set'} />
                    )}
                    <TouchableOpacity
                      style={[s.mini, buyingContent && !draft.hasFormats(c) ? s.miniPri : s.miniSec]}
                      onPress={() => onSetTerms(c)}
                      activeOpacity={0.85}
                    >
                      <Text style={buyingContent && !draft.hasFormats(c) ? s.miniPriT : s.miniSecT}>
                        {(c.channels_json || draft.hasFormats(c)) ? "Change her terms" : "Set what she posts"}
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
          {/* The set-level offer picker used to live here.

              It was removed once the offer moved to the creator, because leaving both would
              have been two controls doing one job — the fault this programme has already had
              to clean up four times, and the publish gate only ever read this one, so an offer
              given on a creator's own row could not satisfy it at all.

              Contract: features/publish-gate-offer-consistency */}
          <Text style={s.dh}>② What their followers get</Text>
          <Text style={s.lead}>
            An offer is given <Text style={s.leadB}>per creator</Text>, on her row above. Optional —
            a creator with none simply sells at your normal prices, on her commission.
          </Text>
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
              : !everyoneAllocated ? 'Every creator on a sales set must have something to sell.'
              : 'Every creator on a content set needs at least one format — set what she posts.'}
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
  hint: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 6, lineHeight: 15 },
  modeCard: { flex: 1, borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10 },
  modeCardOn: { borderColor: ig.text, backgroundColor: ig.text },
  modeTitle: { fontSize: 12, fontWeight: '800', color: ig.text },
  modeTitleOn: { color: ig.bg },
  modeSub: { fontSize: 10, fontWeight: '650', color: ig.mut, marginTop: 3, lineHeight: 14 },
  modeSubOn: { color: ig.bg, opacity: 0.85 },
  btnOff: { opacity: 0.4 },
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
  removeSeeded: { fontSize: 11, fontWeight: '800', color: ig.red },
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
