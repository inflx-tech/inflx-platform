'use client';
// The offer builder — six steps, one page (O2–O7). Contract: features/offer-builder-v2 · rules v1.4 §1.2
//   1 Type · 2 Sub-type (skipped for BOGO) · 3 Name & dates · 4 Products · 5 Numbers · 6 Review
// Choosing a type creates the draft; from then on every change saves ("Draft saved automatically").
// Publishing sends the products the review step showed, so the brand publishes exactly what they saw.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { brandApi } from '../../lib/api';
import { OFX_CSS } from './offerCss';
import { TYPES, SUB_TYPES, longDay, span, todayIndia } from './offerFormat';
import PoolBuilder from './PoolBuilder';
import NumbersPanel from './NumbersPanel';

const STEPS = ['Type', 'Sub-type', 'Name & dates', 'Products', 'Numbers', 'Review'];

function stepState(view) {
  if (!view) return { done: {} };
  const o = view.offer;
  const hasSub = !!o.sub_type;
  const named = !!o.name && o.name !== 'Untitled offer';
  const dated = !!o.starts_on && !!o.ends_on && o.ends_on > o.starts_on;
  const pooled = view.pool.counts.buy > 0 && (o.offer_type !== 'free_gift' || view.pool.counts.gift > 0);
  const numbered = (view.numbers.problems || []).length === 0;
  return { done: { 1: true, 2: hasSub, 3: named && dated, 4: pooled, 5: numbered, 6: !!(view.checks && view.checks.ok) } };
}

export default function OfferWizard({ id: idProp = null, initialProducts = [] }) {
  const router = useRouter();
  const [id, setId] = useState(idProp);
  const [view, setView] = useState(null);
  const [step, setStep] = useState(1);
  const [pickType, setPickType] = useState(null);
  const [err, setErr] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const dateTimer = useRef(null);

  const load = useCallback(async (theId, { jump = false } = {}) => {
    setLoadErr('');
    const r = await brandApi.getOffer(theId);
    if (!r.success) { setLoadErr(r.error?.message || 'Couldn\'t load this offer.'); return; }
    if (r.data.offer.status !== 'draft') { router.replace(`/dashboard/products/offers/${theId}`); return; }
    setView(r.data);
    setName(r.data.offer.name === 'Untitled offer' ? '' : r.data.offer.name);
    setStarts(r.data.offer.starts_on || '');
    setEnds(r.data.offer.ends_on || '');
    if (jump) {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const want = sp && Number(sp.get('step'));
      if (want >= 1 && want <= 6) setStep(want);
      else {
        const d = stepState(r.data).done;
        setStep(!d[2] ? 2 : !d[3] ? 3 : !d[4] ? 4 : !d[5] ? 5 : 6);
      }
    }
  }, [router]);

  useEffect(() => { if (idProp) load(idProp, { jump: true }); }, [idProp, load]);

  // Every change goes through here; the server answers with the whole view.
  const save = useCallback(async (body) => {
    if (!id) return null;
    setSaving(true); setErr('');
    const r = await brandApi.updateOffer(id, body);
    setSaving(false);
    if (!r.success) { setErr(r.error?.message || 'Couldn\'t save that.'); return null; }
    setView(r.data);
    if (r.data.notes && r.data.notes.length) setErr(r.data.notes.join(' '));
    return r.data;
  }, [id]);

  async function chooseType(type) {
    setPickType(type);
    if (view && view.offer.offer_type !== type) await save({ offer_type: type });
  }

  async function nextFromType() {
    const type = pickType || (view && view.offer.offer_type);
    if (!type) return;
    if (!id) {
      setBusy(true); setErr('');
      const r = await brandApi.createOffer({ offer_type: type, product_ids: initialProducts });
      setBusy(false);
      if (!r.success) { setErr(r.error?.message || 'Couldn\'t start the offer.'); return; }
      const newId = r.data.offer.id;
      setId(newId);
      window.history.replaceState(null, '', `/dashboard/products/offers/${newId}/edit`);
      await load(newId);
    }
    setStep(type === 'bogo' ? 3 : 2);
  }

  async function chooseSub(sub) { await save({ sub_type: sub }); }

  function onDates(s, e) {
    setStarts(s); setEnds(e);
    clearTimeout(dateTimer.current);
    if (s && e && e <= s) { setErr('The end date must be after the start date.'); return; }
    dateTimer.current = setTimeout(() => save({ starts_on: s || null, ends_on: e || null }), 300);
  }

  async function saveName() {
    if (!view) return;
    if ((view.offer.name === 'Untitled offer' ? '' : view.offer.name) === name.trim()) return;
    await save({ name: name.trim() });
  }

  async function publish() {
    if (busy || !view) return;
    setBusy(true); setErr('');
    const seen = view.pool.buy.map((p) => p.id);
    const r = await brandApi.publishOffer(id, seen);
    setBusy(false);
    if (!r.success) {
      setErr(r.error?.message || 'Couldn\'t publish.');
      await load(id);
      return;
    }
    router.push(`/dashboard/products/offers/${id}?published=1`);
  }

  const type = (view && view.offer.offer_type) || pickType;
  const sub = view && view.offer.sub_type;
  const st = stepState(view);
  // A step can be opened once the steps before it are filled in (numbers may still need fixing:
  // the review shows exactly what's wrong).
  const reach = (n) => {
    if (n === 1) return true;
    if (!id) return false;
    if (n <= step) return true;
    for (let k = 2; k < Math.min(n, 5); k += 1) {
      if (k === 2 && type === 'bogo') continue;
      if (!st.done[k]) return false;
    }
    return true;
  };

  if (idProp && !view && !loadErr) {
    return <div className="ofx"><style dangerouslySetInnerHTML={{ __html: OFX_CSS }} /><div className="page"><div className="card">{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div></div></div>;
  }
  if (loadErr) {
    return (
      <div className="ofx"><style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
        <div className="page"><div className="card nobox"><span className="err">{loadErr}</span>
          <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => load(idProp, { jump: true })}>Try again</button>
            <Link className="btn btn-ghost btn-sm" href="/dashboard/products/listing?tab=offers">← Offers</Link></div></div></div></div>
    );
  }

  const o = view && view.offer;
  const checks = (view && view.checks) || { ok: false, checks: [] };

  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page">
        <div className="row between">
          <Link className="link" href="/dashboard/products/listing?tab=offers">← Offers</Link>
          <span className="xs mut2">{!id ? 'Nothing saved yet' : saving ? 'Saving…' : 'Draft saved automatically'}</span>
        </div>
        <div className="steps">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const skipped = n === 2 && type === 'bogo';
            const cls = n === step ? 'now' : (st.done[n] || skipped) && n < step ? 'done' : '';
            return (
              <button key={label} className={cls} disabled={!reach(n) || skipped} onClick={() => setStep(n)}>
                <i>{cls === 'done' ? '✓' : n}</i>{label}{skipped ? ' · skipped' : ''}
              </button>
            );
          })}
        </div>

        {err && <div className="card nobox" style={{ gap: 3 }}><span className="err">{err}</span></div>}

        {step === 1 && (
          <>
            <h3 style={{ fontSize: 20 }}>What kind of offer?</h3>
            <div className="grid3">
              {TYPES.map((t) => (
                <button key={t.key} className={'card' + (type === t.key ? ' sel' : '')} onClick={() => chooseType(t.key)}>
                  <div className="row"><div className="ico">{t.icon}</div><h4>{t.label}</h4></div>
                  <div className="hint">{t.hint}{t.eg ? <><br />{t.eg}</> : null}</div>
                </button>
              ))}
            </div>
            {initialProducts.length > 0 && !id && <div className="hint">{initialProducts.length} product{initialProducts.length > 1 ? 's' : ''} from Products without offers will be in this offer&apos;s pool.</div>}
            {id && view && view.offer.offer_type !== pickType && pickType && <div className="hint">Changing the type clears the numbers.</div>}
            <div className="foot">
              <Link className="btn btn-ghost" href="/dashboard/products/listing?tab=offers">Cancel</Link>
              <button className="btn btn-ink" disabled={!type || busy} onClick={nextFromType}>{type === 'bogo' ? 'Next: name & dates →' : 'Next: sub-type →'}</button>
            </div>
          </>
        )}

        {step === 2 && o && (
          <>
            <h3 style={{ fontSize: 20 }}>Which kind of {o.type_label.split(' ·')[0].toLowerCase()}?</h3>
            <div className="grid2" style={{ maxWidth: 760 }}>
              {(SUB_TYPES[o.offer_type] || []).map((s) => (
                <button key={s.key} className={'card' + (sub === s.key ? ' sel' : '')} onClick={() => chooseSub(s.key)}>
                  <div className="row"><span className={'radio' + (sub === s.key ? ' on' : '')} /><b>{s.label}</b></div>
                  <div className="hint">{s.hint}</div>
                </button>
              ))}
            </div>
            <div className="foot">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-ink" disabled={!sub} onClick={() => setStep(3)}>Next: name &amp; dates →</button>
            </div>
          </>
        )}

        {step === 3 && o && (
          <>
            <div className="card" style={{ maxWidth: 560 }}>
              <div className="field"><span className="lbl">Offer name</span>
                <input className="inp" maxLength={150} value={name} placeholder="20% off Levi's Jeans" onChange={(e) => setName(e.target.value)} onBlur={saveName} />
                <span className="hint">Creators and shoppers see this name.</span></div>
              <div className="grid2">
                <div className="field"><span className="lbl">Starts</span>
                  <input className="inp" type="date" value={starts} min={todayIndia()} onChange={(e) => onDates(e.target.value, ends)} /></div>
                <div className="field"><span className="lbl">Ends</span>
                  <input className={'inp' + (starts && ends && ends <= starts ? ' err' : '')} type="date" value={ends} min={starts || todayIndia()} onChange={(e) => onDates(starts, e.target.value)} /></div>
              </div>
              <div className="card tint"><span className="sm">🔒 <b>Why dates come first:</b> a product can be in only one offer at a time. On the next step, products already in another offer {starts && ends ? <>between <b>{longDay(starts)}</b> and <b>{longDay(ends)}</b></> : 'on these dates'} will be shown but can&apos;t be added.</span></div>
            </div>
            <div className="foot">
              <button className="btn btn-ghost" onClick={() => setStep(type === 'bogo' ? 1 : 2)}>← Back</button>
              <button className="btn btn-ink" disabled={!st.done[3] && !(name.trim() && starts && ends && ends > starts)}
                onClick={async () => { await saveName(); setStep(4); }}>Next: products →</button>
            </div>
          </>
        )}

        {step === 4 && view && (
          <>
            <PoolBuilder view={view} onView={setView} setError={setErr} />
            <div className="foot">
              <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
              <button className="btn btn-ink" disabled={!st.done[4]} onClick={() => setStep(5)}>Next: numbers →</button>
            </div>
          </>
        )}

        {step === 5 && view && (
          <>
            <NumbersPanel key={view.offer.id + (sub || '')} view={view} save={save} />
            <div className="foot">
              <button className="btn btn-ghost" onClick={() => setStep(4)}>← Back</button>
              <button className="btn btn-ink" onClick={() => setStep(6)}>Next: review →</button>
            </div>
          </>
        )}

        {step === 6 && o && (
          <>
            <div className="grid2">
              <div className="card">
                <div className="row between"><h4>{o.name}</h4><span className="st draft">Not published</span></div>
                <table className="tbl" style={{ border: 0 }}>
                  <tbody>
                    <tr><td className="mut">Type</td><td><b>{o.type_label}</b></td><td className="r"><button className="link xs" onClick={() => setStep(1)}>Edit</button></td></tr>
                    <tr><td className="mut">Dates</td><td><b>{o.starts_on && o.ends_on ? `${longDay(o.starts_on)} – ${longDay(o.ends_on)}` : 'Not set'}</b></td><td className="r"><button className="link xs" onClick={() => setStep(3)}>Edit</button></td></tr>
                    <tr><td className="mut">Pool</td><td><b>{view.pool.counts.buy} product{view.pool.counts.buy === 1 ? '' : 's'}</b>{view.pool.counts.gift ? ` + ${view.pool.counts.gift} gift${view.pool.counts.gift > 1 ? 's' : ''}` : ''}{view.pool.sources.length ? ` · ${view.pool.sources.map((s) => s.label).join(', ')}` : ''}</td><td className="r"><button className="link xs" onClick={() => setStep(4)}>Edit</button></td></tr>
                    <tr><td className="mut">Deal</td><td><b>{o.deal || 'Not set'}</b></td><td className="r"><button className="link xs" onClick={() => setStep(5)}>Edit</button></td></tr>
                    <tr><td className="mut">New products</td><td>{o.auto_add ? 'Added automatically from category lines' : 'Not added automatically'}</td><td /></tr>
                  </tbody>
                </table>
                <div className="hint">After you publish, these {view.pool.counts.buy} products{view.pool.counts.gift ? ' and gifts' : ''} are locked to this offer {o.starts_on && o.ends_on ? `from ${span(o.starts_on, o.ends_on).replace(' – ', ' to ')}` : 'for its dates'}. You can then give the offer to creators when you set their terms.</div>
              </div>
              <div className="card">
                <h4>Publish checks</h4>
                <div className="chk">{checks.checks.map((c, i) => <div key={c.key + i} className={c.ok ? 'ok' : 'no'}> {c.text}</div>)}</div>
                {!checks.ok && <div className="hint">Publish stays off until every check passes.</div>}
              </div>
            </div>
            <div className="foot">
              <button className="btn btn-ghost" onClick={() => setStep(5)}>← Back</button>
              <div className="row">
                <Link className="btn btn-ghost" href="/dashboard/products/listing?tab=offers">Save as draft</Link>
                <button className="btn btn-ink" disabled={!checks.ok || busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish offer'}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
