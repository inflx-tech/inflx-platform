'use client';

/**
 * /dashboard/settings/subscription — Brand subscription overview + upgrade
 *
 * Phase A11: rewritten to render from the entitlements payload (the new
 * first-class feature catalog) + per-tier prices joined from
 * subscription_prices. Adds a Monthly/Yearly toggle that swaps the
 * displayed price on every tier card. Upgrade calls pass billing_period
 * so the backend can pick the right subscription_price row.
 */

import { useEffect, useMemo, useState } from 'react';
import { brandApi, fmtMoney } from '../../../../lib/api';

const CSS = `
.s *{box-sizing:border-box}
.s{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --border:#E4E4E7; --ink:#0A0A0A; --ink2:#52525B; --ink3:#A1A1AA;
  --accent:#0A0A0A; --success:#16A34A; --warn:#D97706; --danger:#DC2626;
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:'Outfit',ui-sans-serif,system-ui,sans-serif;
}
.s .wrap{max-width:1200px; margin:0 auto; padding:24px}
.s h1{font-size:24px; font-weight:600; margin:0 0 4px}
.s .sub{color:var(--ink2); font-size:14px; margin-bottom:24px}
.s .grid{display:grid; gap:16px}
.s .grid.two{grid-template-columns:1fr 1fr}
.s .grid.four{grid-template-columns:repeat(4,1fr)}
.s .card{background:var(--white); border:1px solid var(--border); border-radius:12px; padding:20px}
.s .card h2{font-size:14px; font-weight:600; color:var(--ink2); margin:0 0 12px; text-transform:uppercase; letter-spacing:0.04em}
.s .big{font-size:32px; font-weight:600; color:var(--ink)}
.s .row{display:flex; justify-content:space-between; align-items:baseline; padding:8px 0; border-bottom:1px solid var(--bg2); font-size:14px}
.s .row:last-child{border-bottom:0}
.s .row .k{color:var(--ink2)}
.s .row .v{font-weight:600}
.s .row .v.over{color:var(--danger)}
.s .row .v.near{color:var(--warn)}
.s .pill{display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; background:var(--bg2); color:var(--ink2); text-transform:uppercase; letter-spacing:0.04em}
.s .pill.active{background:#DCFCE7; color:#166534}
.s .pill.past_due{background:#FEE2E2; color:#991B1B}
.s .pill.cancelled{background:var(--bg2); color:var(--ink3)}

.s .toggle{display:inline-flex; background:var(--bg2); border-radius:999px; padding:4px; margin:8px 0 16px; gap:0; align-items:center}
.s .toggle button{padding:6px 14px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; border-radius:999px; color:var(--ink2)}
.s .toggle button.on{background:var(--ink); color:var(--white)}
.s .toggle .save{font-size:11px; font-weight:600; color:var(--success); margin-left:8px; align-self:center}

.s .tier{border:1px solid var(--border); border-radius:12px; padding:20px; background:var(--white); display:flex; flex-direction:column}
.s .tier.current{border-color:var(--ink); border-width:2px}
.s .tier .name{font-size:16px; font-weight:600; margin:0 0 4px}
.s .tier .price{font-size:28px; font-weight:600; margin:0 0 2px}
.s .tier .price .per{font-size:13px; font-weight:400; color:var(--ink2)}
.s .tier .price-note{font-size:11px; color:var(--ink3); min-height:14px; margin-bottom:8px}
.s .tier .desc{font-size:13px; color:var(--ink2); min-height:36px; margin-bottom:12px}
.s .tier .feat-group{margin-bottom:10px}
.s .tier .feat-group .group-label{font-size:10px; color:var(--ink3); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px}
.s .tier ul.feats{padding:0; margin:0; list-style:none; font-size:13px; color:var(--ink)}
.s .tier ul.feats li{padding:2px 0; display:flex; gap:6px; align-items:flex-start}
.s .tier ul.feats li.x{color:var(--ink3)}
.s .tier ul.feats li .ic{flex-shrink:0; width:14px; text-align:center}
.s .tier ul.feats li.x .ic{color:var(--ink3)}
.s .tier ul.feats li.y .ic{color:var(--success)}
.s .tier ul.feats li .meta{color:var(--ink2); font-size:12px}
.s .tier .actions{margin-top:auto; padding-top:12px}
.s .btn{display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:var(--white); color:var(--ink); width:100%}
.s .btn:hover{background:var(--bg2)}
.s .btn.primary{background:var(--accent); color:var(--white); border-color:var(--accent)}
.s .btn.primary:hover{opacity:0.9}
.s .btn:disabled{opacity:0.5; cursor:not-allowed}
.s .empty{padding:24px; text-align:center; color:var(--ink3); font-size:14px}
.s .err{padding:12px; background:#FEE2E2; color:#991B1B; border-radius:8px; font-size:13px; margin-bottom:16px}
.s .ok{padding:12px; background:#DCFCE7; color:#166534; border-radius:8px; font-size:13px; margin-bottom:16px}
`;

function pillClass(status) {
  if (status === 'active')     return 'pill active';
  if (status === 'past_due')   return 'pill past_due';
  if (status === 'cancelled')  return 'pill cancelled';
  return 'pill';
}

function usageBar(used, limit) {
  if (limit === -1) return { display: `${used} / Unlimited`, cls: '' };
  if (limit == null) return { display: `${used} / —`, cls: '' };
  if (limit === 0)  return { display: `${used} / 0`, cls: 'over' };
  if (used >= limit) return { display: `${used} / ${limit}`, cls: 'over' };
  if (used >= limit * 0.8) return { display: `${used} / ${limit}`, cls: 'near' };
  return { display: `${used} / ${limit}`, cls: '' };
}

const CATEGORY_LABEL = {
  influencer:  'Influencer',
  campaigns:   'Campaigns',
  products:    'Products',
  brand_store: 'Brand store',
  support:     'Support',
};

// Format a single entitlement row into a bullet for the tier card.
function fmtEntitlement(e) {
  if (e.feature_type === 'baseline') {
    return { included: true, text: e.label, meta: null };
  }
  if (e.feature_type === 'boolean') {
    return { included: !!e.included, text: e.label, meta: null };
  }
  if (e.feature_type === 'quota') {
    if (!e.included) return { included: false, text: e.label, meta: 'not included' };
    const q = e.quota_value;
    const unitLabel = e.unit ? e.unit.replace(/_/g, ' ') : '';
    const meta = q === -1 ? 'Unlimited' : q != null ? `${q} ${unitLabel}`.trim() : '—';
    return { included: true, text: e.label, meta };
  }
  if (e.feature_type === 'config') {
    if (!e.included) return { included: false, text: e.label, meta: 'not included' };
    const cfg = e.config || {};
    if (e.feature_key === 'discover_filter') {
      const scope = cfg.area_scope || 'city';
      const niches = cfg.niches_limit;
      const scopeLabel = scope === 'all_india' ? 'All-India' : (scope.charAt(0).toUpperCase() + scope.slice(1));
      const nichesLabel = niches === -1 ? 'all niches' : niches != null ? `${niches} niches` : '';
      return { included: true, text: e.label, meta: [scopeLabel, nichesLabel].filter(Boolean).join(', ') };
    }
    if (e.feature_key === 'open_group_broadcast') {
      const scope = cfg.area_scope || 'city';
      const max = cfg.max_recipients;
      const scopeLabel = scope === 'all_india' ? 'All-India' : (scope.charAt(0).toUpperCase() + scope.slice(1));
      const maxLabel = max === -1 ? 'unlimited recipients' : max != null ? `up to ${max} recipients` : '';
      return { included: true, text: e.label, meta: [scopeLabel, maxLabel].filter(Boolean).join(', ') };
    }
    return { included: true, text: e.label, meta: null };
  }
  return { included: false, text: e.label, meta: null };
}

export default function SubscriptionPage() {
  const [sub, setSub]       = useState(null);
  const [tiers, setTiers]   = useState([]);
  const [loading, setL]     = useState(true);
  const [err, setErr]       = useState(null);
  const [ok, setOk]         = useState(null);
  const [upgrading, setUp]  = useState(null);
  const [period, setPeriod] = useState('monthly');   // 'monthly' | 'yearly'

  async function load() {
    setL(true); setErr(null);
    try {
      const [s, t] = await Promise.all([
        brandApi.getMySubscription(),
        brandApi.listSubscriptionTiers(),
      ]);
      if (s?.success === false) {
        setErr(`Load failed: ${s.error?.code} — ${s.error?.message}`);
      } else {
        setSub(s.data);
      }
      if (t?.success === false) {
        setErr((prev) => prev || `Tiers load failed: ${t.error?.code} — ${t.error?.message}`);
      } else {
        setTiers((t.data?.tiers || []).filter(x => x.active !== false));
      }
    } catch (e) {
      setErr(e?.message || 'Failed to load subscription');
    } finally {
      setL(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function upgrade(tierKey, billingPeriod) {
    if (!confirm(`Upgrade to ${tierKey.toUpperCase()} (${billingPeriod})? You will be charged at the start of the next cycle.`)) return;
    setUp(`${tierKey}:${billingPeriod}`); setErr(null); setOk(null);
    try {
      const res = await brandApi.upgradeSubscription(tierKey, billingPeriod);
      if (res?.success === false) {
        setErr(`Upgrade failed: ${res.error?.code} — ${res.error?.message}`);
        setUp(null);
        return;
      }
      setOk(`Upgraded to ${tierKey.toUpperCase()} (${billingPeriod}). Invoice ${res.data?.invoice_id?.slice(0,8) || ''} created.`);
      await load();
    } catch (e) {
      setErr(e?.message || 'Upgrade failed');
    } finally {
      setUp(null);
    }
  }

  // Yearly toggle availability — only show "Save with yearly" hint if at
  // least one tier has a yearly price configured by admin.
  const hasAnyYearly = useMemo(
    () => tiers.some(t => (t.prices || []).some(p => p.billing_period === 'yearly' && p.active)),
    [tiers]
  );

  if (loading) {
    return (
      <div className="s">
        <style>{CSS}</style>
        <div className="wrap"><div className="empty">Loading…</div></div>
      </div>
    );
  }

  const sub_row = sub?.subscription;
  const usage   = sub?.usage || {};
  const currentTierKey = sub?.tier?.tier_key || sub?.tier_key || 'free';
  const currentTier = tiers.find(t => t.tier_key === currentTierKey) || null;
  const currentPriceRow = currentTier?.prices?.find(
    p => p.billing_period === (sub_row?.billing_period || 'monthly') && p.active
  );

  return (
    <div className="s">
      <style>{CSS}</style>
      <div className="wrap">
        <h1>Subscription</h1>
        <div className="sub">Your current plan, usage this cycle, and available tiers.</div>

        {err && <div className="err">{err}</div>}
        {ok  && <div className="ok">{ok}</div>}

        <div className="grid two" style={{ marginBottom: 24 }}>
          <div className="card">
            <h2>Current plan</h2>
            <div className="big">{currentTier?.name || 'Free'}</div>
            <div style={{ margin: '4px 0 12px' }}>
              <span className={pillClass(sub_row?.status || 'active')}>{sub_row?.status || 'active'}</span>
              {sub_row?.mandate_status && <span className="pill" style={{ marginLeft: 8 }}>mandate {sub_row.mandate_status}</span>}
            </div>
            <div className="row">
              <span className="k">Price</span>
              <span className="v">
                {fmtMoney(currentPriceRow?.price_inr || currentTier?.monthly_price_inr || 0)}
                {' '}/ {sub_row?.billing_period === 'yearly' ? 'year' : 'month'}
              </span>
            </div>
            <div className="row"><span className="k">Cycle</span><span className="v">{sub_row?.current_cycle_start || '—'} → {sub_row?.current_cycle_end || '—'}</span></div>
            <div className="row"><span className="k">Next charge</span><span className="v">{sub_row?.next_charge_at || '—'}</span></div>
          </div>

          <div className="card">
            <h2>Usage this cycle</h2>
            {[
              { k: 'Campaigns',          used: usage.campaigns                       ?? 0, lim: currentTier?.max_campaigns           ?? 1 },
              { k: 'Products listed',    used: usage.products                        ?? 0, lim: currentTier?.max_products            ?? 10 },
              { k: 'Influencer invites', used: usage.influencer_invites_this_cycle   ?? 0, lim: currentTier?.max_influencers_per_cycle ?? 5 },
            ].map(r => {
              const b = usageBar(r.used, r.lim);
              return (
                <div className="row" key={r.k}>
                  <span className="k">{r.k}</span>
                  <span className={`v ${b.cls}`}>{b.display}</span>
                </div>
              );
            })}
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '24px 0 4px' }}>Available plans</h2>
        <div className="toggle">
          <button className={period === 'monthly' ? 'on' : ''} onClick={() => setPeriod('monthly')}>Monthly</button>
          <button className={period === 'yearly' ? 'on' : ''} onClick={() => setPeriod('yearly')}>Yearly</button>
          {hasAnyYearly && period === 'monthly' && <span className="save">— Save with yearly</span>}
          {!hasAnyYearly && period === 'yearly' && <span className="save" style={{ color: '#A1A1AA' }}>(no yearly prices configured yet)</span>}
        </div>

        <div className="grid four">
          {tiers.map(t => {
            const isCurrent = t.tier_key === currentTierKey;
            const priceRow = (t.prices || []).find(p => p.billing_period === period && p.active);
            // Graceful fallback: when no price row for the selected period AND
            // we're showing monthly, use the legacy monthly_price_inr column so
            // tiers without an explicit prices[] still render a usable card.
            // Yearly requires an explicit price (no legacy yearly field).
            const priceVal = priceRow
              ? parseFloat(priceRow.price_inr)
              : (period === 'monthly' && t.monthly_price_inr != null
                  ? parseFloat(t.monthly_price_inr)
                  : null);
            const periodLabel = period === 'yearly' ? '/ yr' : '/ mo';

            const monthlyRow = (t.prices || []).find(p => p.billing_period === 'monthly' && p.active);
            const yearlyRow  = (t.prices || []).find(p => p.billing_period === 'yearly' && p.active);
            let priceNote = '';
            if (period === 'yearly' && monthlyRow && yearlyRow) {
              const m = parseFloat(monthlyRow.price_inr) * 12;
              const y = parseFloat(yearlyRow.price_inr);
              if (m > 0 && y < m) priceNote = `Save ${Math.round((1 - y / m) * 100)}% vs monthly`;
            }

            const ents = t.entitlements || [];
            const byCategory = {};
            for (const e of ents) {
              const cat = e.category || 'other';
              if (!byCategory[cat]) byCategory[cat] = [];
              byCategory[cat].push(fmtEntitlement(e));
            }

            const upgradingThis = upgrading === `${t.tier_key}:${period}`;
            const buyable = priceVal != null;

            return (
              <div key={t.tier_key} className={`tier ${isCurrent ? 'current' : ''}`}>
                <div className="name">{t.name}</div>
                <div className="price">
                  {priceVal != null ? fmtMoney(priceVal) : '—'}
                  <span className="per"> {periodLabel}</span>
                </div>
                <div className="price-note">{priceNote || (priceVal == null ? `No ${period} price set` : ' ')}</div>
                <div className="desc">{t.description || ''}</div>

                {Object.entries(byCategory).map(([cat, items]) => (
                  <div className="feat-group" key={cat}>
                    <div className="group-label">{CATEGORY_LABEL[cat] || cat}</div>
                    <ul className="feats">
                      {items.map((f, idx) => (
                        <li key={idx} className={f.included ? 'y' : 'x'}>
                          <span className="ic">{f.included ? '✓' : '✗'}</span>
                          <span>
                            {f.text}
                            {f.meta && <span className="meta"> — {f.meta}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="actions">
                  {isCurrent ? (
                    <button className="btn" disabled>Current plan</button>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={!buyable || !!upgradingThis}
                      onClick={() => upgrade(t.tier_key, period)}
                    >{upgradingThis ? 'Processing…' : !buyable ? 'Not available' : `Choose ${t.name}`}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
