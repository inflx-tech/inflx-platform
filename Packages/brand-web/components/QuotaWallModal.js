'use client';

/**
 * QuotaWallModal — Phase A7-brand (extended post-A14 UI polish).
 *
 * Reusable modal triggered when any backend mutation returns one of
 * the three paywall codes:
 *
 *   QUOTA_EXCEEDED       quota gate (A12.1) — has used/limit numbers
 *   FEATURE_LIMIT        config gate (A12.2 niches_limit) — has used/limit
 *   FEATURE_NOT_AVAILABLE boolean gate (A12.3/A12.4/A12.5/A12.6) — binary
 *
 * Standard envelope (all three codes):
 *
 *   { success: false,
 *     error: { code: 'QUOTA_EXCEEDED' | 'FEATURE_NOT_AVAILABLE' | 'FEATURE_LIMIT',
 *              message: '...',
 *              field: '<action>' | '<feature_key>',
 *              details: { action?, used?, limit?, current_tier?,
 *                         feature_key?, config_key?, upgrade_to } }}
 *
 * Pages use it like this:
 *
 *   import { QuotaWallModal, useQuotaWall } from '../../components/QuotaWallModal';
 *   const { quota, showFromResponse, close } = useQuotaWall();
 *   ...
 *   const res = await brandApi.createProduct(form);
 *   if (!res.success) {
 *     if (!showFromResponse(res)) { setErr(res.error?.message); }
 *     return;
 *   }
 *   ...
 *   return (<>
 *     <QuotaWallModal quota={quota} onClose={close} />
 *     ...page body...
 *   </>);
 *
 * Founder will restyle the visual surface later — current look mirrors
 * the wave2 locked palette (white card, ink-on-bg, single accent CTA).
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';

const CSS = `
.qwm-overlay{position:fixed; inset:0; background:rgba(10,10,10,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:24px}
.qwm-card{background:#FFFFFF; border-radius:12px; padding:24px; max-width:480px; width:100%; box-shadow:0 12px 32px rgba(0,0,0,0.18); font-family:'Outfit',ui-sans-serif,system-ui,sans-serif}
.qwm-card h2{font-size:18px; font-weight:600; margin:0 0 6px; color:#0A0A0A}
.qwm-card .sub{font-size:14px; color:#52525B; margin-bottom:16px}
.qwm-row{display:flex; justify-content:space-between; padding:8px 12px; background:#F4F4F5; border-radius:8px; margin-bottom:6px; font-size:14px}
.qwm-row .k{color:#52525B}
.qwm-row .v{font-weight:600; color:#0A0A0A}
.qwm-tiers{display:flex; gap:8px; margin:16px 0; flex-wrap:wrap}
.qwm-tier{padding:6px 12px; border:1px solid #E4E4E7; border-radius:999px; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#0A0A0A}
.qwm-actions{display:flex; gap:8px; justify-content:flex-end; margin-top:16px}
.qwm-btn{padding:8px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid #E4E4E7; background:#FFFFFF; color:#0A0A0A}
.qwm-btn.primary{background:#0A0A0A; color:#FFFFFF; border-color:#0A0A0A; text-decoration:none; display:inline-flex; align-items:center}
.qwm-btn:hover{opacity:0.9}
`;

/**
 * Predicate — returns true if a non-success API response is a paywall
 * (any of: quota wall, feature-not-on-plan, feature config limit).
 * Kept under the historical name `isQuotaError` so existing call sites
 * don't need to change.
 */
const PAYWALL_CODES = new Set(['QUOTA_EXCEEDED', 'FEATURE_NOT_AVAILABLE', 'FEATURE_LIMIT']);
export function isQuotaError(res) {
  return !!(res && res.success === false && res.error && PAYWALL_CODES.has(res.error.code));
}

/**
 * React hook that pages can use to manage modal open/close state.
 * Returns { quota, showFromResponse, show, close }.
 *
 *   - showFromResponse(res): if res is a quota error, shows the modal
 *     and returns true; else returns false (page handles other errors).
 *   - show(details): show with an explicit details object.
 *   - close(): hide.
 */
export function useQuotaWall() {
  const [quota, setQuota] = useState(null);
  const showFromResponse = useCallback((res) => {
    if (!isQuotaError(res)) return false;
    // Some controllers attach the payload in error.details; some inline.
    const d = res.error.details || res.error;
    setQuota({
      code:          res.error.code,
      action:        d.action        || res.error.field || d.feature_key || 'action',
      used:          d.used,
      limit:         d.limit,
      current_tier:  d.current_tier  || 'free',
      upgrade_to:    Array.isArray(d.upgrade_to) ? d.upgrade_to : [],
      feature_key:   d.feature_key,
      config_key:    d.config_key,
      message:       res.error.message,
    });
    return true;
  }, []);
  const show  = useCallback((details) => setQuota(details), []);
  const close = useCallback(()         => setQuota(null),    []);
  return { quota, showFromResponse, show, close };
}

const ACTION_LABEL = {
  createCampaign:    'campaigns',
  createProduct:     'products',
  createSet:         'sets per campaign',
  inviteInfluencer:  'influencer invites per cycle',
};

// Title per code — keeps QUOTA_EXCEEDED copy identical to pre-extension.
const TITLE_BY_CODE = {
  QUOTA_EXCEEDED:        'Plan limit reached',
  FEATURE_LIMIT:         'Feature limit reached',
  FEATURE_NOT_AVAILABLE: 'Feature not on your plan',
};

export function QuotaWallModal({ quota, onClose }) {
  if (!quota) return null;
  const code      = quota.code || 'QUOTA_EXCEEDED';  // default for legacy callers using show(details)
  const title     = TITLE_BY_CODE[code] || 'Plan limit reached';
  const label     = ACTION_LABEL[quota.action] || quota.action;
  // FEATURE_NOT_AVAILABLE is a binary gate — no used/limit numbers to show.
  const showUsage = code !== 'FEATURE_NOT_AVAILABLE';
  // Fallback subtitle when the backend didn't supply a human-readable message.
  const fallbackSub = code === 'FEATURE_NOT_AVAILABLE'
    ? `${label} is not available on your current plan.`
    : `You've hit your ${quota.current_tier?.toUpperCase() || 'current'} plan's ${label} limit.`;
  return (
    <div className="qwm-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="qwm-card" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="sub">{quota.message || fallbackSub}</div>

        {showUsage && (
          <>
            <div className="qwm-row">
              <span className="k">Used</span>
              <span className="v">{quota.used ?? '—'}</span>
            </div>
            <div className="qwm-row">
              <span className="k">Limit on {quota.current_tier?.toUpperCase() || 'current'} plan</span>
              <span className="v">{quota.limit === -1 ? 'Unlimited' : (quota.limit ?? '—')}</span>
            </div>
          </>
        )}

        {quota.upgrade_to?.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#52525B', marginTop: 12, marginBottom: 4 }}>
              Upgrade to unlock {showUsage ? 'more' : 'it'}:
            </div>
            <div className="qwm-tiers">
              {quota.upgrade_to.map(t => <span key={t} className="qwm-tier">{t}</span>)}
            </div>
          </>
        )}

        <div className="qwm-actions">
          <button className="qwm-btn" onClick={onClose}>Close</button>
          <Link href="/dashboard/settings/subscription" className="qwm-btn primary" onClick={onClose}>
            View plans
          </Link>
        </div>
      </div>
    </div>
  );
}
