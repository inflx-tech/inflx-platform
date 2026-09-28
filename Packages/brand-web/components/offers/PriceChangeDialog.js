'use client';
// Warning before a price change on a product in an offer (O12). Contract: features/offer-builder-v2 · rules 1.11
// Nothing is blocked: the brand sees what the new price touches, then confirms or cancels. After
// saving, the server tells each creator given that offer the old and new price.
import { brandApi } from '../../lib/api';
import { OFX_CSS } from './offerCss';
import { inr, dayMonth } from './offerFormat';

/**
 * Ask the server what each price change touches. Returns only the changes that hit an offer:
 * [{ product, offer, creators, lines, breaks }].
 */
export async function priceImpacts(changes) {
  const out = [];
  for (const c of changes) {
    if (c.price == null || c.price === '' || Number(c.price) === Number(c.old)) continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await brandApi.priceImpact(c.id, c.price);
    if (r.success && r.data.offer) out.push(r.data);
  }
  return out;
}

export default function PriceChangeDialog({ impacts, busy, onCancel, onConfirm }) {
  if (!impacts || !impacts.length) return null;
  const one = impacts.length === 1 ? impacts[0] : null;
  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="dimbg" onClick={() => !busy && onCancel()}>
        <div className="dlg" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
          <h4>{one
            ? `Change ${one.product.name} from ${inr(one.product.price)} to ${inr(one.product.new_price)}?`
            : `Change the price of ${impacts.length} products that are in offers?`}</h4>
          {impacts.map((d) => (
            <div key={d.product.id} style={{ display: 'grid', gap: 8 }}>
              <div className="card warnbox" style={{ gap: 5 }}>
                {!one && <span className="sm"><b>{d.product.name}</b>: {inr(d.product.price)} → {inr(d.product.new_price)}</span>}
                <span className="sm"><b>This product is {d.offer.display_status === 'live' ? 'live' : `booked from ${dayMonth(d.offer.starts_on)}`}</b> {d.offer.as_gift ? 'as a gift ' : ''}in the offer &quot;{d.offer.name}&quot;{d.creators ? <> and given to <b>{d.creators} creator{d.creators > 1 ? 's' : ''}</b></> : ''}.</span>
                {d.lines.map((l) => <span key={l} className="sm">• {l}</span>)}
                <span className="sm">• {d.creators ? `The ${d.creators > 1 ? `${d.creators} creators` : 'creator'} will be told the old and new price.` : 'No creator has this offer yet, so nobody needs telling.'}</span>
              </div>
              {d.breaks.length > 0 && (
                <div className="card nobox" style={{ gap: 3 }}>
                  {/* Not .err: inside Listings, that class is a boxed banner of its own. */}
                  <b style={{ color: 'var(--no-fg)', fontSize: 11.5 }}>Also breaks {d.breaks.length > 1 ? 'offer rules' : 'an offer rule'}</b>
                  {d.breaks.map((b) => <span key={b} className="xs">{b} The offer keeps running; please review it.</span>)}
                </div>
              )}
            </div>
          ))}
          <div className="hint">Shoppers already paying keep the old price.</div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
            <button className="btn btn-ink" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : 'Change price'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
