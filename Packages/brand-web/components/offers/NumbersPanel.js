'use client';
// Step 5 — the numbers, one panel per sub-type (O6). Contract: features/offer-builder-v2 · rules 1.6, 1.8
// Every change saves; the server answers with the problems, the checks that use the pool, and the
// help lines (the example price, the suggested safe price, the fixed total). Nothing is judged here.
import { useEffect, useRef, useState } from 'react';
import { inr } from './offerFormat';

const POOL_KEYS = new Set(['flat_below_cheapest', 'tier_amount', 'band', 'saving', 'pool_pick', 'one_category',
  'fixed_items', 'fixed_below_total', 'gift_pool', 'gift_count', 'disjoint', 'gift_limit', 'gift_threshold', 'bogo']);

function Num({ label, value, onChange, suffix, prefix, placeholder, optional, width }) {
  return (
    <div className="field">
      <span className="lbl">{label} {optional && <span className="mut2">(optional)</span>}</span>
      <div className="row" style={{ gap: 6 }}>
        {prefix && <span className="mut">{prefix}</span>}
        <input className="inp" style={{ width: width || 120 }} type="number" min="0" step="any" value={value ?? ''} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        {suffix && <span className="mut">{suffix}</span>}
      </div>
    </div>
  );
}

export default function NumbersPanel({ view, save }) {
  const offer = view.offer;
  const sub = offer.sub_type;
  const [cfg, setCfg] = useState(offer.offer_config_json || {});
  const timer = useRef(null);
  const first = useRef(true);

  // Keep the local copy when the server sends back a fresh view of the same offer.
  useEffect(() => { setCfg(offer.offer_config_json || {}); }, [offer.id, sub]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ offer_config_json: cfg }), 450);
    return () => clearTimeout(timer.current);
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const tiers = Array.isArray(cfg.tiers) && cfg.tiers.length ? cfg.tiers : [{ at: null, value: null }];
  const setTier = (i, k, v) => setCfg((c) => ({ ...c, tiers: tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const reward = cfg.reward === 'amount' ? 'amount' : 'pct';
  const help = view.numbers.help || {};
  const problems = view.numbers.problems || [];
  const checks = ((view.checks && view.checks.checks) || []).filter((c) => POOL_KEYS.has(c.key));
  const giftN = view.pool.counts.gift;

  let body = null;
  switch (sub) {
    case 'percentage':
      body = (<>
        <Num label="Discount" value={cfg.pct} suffix="%" onChange={(v) => set('pct', v)} placeholder="20" />
        <Num label="Max ₹ off per item" optional prefix="₹" value={cfg.max_off} onChange={(v) => set('max_off', v)} placeholder="400" />
        {help.example && <div className="hint">{help.example}</div>}
      </>);
      break;
    case 'flat':
      body = (<>
        <Num label="₹ off each item" prefix="₹" value={cfg.amount} onChange={(v) => set('amount', v)} placeholder="200" />
        {help.example && <div className="hint">{help.example}</div>}
      </>);
      break;
    case 'bogo':
      body = (<>
        <div className="hint">Buy any product in the pool → get <b>the same product</b> free in any size or colour.</div>
        <Num label="Max free items per order" optional value={cfg.max_free} onChange={(v) => set('max_free', v)} placeholder="2" />
        <div className="hint">Buy 511 Blue 32 → 511 Black 34 free ✓ · Buy 511 → 501 free ✕. No price checks.</div>
      </>);
      break;
    case 'quantity':
    case 'value':
      body = (<>
        <div className="row" style={{ gap: 6 }}><span className="lbl">Reward</span>
          <button className={'chip' + (reward === 'pct' ? ' act' : '')} onClick={() => set('reward', 'pct')}>%</button>
          <button className={'chip' + (reward === 'amount' ? ' act' : '')} onClick={() => set('reward', 'amount')}>₹</button></div>
        <div className="tiers">
          {tiers.map((t, i) => (
            <div key={i} className="tier">
              <span>{sub === 'quantity' ? 'Buy' : 'Spend ₹'}</span>
              <input className="inp" type="number" min="1" value={t.at ?? ''} placeholder={sub === 'quantity' ? String(i + 2) : String((i + 2) * 1000)} onChange={(e) => setTier(i, 'at', e.target.value === '' ? null : Number(e.target.value))} />
              <span>→</span>
              <input className="inp" type="number" min="1" value={t.value ?? ''} placeholder={reward === 'pct' ? `${(i + 1) * 10} %` : '₹ off'} onChange={(e) => setTier(i, 'value', e.target.value === '' ? null : Number(e.target.value))} />
              <button className="link xs" disabled={tiers.length === 1} onClick={() => setCfg((c) => ({ ...c, tiers: tiers.filter((_, j) => j !== i) }))}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} disabled={tiers.length >= 4}
          onClick={() => setCfg((c) => ({ ...c, tiers: [...tiers, { at: null, value: null }] }))}>+ Add tier ({tiers.length} of 4)</button>
        <div className="hint">Tiers replace each other, they never add up. Each tier must be higher than the one before. Reward is {reward === 'pct' ? '% off' : '₹ off'} the items.</div>
      </>);
      break;
    case 'pick_any':
    case 'mix_match':
      body = (<>
        <div className="grid2">
          <Num label="Pick" value={cfg.pick} onChange={(v) => set('pick', v)} placeholder="2" width={80} />
          <Num label="For" prefix="₹" value={cfg.price} onChange={(v) => set('price', v)} placeholder="2999" />
        </div>
        {help.safe_price && <div className="card tint" style={{ gap: 3 }}><span className="xs"><b>Suggested safe price: {inr(help.safe_price.low)} – {inr(help.safe_price.high)}</b></span><span className="xs mut2">The cheapest {cfg.pick} cost {inr(help.safe_price.combo)} together.</span></div>}
      </>);
      break;
    case 'fixed':
      body = (<>
        <div className="row between"><span className="sm">Total price of items</span><b className="mono">{inr(help.total)}</b></div>
        <Num label="Bundle price" prefix="₹" value={cfg.price} onChange={(v) => set('price', v)} placeholder="2499" />
        <div className="hint">The shopper only picks size and colour. Quantities are set on the products step.</div>
        {/* shopper-deal-orders (board B7): off = the set is sold only whole, as every set was. */}
        <div className="swrow" data-testid="pieces-alone">
          <button type="button" className="sw" role="switch" aria-checked={cfg.pieces_alone === true} aria-label="Pieces can also be bought alone"
            onClick={() => set('pieces_alone', !(cfg.pieces_alone === true))} />
          <div className="t">
            <b className="sm">Pieces can also be bought alone</b>
            <span className="xs mut2">Off: the set is sold only whole. On: a shopper may also buy one piece at its normal price.</span>
          </div>
        </div>
      </>);
      break;
    case 'spend':
      body = (<>
        <Num label="Minimum spend on the buy pool" prefix="₹" value={cfg.min_spend} onChange={(v) => set('min_spend', v)} placeholder="3000" />
        <Num label="Gifts the shopper gets" value={cfg.gift_count} suffix={`of ${giftN}`} onChange={(v) => set('gift_count', v)} placeholder="1" width={80} />
      </>);
      break;
    case 'buy_x':
      body = (<>
        <Num label="Buy" value={cfg.buy_qty} suffix="items from the buy pool" onChange={(v) => set('buy_qty', v)} placeholder="2" width={80} />
        <Num label="Gifts the shopper gets" value={cfg.gift_count} suffix={`of ${giftN}`} onChange={(v) => set('gift_count', v)} placeholder="1" width={80} />
        <div className="hint">If the gift pool has 1 item, the shopper simply gets it. With several, they choose.</div>
      </>);
      break;
    default:
      body = <div className="hint">Choose the sub-type first.</div>;
  }

  const bad = problems.length > 0 || checks.some((c) => !c.ok);
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <div className="row between"><h4>{view.offer.type_label}</h4><span className={'st ' + (bad ? 'draft' : 'live')}>{bad ? 'Fix' : 'OK'}</span></div>
      {body}
      {problems.map((p) => <div key={p.field + p.text} className="err">{p.text}</div>)}
      {checks.length > 0 && (
        <div className="chk">{checks.map((c, i) => <div key={c.key + i} className={c.ok ? 'ok' : 'no'}> {c.text}</div>)}</div>
      )}
    </div>
  );
}
