'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminApi } from '../../../../lib/api';

/**
 * Admin → Influencers → one creator.
 * Contract: features/admin-creator-review-completeness (extends admin-account-review item 3)
 *
 * A creator hands us five facts at signup: her name, her phone, her city, her Instagram
 * handle and — optionally — her YouTube channel. This page used to show one and a half of
 * them. Her name never appeared at all (the header was the handle), "Where" read
 * "Not stated" for anyone who had typed a city, and the YouTube channel she gave us was
 * collected, stored, returned by the API and rendered nowhere.
 *
 * The reach block now carries both platforms side by side, never summed. 8k subscribers
 * and 8k followers are not 16k people.
 */

function Field({ label, value, missing = '—', href, mono }) {
  const has = value != null && value !== '';
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`bg-surface2 border border-border rounded-lg px-3 py-2 text-sm truncate ${has ? 'text-t2' : 'text-t3 italic'} ${mono ? 'tabular-nums' : ''}`}>
        {has
          ? (href
              ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">{value} ↗</a>
              : value)
          : missing}
      </div>
    </div>
  );
}

/** Turn whatever the creator typed into a link that opens. Mirrors youtube.service.js. */
function youtubeUrl(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  const m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(.+)$/i);
  if (m) s = m[1];
  s = s.split(/[?#]/)[0].replace(/\/+$/, '');
  const chan = s.match(/^channel\/(UC[\w-]{20,})$/i);
  if (chan) return `https://www.youtube.com/channel/${chan[1]}`;
  if (/^UC[\w-]{20,}$/.test(s)) return `https://www.youtube.com/channel/${s}`;
  const legacy = s.match(/^(?:user|c)\/([^/]+)$/i);
  const handle = (legacy ? legacy[1] : s).replace(/^@+/, '').split('/')[0];
  return handle ? `https://www.youtube.com/@${handle}` : null;
}

const fmtNum = (n) => (n == null ? null : Number(n).toLocaleString('en-IN'));

export default function InfluencerProfilePage() {
  const { id } = useParams();
  const [influencer, setInfluencer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rescraping, setRescraping] = useState(false);
  const [toast, setToast] = useState('');
  // Wave 1 — per-influencer TDS controls (override + exempt).
  const [tdsInput, setTdsInput] = useState('');
  const [savingTds, setSavingTds] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  async function reload() {
    const res = await adminApi.getInfluencerById(id);
    if (res.success) setInfluencer(res.data?.influencer || res.data);
    return res;
  }

  // Wave 1 — save or clear the per-influencer TDS override + exempt flag.
  async function saveTdsControls({ exempt, clear = false }) {
    const overrideValue = clear ? null : (tdsInput === '' ? null : parseFloat(tdsInput));
    if (overrideValue != null && (isNaN(overrideValue) || overrideValue < 0 || overrideValue > 30)) {
      showToast('Enter a valid TDS % 0–30 (or click Clear)');
      return;
    }
    setSavingTds(true);
    const res = await adminApi.setInfluencerTaxControls(id, overrideValue, exempt);
    setSavingTds(false);
    if (res.success) {
      setInfluencer(prev => ({
        ...prev,
        tds_override_pct: res.data.tds_override_pct,
        tds_exempt:       res.data.tds_exempt,
      }));
      if (!clear && !exempt) setTdsInput('');
      showToast(
        exempt ? 'Marked TDS-exempt — 0% deducted on future withdrawals'
        : clear ? 'TDS override cleared — using global rate'
        :         `TDS override set to ${res.data.tds_override_pct}%`
      );
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  async function rescrape() {
    setRescraping(true);
    const res = await adminApi.rescrapeInfluencer(id);
    // Re-read rather than trusting the rescrape payload. That payload is the SANITISED
    // influencer row — no phone, and a raw i.city that is NULL for app signups — so
    // assigning it straight into state used to wipe the phone and the city off the page
    // the moment an admin pressed Rescrape.
    if (res.success) await reload();
    setRescraping(false);
    if (!res.success) { showToast(res.error?.message || 'Rescrape failed'); return; }

    const yt = res.data?.youtube;
    if (!yt)                     showToast('Instagram figures refreshed');
    else if (!yt.configured)     showToast('Instagram refreshed. YouTube not checked — no Apify token on the server.');
    else if (!yt.found)          showToast(`Instagram refreshed. YouTube: ${yt.reason || 'channel not found'}`);
    else                         showToast('Instagram and YouTube figures refreshed');
  }

  useEffect(() => {
    async function load() {
      const res = await adminApi.getInfluencerById(id);
      setLoading(false);
      if (res.success) setInfluencer(res.data?.influencer || res.data);
      else setError(res.error?.message || 'Failed to load influencer');
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-t3 text-sm">Loading...</div>;
  if (error) return <div className="p-4 bg-red-pale rounded-xl text-red text-sm">{error}</div>;
  if (!influencer) return null;

  const status     = influencer.user_status || influencer.status;
  const isApproved = status === 'approved';
  const isPending  = status === 'pending';
  const waitingDays = influencer.created_at
    ? Math.floor((Date.now() - new Date(influencer.created_at).getTime()) / 86400000)
    : null;

  const displayName = influencer.full_name || influencer.name || null;
  const ytHandle    = influencer.youtube_handle
    ? `@${String(influencer.youtube_handle).replace(/^@+/, '')}`
    : null;
  const ytLink      = influencer.youtube_url || youtubeUrl(influencer.youtube_handle);
  const igLink      = influencer.instagram_url
    || (influencer.instagram_handle ? `https://instagram.com/${influencer.instagram_handle}` : null);
  const place       = [influencer.city, influencer.state].filter(Boolean).join(', ');

  // Reach is stated per platform and never summed — two audiences, two numbers. A figure
  // that has never been checked reads "Never checked", not 0: a confident zero is exactly
  // what made a YouTube-first creator look like a creator with no audience.
  const statCfg = [
    {
      // Measured means BOTH: somebody ran the check, AND it came back with a number.
      // A scrape that returns a shape we cannot read leaves the count null — which is
      // "we looked and learned nothing", not "she has no audience".
      label: 'Instagram',
      value: influencer.scrape_last_run && influencer.followers_count != null
        ? fmtNum(influencer.followers_count)
        : 'Never checked',
      sub: 'followers',
      muted: !(influencer.scrape_last_run && influencer.followers_count != null),
    },
    {
      label: 'Eng. Rate',
      value: influencer.engagement_rate ? `${influencer.engagement_rate}%` : '—',
      sub: 'instagram',
      muted: !influencer.engagement_rate,
    },
    {
      label: 'YouTube',
      value: !influencer.youtube_handle
        ? 'No channel'
        : !influencer.youtube_scrape_last_run
          ? 'Never checked'
          : influencer.youtube_subscribers == null
            ? 'Hidden'
            : fmtNum(influencer.youtube_subscribers),
      sub: 'subscribers',
      muted: !influencer.youtube_scrape_last_run,
    },
    {
      label: 'INFLX',
      value: fmtNum(influencer.inflx_followers || 0),
      sub: 'followers',
      muted: false,
    },
    {
      label: 'Wallet',
      value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(influencer.wallet_balance || 0),
      sub: 'balance',
      muted: false,
    },
    {
      label: 'Status',
      value: status || '—',
      sub: 'account',
      muted: false,
    },
  ];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <a href="/admin/influencers?tab=live" className="text-xs text-t3 hover:text-t2">← All creators</a>
        <span className="text-xs text-t3">·</span>
        <a href="/admin/influencers?tab=pending" className="text-xs text-t3 hover:text-t2">Pending Verification</a>
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-orange-pale flex items-center justify-center text-sm font-bold text-orange-deep font-display flex-shrink-0">
              {(displayName || influencer.instagram_handle || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              {/* Her name leads. The handle is a fact about a platform, not who she is —
                  and an admin approving an account has to be able to see whose it is. */}
              <div className="font-display text-base font-bold text-t1 truncate">
                {displayName || <span className="text-t3 italic">No name on file</span>}
              </div>
              <div className="text-xs text-t3 truncate">
                @{influencer.instagram_handle || '—'}
                {ytHandle && <span> · YouTube {ytHandle}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isPending && waitingDays != null && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-pale text-yellow-700 whitespace-nowrap">
                {waitingDays === 0 ? 'today' : waitingDays === 1 ? 'waiting 1 day' : `waiting ${waitingDays} days`}
              </span>
            )}
            {igLink && (
              <a
                href={igLink}
                target="_blank" rel="noopener noreferrer"
                className="px-3.5 py-2 bg-white border border-border text-t2 font-bold text-xs rounded-xl hover:border-navy hover:text-navy transition-colors whitespace-nowrap">
                Instagram ↗
              </a>
            )}
            {/* Only offered when she gave us a channel. A dead link to nothing is worse
                than no button. */}
            {ytLink && (
              <a
                href={ytLink}
                target="_blank" rel="noopener noreferrer"
                className="px-3.5 py-2 bg-white border border-border text-t2 font-bold text-xs rounded-xl hover:border-red hover:text-red transition-colors whitespace-nowrap">
                YouTube ↗
              </a>
            )}
            <button onClick={rescrape} disabled={rescraping}
              className="px-3.5 py-2 bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs rounded-xl hover:bg-orange-100 disabled:opacity-50 transition-colors whitespace-nowrap">
              {rescraping ? 'Checking…' : influencer.youtube_handle ? '↻ Refresh both' : '↻ Refresh'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {statCfg.map(s => (
            <div key={s.label} className="bg-surface2 rounded-lg p-2.5 text-center">
              <div className="text-[9px] font-bold text-t3 uppercase tracking-wider mb-0.5">{s.label}</div>
              <div className={`font-display font-bold ${s.muted ? 'text-[10px] text-t3 italic leading-tight' : 'text-sm text-t1'}`}>{s.value}</div>
              <div className="text-[8px] text-t3 uppercase tracking-wide mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* What she gave us at signup — the five facts, in the order she was asked for
            them, so a review reads as a review. */}
        <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">What she supplied at signup</div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Full name" value={displayName} missing="Not given" />
          {/* The number is the whole point of an admin looking her up. It was small grey
              text in the header; scraped creators had none at all until the endpoint was
              taught to send it. Contract: features/admin-account-review */}
          <Field label="Phone" value={influencer.phone} missing="No number on file" mono />
          <Field label="Where" value={place} missing="Not stated" />
          <Field label="Registered" value={influencer.created_at ? new Date(influencer.created_at).toLocaleDateString('en-IN') : ''} />
          <Field
            label="Instagram handle"
            value={influencer.instagram_handle ? `@${influencer.instagram_handle}` : ''}
            missing="Not given"
            href={igLink}
          />
          <Field
            label="YouTube channel"
            value={ytHandle}
            missing="Not given"
            href={ytLink}
          />
        </div>

        <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Platform record</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Niche" value={(influencer.niche || []).filter(Boolean).join(', ')} missing="Not stated" />
          <Field label="Language" value={(influencer.language || []).filter(Boolean).join(', ')} missing="Not stated" />
          <Field
            label="Instagram last checked"
            value={influencer.scrape_last_run
              ? `${new Date(influencer.scrape_last_run).toLocaleString('en-IN')}${influencer.followers_count == null ? ' — returned no figures' : ''}`
              : ''}
            missing="Never checked against Instagram"
          />
          <Field
            label="YouTube last checked"
            value={influencer.youtube_scrape_last_run ? new Date(influencer.youtube_scrape_last_run).toLocaleString('en-IN') : ''}
            missing={influencer.youtube_handle ? 'Never checked against YouTube' : 'No channel on file'}
          />
          <Field label="Pending Balance" value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(influencer.pending_balance || 0)} mono />
          <Field label="TDS Status" value={
            influencer.tds_exempt
              ? 'Exempt (0%)'
              : influencer.tds_override_pct != null
                ? `Override ${influencer.tds_override_pct}%`
                : 'Global default'
          } />
        </div>

        {/* The follower numbers on this page are a claim until somebody checks them.
            Saying so is more useful than a confident figure. */}
        {!influencer.scrape_last_run && (
          <div className="mt-4 p-3 bg-gold-pale rounded-lg text-xs text-yellow-700">
            These Instagram figures have never been checked against Instagram. Open the
            handle before trusting them.
          </div>
        )}
        {influencer.scrape_last_run && influencer.followers_count == null && (
          <div className="mt-4 p-3 bg-gold-pale rounded-lg text-xs text-yellow-700">
            Instagram was checked but sent back no follower figure — a brand-new, private
            or renamed account will do that. Open the handle to see it for yourself.
          </div>
        )}
        {influencer.youtube_handle && !influencer.youtube_scrape_last_run && (
          <div className="mt-2 p-3 bg-gold-pale rounded-lg text-xs text-yellow-700">
            She gave us a YouTube channel and it has never been checked. Press Refresh, or
            open the channel — her real audience may not be on Instagram at all.
          </div>
        )}

        {/* Status is read-only here — decided exclusively on Influencers → Pending
            Verification (features/admin-people-pipeline). This page used to carry
            its own standalone approve/reject/suspend button; that was one of three
            places the same decision could be made and they didn't always agree. */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-t3">Account status</span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              status === 'approved' ? 'bg-teal-pale text-teal-deep'
              : status === 'rejected' ? 'bg-red-pale text-red'
              : status === 'suspended' ? 'bg-surface2 text-t3'
              : 'bg-gold-pale text-yellow-700'
            }`}>
              {status || '—'}
            </span>
          </div>
          <p className="text-[11px] text-t3 mt-1.5">
            Read-only. To approve, reject, or change this creator's status, go to{' '}
            <a href="/admin/influencers?tab=pending" className="text-navy font-semibold hover:underline">
              Influencers → Pending Verification →
            </a>
          </p>
        </div>
      </div>

      {/* TDS is about paying someone, not about admitting them. It only means anything
          once she is in. Contract: features/admin-account-review (item 3) */}
      {isApproved && (
      <>
      {/* Wave 1 — Per-influencer TDS controls.
          By default, withdrawal.service deducts the global payment_config.tds_pct.
          Admin can: (a) set a per-influencer override %, or (b) mark exempt (0%)
          when the influencer has filed a TDS exemption certificate. */}
      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-1">TDS Controls</h3>
        <p className="text-xs text-t3 mb-4">
          {influencer.tds_exempt
            ? '🛡️ Currently exempt — no TDS deducted on withdrawals.'
            : influencer.tds_override_pct != null
              ? `Override rate: ${influencer.tds_override_pct}% (instead of the global TDS).`
              : 'Currently using the global TDS rate set in /admin/settings/payments.'}
        </p>

        {/* Exempt toggle */}
        <label className="flex items-center gap-2 mb-3 text-sm text-t2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!influencer.tds_exempt}
            onChange={e => saveTdsControls({ exempt: e.target.checked, clear: false })}
            disabled={savingTds}
            className="w-4 h-4"
          />
          <span><strong>TDS exempt</strong> — for influencers with a valid TDS exemption certificate on file</span>
        </label>

        {/* Override input (disabled when exempt) */}
        <div className="flex gap-2">
          <div className={`flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1 ${influencer.tds_exempt ? 'opacity-40' : ''}`}>
            <input
              type="number"
              value={tdsInput}
              onChange={e => setTdsInput(e.target.value)}
              placeholder={influencer.tds_override_pct != null
                ? String(influencer.tds_override_pct)
                : 'global default'}
              min="0"
              max="30"
              step="0.5"
              disabled={influencer.tds_exempt}
              className="flex-1 px-3 py-2.5 text-sm outline-none"
            />
            <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
          </div>
          <button
            onClick={() => saveTdsControls({ exempt: false, clear: false })}
            disabled={savingTds || !tdsInput || influencer.tds_exempt}
            className="px-4 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {savingTds ? 'Saving…' : 'Save Override'}
          </button>
          <button
            onClick={() => saveTdsControls({ exempt: false, clear: true })}
            disabled={savingTds || influencer.tds_override_pct == null}
            className="px-4 py-2.5 bg-white border-2 border-border2 text-t2 font-bold text-xs rounded-xl hover:bg-surface2 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>
      </>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 max-w-sm">{toast}</div>}
    </div>
  );
}
