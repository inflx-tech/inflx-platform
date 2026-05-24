'use client';

/**
 * /dashboard/subscription — Brand subscription overview + upgrade
 *
 * Phase A7-brand of the INFLX 3-Layer Revenue Model. Mirrors existing
 * dashboard page styling (wave2 locked palette from /dashboard/wallet)
 * — explicit no-new-design-surface decision: founder will restyle later.
 *
 * Surface:
 *  - Current plan card: tier_key + monthly_price_inr + cycle dates
 *  - Usage card: campaigns / products / influencer-invites this cycle vs limits
 *  - Tier comparison grid: 4 tiers with Choose buttons (upgrade flow)
 *  - Upgrade calls POST /brands/me/subscription/upgrade — mock mode
 *    today (RAZORPAY_MOCK=true) writes a paid invoice immediately.
 */

import { useEffect, useState } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

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
.s .label{font-size:12px; color:var(--ink3); text-transform:uppercase; letter-spacing:0.04em}
.s .row{display:flex; justify-content:space-between; align-items:baseline; padding:8px 0; border-bottom:1px solid var(--bg2)}
.s .row:last-child{border-bottom:0}
.s .row .k{color:var(--ink2); font-size:14px}
.s .row .v{font-weight:600; font-size:14px}
.s .row .v.over{color:var(--danger)}
.s .row .v.near{color:var(--warn)}
.s .pill{display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; background:var(--bg2); color:var(--ink2); text-transform:uppercase; letter-spacing:0.04em}
.s .pill.active{background:#DCFCE7; color:#166534}
.s .pill.past_due{background:#FEE2E2; color:#991B1B}
.s .pill.cancelled{background:var(--bg2); color:var(--ink3)}
.s .tier{border:1px solid var(--border); border-radius:12px; padding:20px; background:var(--white); display:flex; flex-direction:column}
.s .tier.current{border-color:var(--ink); border-width:2px}
.s .tier .name{font-size:16px; font-weight:600; margin:0 0 4px}
.s .tier .price{font-size:28px; font-weight:600; margin:0 0 4px}
.s .tier .price .per{font-size:13px; font-weight:400; color:var(--ink2)}
.s .tier .desc{font-size:13px; color:var(--ink2); min-height:36px; margin-bottom:12px}
.s .tier ul{padding:0; margin:0 0 16px; list-style:none; font-size:13px; color:var(--ink2)}
.s .tier ul li{padding:4px 0; border-bottom:1px solid var(--bg2)}
.s .tier ul li:last-child{border-bottom:0}
.s .btn{display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:var(--white); color:var(--ink); transition:all 0.1s}
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
  if (limit === 0)  return { display: `${used} / 0`,         cls: 'over' };
  if (used >= limit) return { display: `${used} / ${limit}`, cls: 'over' };
  if (used >= limit * 0.8) return { display: `${used} / ${limit}`, cls: 'near' };
  return { display: `${used} / ${limit}`, cls: '' };
}

export default function SubscriptionPage() {
  const [sub, setSub]       = useState(null);
  const [tiers, setTiers]   = useState([]);
  const [loading, setL]     = useState(true);
  const [err, setErr]       = useState(null);
  const [ok, setOk]         = useState(null);
  const [upgrading, setUp]  = useState(null);

  async function load() {
    setL(true); setErr(null);
    try {
      const [s, t] = await Promise.all([
        brandApi.getMySubscription(),
        brandApi.listSubscriptionTiers(),
      ]);
      setSub(s.data);
      setTiers((t.data?.tiers || []).filter(x => x.active !== false));
    } catch (e) {
      setErr(e?.message || 'Failed to load subscription');
    } finally {
      setL(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function upgrade(tierKey) {
    if (!confirm(`Upgrade to ${tierKey.toUpperCase()}? You will be charged at the start of the next cycle.`)) return;
    setUp(tierKey); setErr(null); setOk(null);
    try {
      const res = await brandApi.upgradeSubscription(tierKey);
      setOk(`Upgraded to ${tierKey.toUpperCase()}. Invoice ${res.data?.invoice?.id?.slice(0,8) || ''} created.`);
      await load();
    } catch (e) {
      setErr(e?.message || 'Upgrade failed');
    } finally {
      setUp(null);
    }
  }

  if (loading) return <div className="s"><style>{CSS}</style><div className="wrap"><div className="empty">Loading…</div></div></div>;

  const sub_row = sub?.subscription;
  const usage   = sub?.usage || { campaigns: 0, products: 0, influencer_invites_this_cycle: 0 };
  const tier    = sub?.tier || tiers.find(t => t.tier_key === 'free') || null;
  const currentTierKey = tier?.tier_key || 'free';

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
            <div className="big">{tier?.name || 'Free'}</div>
            <div style={{ margin: '4px 0 12px' }}>
              <span className={pillClass(sub_row?.status || 'active')}>{sub_row?.status || 'active'}</span>
              {sub_row?.mandate_status && (
                <span className="pill" style={{ marginLeft: 8 }}>mandate {sub_row.mandate_status}</span>
              )}
            </div>
            <div className="row"><span className="k">Price</span><span className="v">{fmtMoney(tier?.monthly_price_inr || 0)} / month</span></div>
            <div className="row"><span className="k">Cycle</span><span className="v">{sub_row?.current_cycle_start || '—'} → {sub_row?.current_cycle_end || '—'}</span></div>
            <div className="row"><span className="k">Next charge</span><span className="v">{sub_row?.next_charge_at || '—'}</span></div>
          </div>

          <div className="card">
            <h2>Usage this cycle</h2>
            {[
              { k: 'Campaigns',        used: usage.campaigns,                       lim: tier?.max_campaigns           ?? 1 },
              { k: 'Products listed',  used: usage.products,                        lim: tier?.max_products            ?? 10 },
              { k: 'Influencer invites', used: usage.influencer_invites_this_cycle, lim: tier?.max_influencers_per_cycle ?? 5 },
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

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '24px 0 12px' }}>Available plans</h2>
        <div className="grid four">
          {tiers.map(t => {
            const isCurrent = t.tier_key === currentTierKey;
            return (
              <div key={t.tier_key} className={`tier ${isCurrent ? 'current' : ''}`}>
                <div className="name">{t.name}</div>
                <div className="price">{fmtMoney(t.monthly_price_inr)}<span className="per"> / mo</span></div>
                <div className="desc">{t.description || ''}</div>
                <ul>
                  <li>{t.max_campaigns           === -1 ? 'Unlimited' : t.max_campaigns}           campaigns</li>
                  <li>{t.max_sets_per_campaign   === -1 ? 'Unlimited' : t.max_sets_per_campaign}   sets / campaign</li>
                  <li>{t.max_influencers_per_cycle === -1 ? 'Unlimited' : t.max_influencers_per_cycle} influencer invites / cycle</li>
                  <li>{t.max_products            === -1 ? 'Unlimited' : t.max_products}            products</li>
                </ul>
                <div style={{ marginTop: 'auto' }}>
                  {isCurrent ? (
                    <button className="btn" disabled>Current plan</button>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={upgrading === t.tier_key}
                      onClick={() => upgrade(t.tier_key)}
                    >{upgrading === t.tier_key ? 'Processing…' : `Choose ${t.name}`}</button>
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
