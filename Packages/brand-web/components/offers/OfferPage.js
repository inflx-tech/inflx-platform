'use client';
// A published offer (O10) and its allowed changes (O11). Contract: features/offer-builder-v2 · rules 1.9, 1.10
// Name, type, numbers and dates are frozen once published. Products can be added or taken out only
// while no creator has the offer (features/offer-add-products); after that the creators' terms and
// posts promise this pool, and the brand can only end the offer.
// Once Ended (early or by its date) the brand can delete it (features/offer-delete · rules v1.17 §1.9):
// it leaves the brand's lists and this page answers not found; creators, orders and INFLX keep it.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { brandApi } from '../../lib/api';
import { OFX_CSS } from './offerCss';
import { STATUS_LABEL, dayMonth, inr, longDay, span } from './offerFormat';
import AddProductsPanel from './AddProductsPanel';

// Every way back from this page to the Offers list is a full page load (a plain <a>, or
// location.assign after a delete), not a Next <Link> / router.push. Listings picks its tab from
// the address bar when it first draws, and a client-side link draws it before the address bar
// changes, so a <Link> here opened Listings on Inventory (qa/web/brand/offer-delete.spec.ts).
const OFFERS_LIST = '/dashboard/products/listing?tab=offers';

export default function OfferPage({ id }) {
  const router = useRouter();
  const [view, setView] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState(null);
  const [removing, setRemoving] = useState(false);     // choosing products to remove
  const [adding, setAdding] = useState(false);         // choosing products to add
  const [ticked, setTicked] = useState([]);
  const [dialog, setDialog] = useState(null);          // { kind: 'remove', preview } | { kind: 'end' } | { kind: 'delete' }
  const [busy, setBusy] = useState(false);
  const [dlgErr, setDlgErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const r = await brandApi.getOffer(id);
    if (!r.success) { setErr(r.error?.message || 'Couldn\'t load this offer.'); return; }
    if (r.data.offer.status === 'draft') { router.replace(`/dashboard/products/offers/${id}/edit`); return; }
    setView(r.data);
  }, [id, router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('published')) {
      setToast({ msg: 'Published. Its products are locked to this offer for its dates.' });
      window.history.replaceState(null, '', `/dashboard/products/offers/${id}`);
      setTimeout(() => setToast(null), 4000);
    }
  }, [id]);

  const say = (msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  // A creator was given the offer while this page was open: say so and show the frozen page.
  function given(msg) {
    setDialog(null); setAdding(false); setRemoving(false); setTicked([]);
    say(msg, 'err');
    load();
  }
  async function openRemove() {
    if (!ticked.length) return;
    setDlgErr('');
    const r = await brandApi.offerRemovePreview(id, ticked);
    if (!r.success && r.error?.code === 'OFFER_GIVEN') { given(r.error.message); return; }
    if (!r.success) { say(r.error?.message || 'Couldn\'t check those products.', 'err'); return; }
    setDialog({ kind: 'remove', preview: r.data });
  }
  async function confirmRemove() {
    if (busy) return;
    setBusy(true); setDlgErr('');
    const r = await brandApi.removeOfferProducts(id, ticked);
    setBusy(false);
    if (!r.success && r.error?.code === 'OFFER_GIVEN') { given(r.error.message); return; }
    if (!r.success) { setDlgErr(r.error?.message || 'Couldn\'t remove them.'); return; }
    setDialog(null); setRemoving(false); setTicked([]);
    say(`${r.data.removed} product${r.data.removed > 1 ? 's' : ''} removed and free again.`);
    load();
  }
  function added(d) {
    setAdding(false);
    say(`${d.added} product${d.added > 1 ? 's' : ''} added. ${d.added > 1 ? 'They\'re' : 'It\'s'} locked to this offer until ${dayMonth(d.locked_until)}.`);
    load();
  }
  async function confirmEnd() {
    if (busy) return;
    setBusy(true); setDlgErr('');
    const r = await brandApi.endOffer(id);
    setBusy(false);
    if (!r.success) { setDlgErr(r.error?.message || 'Couldn\'t end the offer.'); return; }
    setDialog(null);
    const d = r.data; const dropped = d.invitations_dropped || 0; const gone = d.invitations_withdrawn || 0;
    say(`Offer ended. Its products are free from today.${d.creators_told ? ` ${d.creators_told} creator${d.creators_told > 1 ? 's were' : ' was'} told.` : ''}${dropped ? ` Taken out of ${dropped} unsigned invitation${dropped > 1 ? 's' : ''}${gone ? `; ${gone} withdrawn with nothing left to sell` : ''}.` : ''}`);
    load();
  }
  async function confirmDelete() {
    if (busy) return;
    setBusy(true); setDlgErr('');
    const r = await brandApi.deleteOffer(id);
    if (!r.success) {
      setBusy(false);
      // Already gone (deleted elsewhere, or the first try went through): close the box and reload —
      // the page then shows its "Offer not found" card with the way back to Offers.
      if (r.error?.code === 'NOT_FOUND') { setDialog(null); load(); return; }
      setDlgErr(r.error?.message || 'Couldn\'t delete it. Try again.');
      return;
    }
    // Back to the list, which says "Offer deleted." (it reads ?deleted=1). Busy stays on until we leave.
    // A full load, not router.push (see OFFERS_LIST above).
    window.location.assign(`${OFFERS_LIST}&deleted=1`);
  }

  if (err) {
    return (<div className="ofx"><style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page"><div className="card nobox"><span className="err">{err}</span>
        <div className="row"><button className="btn btn-ghost btn-sm" onClick={load}>Try again</button><a className="btn btn-ghost btn-sm" href={OFFERS_LIST}>← Offers</a></div></div></div></div>);
  }
  if (!view) {
    return <div className="ofx"><style dangerouslySetInnerHTML={{ __html: OFX_CSS }} /><div className="page"><div className="card">{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div></div></div>;
  }

  const o = view.offer;
  const ds = o.display_status;
  const running = ds === 'live' || ds === 'scheduled';
  const statusText = ds === 'live' ? `Live · ${o.days_left} day${o.days_left === 1 ? '' : 's'} left`
    : ds === 'scheduled' ? `Scheduled · starts in ${o.starts_in} day${o.starts_in === 1 ? '' : 's'}`
    : STATUS_LABEL[ds];
  const items = [...view.pool.buy.map((p) => ({ ...p, pool: 'buy' })), ...view.pool.gift.map((g) => ({ ...g, pool: 'gift' }))];
  const creators = view.creators || [];
  // Products can change only while no creator has the offer; a fixed bundle is exactly its products.
  const poolOpen = view.pool_open !== undefined ? !!view.pool_open : running && creators.length === 0;
  const canAdd = o.sub_type !== 'fixed';
  const pickedNames = items.filter((p) => ticked.includes(p.id)).map((p) => p.name);

  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page">
        <div className="row between">
          <a className="link" href={OFFERS_LIST}>← Offers</a>
          {running && (
            <div className="row">
              {canAdd && <button className="btn btn-ghost btn-sm" disabled={!poolOpen} onClick={() => { setAdding((v) => !v); setRemoving(false); setTicked([]); }}>{adding ? 'Cancel adding' : 'Add products'}</button>}
              <button className="btn btn-ghost btn-sm" disabled={!poolOpen} onClick={() => { setRemoving((v) => !v); setAdding(false); setTicked([]); }}>{removing ? 'Cancel removing' : 'Remove products'}</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setDlgErr(''); setDialog({ kind: 'end' }); }}>End offer now</button>
            </div>
          )}
          {ds === 'ended' && (
            <div className="row">
              <button className="btn btn-danger btn-sm" onClick={() => { setDlgErr(''); setDialog({ kind: 'delete' }); }}>Delete</button>
            </div>
          )}
        </div>
        <div className="hdr">
          <div><h3>{o.name}</h3><div className="sub">{o.type_label}{o.deal ? ` · ${o.deal}` : ''} · {o.starts_on && o.ends_on ? `${longDay(o.starts_on)} – ${longDay(o.ends_on)}` : ''}</div>
            {/* shopper-deal-orders (B7): how the set was set up. One of the offer's numbers, so frozen with them. */}
            {o.sub_type === 'fixed' && (
              <div className="xs mut2" data-testid="pieces-alone-line">{(o.offer_config_json || {}).pieces_alone === true
                ? 'A piece can also be bought alone, at its normal price.' : 'Sold only as the whole set.'}</div>
            )}
          </div>
          <span className={'st ' + ds}>{statusText}</span>
        </div>
        {running && !poolOpen && (
          <div className="card tint" data-testid="pool-given">
            <span className="sm"><b>This offer has been given to {creators.length} creator{creators.length > 1 ? 's' : ''}, so its products can&apos;t be added or removed.</b> Creators&apos; terms and posts promise these products. To change the deal, end the offer and build a new one.</span>
          </div>
        )}
        <div className="grid3">
          <div className="card"><span className="lbl">Pool</span><span className="big">{view.pool.counts.buy}{view.pool.counts.gift ? ` + ${view.pool.counts.gift}` : ''}</span><span className="xs mut2">products{view.pool.counts.gift ? ' + gifts' : ''} · {poolOpen ? 'can change until a creator has it' : 'frozen'}</span></div>
          <div className="card"><span className="lbl">Creators given this offer</span><span className="big">{creators.length}</span><span className="xs mut2">{creators.length ? `in ${new Set(creators.map((c) => c.set_name + c.campaign_name)).size} set${new Set(creators.map((c) => c.set_name + c.campaign_name)).size > 1 ? 's' : ''}` : 'You give offers to creators when you set their terms'}</span></div>
          <div className="card"><span className="lbl">Live posts using it</span><span className="big">{view.posts.live}</span><span className="xs mut2">{view.posts.note}</span></div>
        </div>

        {adding && poolOpen && <AddProductsPanel offer={o} onAdded={added} onGiven={given} onCancel={() => setAdding(false)} />}

        {removing && poolOpen && (
          <div className="card warnbox">
            <div className="row between"><b className="sm">Tick the products to take out of this offer</b>
              <button className="btn btn-ink btn-sm" disabled={!ticked.length} onClick={openRemove}>Remove {ticked.length || ''} product{ticked.length === 1 ? '' : 's'}</button></div>
            <div className="plist" style={{ background: '#fff' }}>
              {items.map((p) => (
                <label key={p.pool + p.id} className="prow">
                  <input type="checkbox" checked={ticked.includes(p.id)} onChange={() => setTicked((t) => (t.includes(p.id) ? t.filter((x) => x !== p.id) : [...t, p.id]))} />
                  <div className="t"><b>{p.name}</b><span className="xs mut2">{p.pool === 'gift' ? `Gift · ${inr(p.value)}` : inr(p.price)}</span></div>
                </label>
              ))}
            </div>
          </div>
        )}

        {creators.length > 0 && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Creator</th><th>Set</th><th className="r">Posts</th><th className="r">Sales</th></tr></thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.campaign_influencer_id}><td><b>{c.name}</b></td><td className="sm">{c.campaign_name} · {c.set_name}</td><td className="r mono">{c.posts}</td><td className="r mono">{c.sales == null ? '—' : inr(c.sales)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!(removing && poolOpen) && (
          <div className="card">
            <h4>The pool</h4>
            <div className="plist">
              {items.map((p) => (
                <div key={p.pool + p.id} className="prow">
                  <div className="t"><b>{p.name}</b><span className="xs mut2">{p.pool === 'gift' ? (p.kind === 'gift_item' ? `Gift item · worth ${inr(p.value)} · stock ${p.stock}` : `Gift · ${inr(p.value)} · limit ${p.gift_limit || '—'}`) : `${inr(p.price)}${p.quantity > 1 ? ` · qty ${p.quantity}` : ''}${p.added_by === 'auto_add' ? ` · added automatically from ${longDay(p.from_day)}` : (p.from_day > o.starts_on ? ` · added ${longDay(p.from_day)}` : '')}`}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="hint">{poolOpen
          ? 'Name, type, numbers and dates can\'t be edited once published. You can add or remove products until you give this offer to a creator. To change the deal itself, end it and build a new one.'
          : 'Name, type, numbers and pool can\'t be edited once published. Creators\' posts already promise this deal. To change the deal, end it and build a new one.'}</div>
      </div>

      {dialog && dialog.kind === 'remove' && (
        <div className="dimbg" onClick={() => !busy && setDialog(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <h4>Remove {dialog.preview.products.length} product{dialog.preview.products.length > 1 ? 's' : ''} from this offer?</h4>
            <div className="sm">{pickedNames.join(' · ')}</div>
            <div className="card tint" style={{ gap: 4 }}>
              <span className="sm"><b>No creator has this offer yet</b>, so nothing else changes.</span>
            </div>
            <div className="hint">The {dialog.preview.products.length} product{dialog.preview.products.length > 1 ? 's become' : ' becomes'} free right away and can go into another offer. {dialog.preview.products_left} stay{dialog.preview.products_left === 1 ? 's' : ''} in this offer.</div>
            {dlgErr && <div className="err">{dlgErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
              <button className="btn btn-ink" disabled={busy} onClick={confirmRemove}>{busy ? 'Removing…' : 'Remove products'}</button>
            </div>
          </div>
        </div>
      )}

      {dialog && dialog.kind === 'end' && (
        <div className="dimbg" onClick={() => !busy && setDialog(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <h4>End &quot;{o.name}&quot; now?</h4>
            <div className="card nobox" style={{ gap: 4 }}>
              <span className="sm"><b>Every post using this offer leaves the shop.</b></span>
              <span className="xs">Their photos and videos promise {o.deal ? o.deal.toLowerCase() : 'this deal'}, so they can&apos;t stay up at full price.{creators.length ? ` The ${creators.length} creator${creators.length > 1 ? 's are' : ' is'} told.` : ''}</span>
            </div>
            {view.unsigned_invitations > 0 && (
              <div className="card nobox" style={{ gap: 4 }} data-testid="end-unsigned">
                <span className="sm"><b>It&apos;s in {view.unsigned_invitations} unsigned invitation{view.unsigned_invitations > 1 ? 's' : ''}.</b></span>
                <span className="xs">It drops out of {view.unsigned_invitations > 1 ? 'them' : 'it'} and the creator{view.unsigned_invitations > 1 ? 's are' : ' is'} told. An invitation left with nothing to sell is withdrawn.</span>
              </div>
            )}
            <div className="hint">{view.pool.counts.buy === 1 ? 'Its 1 product becomes' : `All ${view.pool.counts.buy} products become`}{view.pool.counts.gift ? ' (and its gifts)' : ''} free right away. It stays in your list as Ended until you delete it, with its dates ({span(o.starts_on, o.ends_on)}).</div>
            {dlgErr && <div className="err">{dlgErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setDialog(null)}>Keep it running</button>
              <button className="btn btn-danger" disabled={busy} onClick={confirmEnd}>{busy ? 'Ending…' : 'End offer now'}</button>
            </div>
          </div>
        </div>
      )}

      {dialog && dialog.kind === 'delete' && (
        <div className="dimbg" onClick={() => !busy && setDialog(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <h4>Delete &quot;{o.name}&quot;?</h4>
            <div className="sm">It comes off your Offers list. Creators who had it, their posts, orders and payments keep their records.</div>
            {dlgErr && <div className="err">{dlgErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setDialog(null)}>Keep it</button>
              <button className="btn btn-danger" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete offer'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast' + (toast.type === 'err' ? ' err' : '')}>{toast.msg}</div>}
    </div>
  );
}
