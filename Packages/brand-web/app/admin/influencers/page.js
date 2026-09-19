'use client';

/**
 * Admin -> Influencers.
 * Contract: features/admin-people-pipeline
 *
 * One pipeline, four stages, instead of four unrelated screens. This page used to be
 * only the "Live" directory (built for features/admin-account-review). It now hosts
 * everything that used to live at Marketing -> Triage (influencer rows), Marketing ->
 * Invitations, and Marketing -> Verifications (influencer rows) as tabs on the same
 * page, plus the old standalone "Add Lead" nav item folded in as a button/modal on the
 * Leads tab.
 *
 * The Pending Verification tab is now the ONLY place an influencer account gets
 * approved or rejected — the Live tab (this page's original content) and the detail
 * page (`[id]/page.js`) show a read-only status badge only. See 01-spec.md for the
 * creator_profiles <-> influencers/users merge this closes.
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, marketingApi, fmtNum, fmtRupees } from '../../../lib/api';

const TABS = [
  { key: 'leads',   label: 'Leads' },
  { key: 'invited', label: 'Invited' },
  { key: 'pending', label: 'Pending Verification' },
  { key: 'live',    label: 'Live' },
  // Item 3b — changed handles waiting for the ownership check + measurement flags.
  // Contract: features/item3b-social-numbers
  { key: 'handles', label: 'Handle checks' },
];

// ─── shared bits ────────────────────────────────────────────────────────────

function TierBadge({ tier }) {
  if (!tier) return null;
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">
      {tier}
    </span>
  );
}

function ChannelDots({ phone, email, whatsapp }) {
  return (
    <div className="flex gap-1 items-center">
      <span className={`text-[10px] ${phone ? 'opacity-100' : 'opacity-20'}`} title={phone || 'no phone'}>📞</span>
      <span className={`text-[10px] ${email ? 'opacity-100' : 'opacity-20'}`} title={email || 'no email'}>✉️</span>
      <span className={`text-[10px] ${whatsapp ? 'opacity-100' : 'opacity-20'}`} title={whatsapp || 'no whatsapp'}>💬</span>
    </div>
  );
}

// creator-handle-change-review — one "old → new" line per platform, shared by the Pending
// Verification row (changed since signup) and the Handle checks tab (approved creator's change).
// Instagram handles carry the @, YouTube handles don't; a missing side renders as "—".
// Contract: features/creator-handle-change-review
const PLATFORM_LABEL = { instagram: 'Instagram', youtube: 'YouTube' };
const platformLabel = (p) => PLATFORM_LABEL[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : '');
const bareHandle = (h) => (h == null ? '' : String(h).trim().replace(/^@+/, ''));
const showHandle = (platform, h) => {
  const b = bareHandle(h);
  if (!b) return '—';
  return platform === 'instagram' ? `@${b}` : b;
};
const channelUrl = (platform, h, url) => {
  if (url) return url;
  const b = bareHandle(h);
  if (!b) return null;
  return platform === 'youtube' ? `https://youtube.com/@${b}` : `https://instagram.com/${b}`;
};

function HandleChange({ platform, from, to }) {
  return (
    <div className="font-mono text-[11.5px] text-t1">
      <span className="inline-block w-[78px] font-sans text-[10.5px] font-bold text-t3">{platformLabel(platform)}</span>
      <span>{showHandle(platform, from)}</span>
      <span className="mx-1.5 font-bold text-orange-deep">→</span>
      <span>{showHandle(platform, to)}</span>
    </div>
  );
}

function LeadStatusBadge({ status }) {
  const cfg = {
    not_contacted: 'bg-surface2 text-t3',
    contacted:     'bg-gold-pale text-yellow-700',
    replied:       'bg-teal-pale text-teal-deep',
    interested:    'bg-teal-pale text-teal-deep',
    negotiating:   'bg-orange/15 text-orange',
    registered:    'bg-teal-pale text-teal-deep',
    dead:          'bg-red-pale text-red',
    paused:        'bg-surface2 text-t3',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status || 'unknown'}
    </span>
  );
}

function LiveStatusBadge({ status }) {
  const cfg = {
    approved:  'bg-teal-pale text-teal-deep',
    pending:   'bg-gold-pale text-yellow-700',
    rejected:  'bg-red-pale text-red',
    suspended: 'bg-surface2 text-t3',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status || '--'}
    </span>
  );
}

// ─── Add Lead modal (folded in from the old /admin/marketing/add) ─────────────

function AddLeadModal({ onClose, onCreated }) {
  const [handle, setHandle] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [niche, setNiche] = useState('');
  const [subNiche, setSubNiche] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);

  async function submit(force_action) {
    setSubmitting(true);
    setError(null);
    const payload = {
      target_type: 'influencer',
      handle, full_name: fullName,
      city, state: stateVal,
      niche, sub_niche: subNiche,
      phone, email, whatsapp,
      notes,
    };
    if (force_action) payload.force_action = force_action;
    const res = await marketingApi.intakeLead(payload);
    setSubmitting(false);
    if (!res.success) { setError(res.error?.message || 'Failed'); return; }
    if (res.data.action === 'requires_decision') { setConflict(res.data); return; }
    setConflict(null);
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[440px] shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-base font-bold text-t1 mb-1">Add Lead — Influencer</h3>
        <p className="text-xs text-t3 mb-4">Paste a handle to start enrichment. Inflx will scrape, score, and add it to this list within 2-3 minutes.</p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input placeholder="Instagram handle *" value={handle} onChange={e => setHandle(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs col-span-2 font-mono" />
          <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs col-span-2" />
          <input placeholder="City" value={city} onChange={e => setCity(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="State" value={stateVal} onChange={e => setStateVal(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Niche" value={niche} onChange={e => setNiche(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Sub-niche" value={subNiche} onChange={e => setSubNiche(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="WhatsApp (if different)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs col-span-2" />
          <textarea placeholder="Notes (internal)" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="border border-border2 rounded-lg px-3 py-2 text-xs col-span-2" />
        </div>

        {error && <div className="mb-3 p-2.5 bg-red-pale text-red text-xs rounded-lg">{error}</div>}

        {conflict && (
          <div className="mb-3 bg-gold-pale border border-yellow-700/30 rounded-lg p-3 space-y-2">
            <div className="font-bold text-yellow-700 text-xs">{conflict.message}</div>
            <div className="flex gap-2 flex-wrap pt-1">
              {conflict.conflict.options.includes('revive') && (
                <button onClick={() => submit('revive')} disabled={submitting}
                  className="bg-teal-deep text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40">Revive</button>
              )}
              {conflict.conflict.options.includes('force_refresh') && (
                <button onClick={() => submit('force_refresh')} disabled={submitting}
                  className="bg-orange text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40">Force refresh</button>
              )}
              {conflict.conflict.options.includes('update_manual_only') && (
                <button onClick={() => submit('update_manual_only')} disabled={submitting}
                  className="bg-navy text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40">Update fields only</button>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => submit(null)} disabled={!handle || submitting}
            className="flex-1 py-2.5 bg-orange text-white font-bold rounded-xl text-sm disabled:opacity-40">
            {submitting ? 'Adding…' : 'Add Lead'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Import (CSV) modal — restored from the old /admin/marketing/add's
// Bulk mode. Rows are parsed client-side into the shape
// marketingApi.intakeLeadBulk / POST /admin/marketing/leads/intake/bulk
// expects, then sent as one request. Influencers and brands can be mixed in
// the same paste (matches the locked mockup's copy). ─────────────────────

function parseBulkLeadRows(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    const [_type, _handle, _name, _city, _category, _subcategory, _phone, _email] = parts;
    const type = (_type || '').toLowerCase();
    if (!['influencer', 'brand'].includes(type)) continue;
    if (!_handle) continue;
    rows.push(type === 'brand' ? {
      target_type: 'brand',
      handle: _handle,
      business_name: _name || '',
      city: _city || '',
      industry: _category || '',
      sub_industry: _subcategory || '',
      phone: _phone || '',
      email: _email || '',
    } : {
      target_type: 'influencer',
      handle: _handle,
      full_name: _name || '',
      city: _city || '',
      niche: _category || '',
      sub_niche: _subcategory || '',
      phone: _phone || '',
      email: _email || '',
    });
  }
  return rows;
}

function BulkImportModal({ onClose, onImported }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function submit() {
    const rows = parseBulkLeadRows(text);
    if (rows.length === 0) {
      setError('No valid rows parsed. Format: type,handle,name,city,category,subcategory,phone,email');
      return;
    }
    setSubmitting(true); setError(null); setResult(null);
    const res = await marketingApi.intakeLeadBulk(rows);
    setSubmitting(false);
    if (!res.success) { setError(res.error?.message || 'Import failed'); return; }
    setResult(res.data);
    onImported();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[560px] shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-base font-bold text-t1 mb-1">Bulk Import — Leads (CSV paste)</h3>
        <p className="text-xs text-t3 mb-3">Add many leads at once — influencers and brands can be mixed in the same paste.</p>
        <div className="text-xs text-t3 mb-2 bg-surface2 border border-border rounded-lg px-3 py-2">
          One row per line: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-border2">type,handle,name,city,category,subcategory,phone,email</span>
          <br />
          Where <span className="font-bold">type</span> is <span className="font-mono">influencer</span> or <span className="font-mono">brand</span>. Empty fields are allowed.
        </div>
        <textarea rows={10} value={text} onChange={e => setText(e.target.value)}
          placeholder={`influencer,aishbakes,Aish,Hyderabad,food,baking,9876543210,aish@bakes.com\nbrand,goldencafe,Golden Cafe,Bangalore,restaurant,cafe,9999999999,info@goldencafe.in`}
          className="w-full text-xs border border-border rounded-lg px-3 py-2 font-mono mb-3" />

        {error && <div className="mb-3 p-2.5 bg-red-pale text-red text-xs rounded-lg">{error}</div>}

        {result && (
          <div className="mb-3 bg-teal-pale border border-teal-deep/30 rounded-lg p-3 text-xs text-teal-deep">
            <div className="font-bold mb-2">Import complete</div>
            <div className="grid grid-cols-5 gap-2">
              <div><span className="text-t3">Total:</span> <span className="font-bold">{result.total}</span></div>
              <div><span className="text-t3">Created:</span> <span className="font-bold text-teal-deep">{result.created}</span></div>
              <div><span className="text-t3">Re-tagged:</span> <span className="font-bold text-teal-deep">{result.updated ?? 0}</span></div>
              <div><span className="text-t3">Duplicates:</span> <span className="font-bold text-yellow-700">{result.duplicates_skipped}</span></div>
              <div><span className="text-t3">Invalid:</span> <span className="font-bold text-red">{result.invalid}</span></div>
            </div>
            {result.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-t2">View errors</summary>
                <ul className="text-[11px] mt-1 space-y-0.5 text-t2 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={submit} disabled={!text.trim() || submitting}
            className="flex-1 py-2.5 bg-orange text-white font-bold rounded-xl text-sm hover:bg-orange/90 transition disabled:opacity-40">
            {submitting ? 'Importing…' : 'Import'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LEADS tab (filtered to target_type=influencer) ────────────────────────

const STATUS_OPTIONS = [
  { key: '',              label: 'All statuses' },
  { key: 'not_contacted', label: 'Not contacted' },
  { key: 'contacted',     label: 'Contacted' },
  { key: 'replied',       label: 'Replied' },
  { key: 'interested',    label: 'Interested' },
  { key: 'negotiating',   label: 'Negotiating' },
  { key: 'registered',    label: 'Registered' },
  { key: 'dead',          label: 'Dead' },
  { key: 'paused',        label: 'Paused' },
];

function LeadsTab({ openAddLead, onOpenAddLeadHandled }) {
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [city, setCity] = useState('');
  const [niche, setNiche] = useState('');
  const [subNiche, setSubNiche] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('priority_score_desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState({ cities: [], niches: [], sub_niches: [], creator_tiers: [] });
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await marketingApi.getFilterOptions();
      if (r.success && r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
        setOpts(o => ({ ...o, ...r.data }));
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketingApi.listLeads({
      target_type: 'influencer',
      status, min_score: minScore, city,
      category: niche, sub_category: subNiche, tier,
      search, sort, page, limit,
    });
    setLoading(false);
    if (res.success) {
      setRows(Array.isArray(res.data) ? res.data : []);
      setTotal(res.meta?.total || 0);
    }
  }, [status, minScore, city, niche, subNiche, tier, search, sort, page, limit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openAddLead) { setShowAdd(true); onOpenAddLeadHandled(); }
  }, [openAddLead, onOpenAddLeadHandled]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  function clearAll() {
    setStatus(''); setMinScore(''); setCity(''); setNiche(''); setSubNiche(''); setTier(''); setSearch(''); setSearchInput(''); setPage(1);
  }
  const hasFilters = status || minScore || city || niche || subNiche || tier || search;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-border p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            {STATUS_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={minScore} onChange={e => { setMinScore(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            <option value="">Any score</option>
            <option value="70">High (70+)</option>
            <option value="40">Mid+ (40+)</option>
            <option value="1">Scored (1+)</option>
          </select>
          <select value={city} onChange={e => { setCity(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[140px]">
            <option value="">All cities</option>
            {opts.cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={niche} onChange={e => { setNiche(e.target.value); setSubNiche(''); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[160px]">
            <option value="">All niches</option>
            {opts.niches.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={subNiche} onChange={e => { setSubNiche(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[160px]">
            <option value="">All sub-niches</option>
            {opts.sub_niches.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tier} onChange={e => { setTier(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            <option value="">All tiers</option>
            {opts.creator_tiers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex">
            <input type="text" placeholder="Handle or name" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="text-xs border border-border rounded-l-lg px-2 py-1.5 w-40" />
            <button className="text-xs bg-navy text-white px-3 rounded-r-lg">Search</button>
          </form>
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-orange font-semibold hover:underline">Clear all</button>
          )}
          <button onClick={() => setShowBulk(true)}
            className="ml-auto text-xs bg-white border border-border2 text-t2 px-3.5 py-1.5 rounded-lg font-bold hover:bg-surface2 transition">
            Bulk Import (CSV)
          </button>
          <button onClick={() => setShowAdd(true)}
            className="text-xs bg-orange text-white px-3.5 py-1.5 rounded-lg font-bold hover:bg-orange/90 transition">
            + Add Lead
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-t3 text-sm">
            No leads match these filters.{' '}
            <button onClick={() => setShowAdd(true)} className="text-orange font-semibold hover:underline">Add your first lead →</button>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-surface2 text-t3">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Handle</th>
                <th className="text-left px-3 py-2 font-bold">Name</th>
                <th className="text-left px-3 py-2 font-bold">City</th>
                <th className="text-left px-3 py-2 font-bold">Niche</th>
                <th className="text-left px-3 py-2 font-bold">Tier</th>
                <th className="text-right px-3 py-2 font-bold">Followers</th>
                <th className="text-right px-3 py-2 font-bold">Score</th>
                <th className="text-left px-3 py-2 font-bold">Status</th>
                <th className="text-left px-3 py-2 font-bold">Channels</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface2/50">
                  <td className="px-3 py-2 font-mono text-[11px]">@{r.handle}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]">{r.name || '—'}</td>
                  <td className="px-3 py-2">{r.city || '—'}</td>
                  <td className="px-3 py-2 text-t2">{r.category || '—'}{r.sub_category ? ' / ' + r.sub_category : ''}</td>
                  <td className="px-3 py-2"><TierBadge tier={r.tier} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{(r.followers_count || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">{Number(r.priority_score || 0).toFixed(0)}</td>
                  <td className="px-3 py-2"><LeadStatusBadge status={r.outreach_status} /></td>
                  <td className="px-3 py-2"><ChannelDots phone={r.phone} email={r.email} whatsapp={r.whatsapp} /></td>
                  <td className="px-3 py-2 text-right">
                    <a href={`/admin/marketing/leads/influencer/${r.id}`} className="text-orange font-semibold text-[11px] hover:underline">Open →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-xs">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-border bg-white disabled:opacity-40 hover:bg-surface2">‹ Prev</button>
          <span className="px-3 py-1.5 text-t3">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-border bg-white disabled:opacity-40 hover:bg-surface2">Next ›</button>
        </div>
      )}

      {showAdd && (
        <AddLeadModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setPage(1); load(); }} />
      )}
      {showBulk && (
        <BulkImportModal onClose={() => setShowBulk(false)} onImported={() => { setPage(1); load(); }} />
      )}
    </div>
  );
}

// ─── INVITED tab (was /admin/marketing/invitations) ────────────────────────

const INVITE_TABS = [
  { key: 'pending',   label: 'New',       icon: '🔔' },
  { key: 'contacted', label: 'Contacted', icon: '📞' },
  { key: 'converted', label: 'Converted', icon: '✅' },
  { key: 'expired',   label: 'Expired',   icon: '⌛' },
  { key: 'declined',  label: 'Declined',  icon: '❌' },
];

function InvitedTab() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await adminApi.listInvitations(tab);
    setLoading(false);
    if (res.success) setRows(res.data?.invitations || []);
    else setError(res.error?.message || 'Failed to load invitations');
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-border p-1.5 inline-flex gap-1">
        {INVITE_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-gold/15 text-gold' : 'text-t3 hover:bg-surface2'}`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red/10 border border-red/30 rounded-xl p-3 text-xs text-red">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-t3 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="text-4xl mb-2">{tab === 'pending' ? '🎉' : '—'}</div>
          <div className="text-sm font-semibold text-t1">{tab === 'pending' ? 'No new invitations' : `No ${tab} invitations`}</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden divide-y divide-border">
          {rows.map(r => <InvitationRow key={r.id} row={r} onChange={load} tab={tab} />)}
        </div>
      )}
    </div>
  );
}

function InvitationRow({ row, onChange, tab }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function doContacted() {
    setBusy(true); setErr(null);
    const res = await adminApi.markInvitationContacted(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Failed'); return; }
    onChange();
  }

  async function doExpire() {
    if (!confirm(`Mark invitation for @${row.ig_handle} as expired? Brand will see "we tried but couldn't reach them".`)) return;
    setBusy(true); setErr(null);
    const res = await adminApi.expireInvitation(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Failed'); return; }
    onChange();
  }

  const waitingDays = row.invited_at
    ? Math.floor((Date.now() - new Date(row.invited_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-3 flex items-start gap-3">
      {row.profile_pic_url ? (
        <img src={row.profile_pic_url} alt="" className="w-10 h-10 rounded-full bg-surface2 object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-[10px] font-bold text-t3 flex-shrink-0">
          {(row.ig_handle || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <a href={`https://instagram.com/${row.ig_handle}`} target="_blank" rel="noreferrer" className="font-semibold text-sm text-t1 hover:text-orange">@{row.ig_handle}</a>
          {row.full_name && <span className="text-xs text-t3">· {row.full_name}</span>}
          {row.follower_tier && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">{row.follower_tier}</span>}
          {row.followers_count > 0 && <span className="text-[10px] text-t3">{fmtNum(row.followers_count)} followers</span>}
        </div>
        <div className="text-[11px] text-t3 mb-1">
          From <span className="font-semibold text-t1">{row.brand_name || '(unknown brand)'}</span>
          {row.proposed_fee && <> · proposed fee <span className="font-semibold text-t1">{fmtRupees(row.proposed_fee)}</span></>}
          {waitingDays != null && <> · waiting {waitingDays}d</>}
        </div>
        <div className="text-[11px] text-t3 flex flex-wrap gap-x-3 gap-y-0.5">
          {row.bio_email && <span>✉ <a href={`mailto:${row.bio_email}`} className="hover:text-orange">{row.bio_email}</a></span>}
          {row.bio_phone && <span>📞 <a href={`tel:${row.bio_phone}`} className="hover:text-orange">{row.bio_phone}</a></span>}
        </div>
        {row.brand_message && (
          <div className="mt-1.5 text-[11px] text-t2 bg-surface2 border border-border rounded px-2 py-1.5">
            <span className="font-bold text-t3 mr-1">Brand message:</span>{row.brand_message}
          </div>
        )}
        {row.contacted_at && <div className="mt-1 text-[10px] text-t3">Contacted {new Date(row.contacted_at).toLocaleString()}</div>}
        {err && <div className="mt-1 text-[11px] text-red">{err}</div>}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {tab === 'pending' && (
          <>
            <button onClick={doContacted} disabled={busy} className="px-2.5 py-1 rounded text-[11px] font-bold bg-teal-deep text-white hover:bg-teal-deep/90 disabled:opacity-50">✓ Mark contacted</button>
            <button onClick={doExpire} disabled={busy} className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-red/10 hover:text-red">Expire</button>
          </>
        )}
        {tab === 'contacted' && (
          <button onClick={doExpire} disabled={busy} className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-red/10 hover:text-red">Give up · Expire</button>
        )}
      </div>
    </div>
  );
}

// ─── PENDING VERIFICATION tab (was /admin/marketing/verifications) ─────────
// The ONLY place an influencer account gets approved or rejected — resolves
// creator_profiles.verification_status AND the linked influencer/user status
// in one backend transaction (01-spec.md).

const VERIFY_STATUS_TABS = [
  { key: 'claimed',  label: 'Pending',  icon: '⏳' },
  { key: 'verified', label: 'Verified', icon: '✅' },
  { key: 'rejected', label: 'Rejected', icon: '❌' },
];

function PendingVerificationTab() {
  const [tab, setTab] = useState('claimed');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // creator-handle-change-review V2: the green "Verified and approved." line after a verify.
  // Lives here (not in the row) because the verified row leaves this list on reload.
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await adminApi.listVerifications(tab);
    setLoading(false);
    if (res.success) setRows(res.data?.verifications || []);
    else setError(res.error?.message || 'Failed to load verification queue');
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setNotice(null); }, [tab]);

  const clusters = groupByClaimUser(rows);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-border p-4">
        <p className="text-xs text-t3">
          Influencers who signed up and claimed a handle. Call them, confirm identity, then
          verify or reject. This is the only place an influencer account gets approved.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-border p-1.5 inline-flex gap-1">
        {VERIFY_STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-gold/15 text-gold' : 'text-t3 hover:bg-surface2'}`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red/10 border border-red/30 rounded-xl p-3 text-xs text-red">{error}</div>}
      {notice && (
        <div className="bg-teal-pale border border-teal-deep/30 rounded-xl p-3 text-xs text-teal-deep flex items-start justify-between gap-3">
          <span><b>Verified and approved.</b> {notice}</span>
          <button onClick={() => setNotice(null)} className="text-teal-deep/70 hover:text-teal-deep font-bold flex-shrink-0" aria-label="Dismiss">×</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-t3 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="text-4xl mb-2">{tab === 'claimed' ? '🎉' : '—'}</div>
          <div className="text-sm font-semibold text-t1">
            {tab === 'claimed' ? 'Queue clear — no pending verifications' : `No ${tab} profiles`}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map(cluster => (
            <ClusterCard key={cluster.key} cluster={cluster} onChange={load} onNotice={setNotice} readOnly={tab !== 'claimed'} />
          ))}
        </div>
      )}
    </div>
  );
}

function groupByClaimUser(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.claim_user_id || `solo:${r.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key, claim_user_id: r.claim_user_id, claim_user_name: r.claim_user_name,
        claim_user_phone: r.claim_user_phone, influencer_ig: r.influencer_ig, influencer_yt: r.influencer_yt,
        rows: [],
      });
    }
    map.get(key).rows.push(r);
  }
  return Array.from(map.values());
}

function ClusterCard({ cluster, onChange, onNotice, readOnly }) {
  const isConflict = cluster.rows.length > 1;
  // Rows arrive ordered by claim_requested_at ASC, so the first row is the earliest request.
  const requestedAt = cluster.rows.find(r => r.claim_requested_at)?.claim_requested_at;
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isConflict ? 'border-orange/40' : 'border-border'}`}>
      <div className={`px-3 py-2 ${isConflict ? 'bg-orange/10' : 'bg-surface2'} border-b border-border`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-t1">{cluster.claim_user_name || '—'}</span>
            {cluster.claim_user_phone && <span className="text-[10px] text-t3 font-mono">{cluster.claim_user_phone}</span>}
            {requestedAt && <span className="text-[10px] text-t3 font-mono">· requested {new Date(requestedAt).toLocaleString('en-IN')}</span>}
          </div>
          {isConflict && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange text-white whitespace-nowrap">
              ⚠ CONFLICT — {cluster.rows.length} candidates
            </span>
          )}
        </div>
        {isConflict && (
          <p className="mt-1 text-[10px] text-t3 leading-relaxed">
            This user matched multiple scraped profiles. Verifying one will auto-reject the others.
          </p>
        )}
      </div>
      <div className="divide-y divide-border">
        {cluster.rows.map(r => <ProfileRow key={r.id} row={r} onChange={onChange} onNotice={onNotice} readOnly={readOnly} />)}
      </div>
    </div>
  );
}

function ProfileRow({ row, onChange, onNotice, readOnly }) {
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [err, setErr] = useState(null);

  // creator-handle-change-review: the row leads with what is to be verified NOW — the creator's
  // current channels. Older rows (no influencer row yet) fall back to the claimed profile.
  const accounts = (row.current_accounts && row.current_accounts.length > 0)
    ? row.current_accounts
    : [
        row.ig_handle && { platform: 'instagram', handle: row.ig_handle },
        row.youtube_handle && { platform: 'youtube', handle: row.youtube_handle },
      ].filter(Boolean);
  const changed = Array.isArray(row.changed) ? row.changed : [];
  const currentIg = accounts.find(a => a.platform === 'instagram');
  const currentYt = accounts.find(a => a.platform === 'youtube');
  const claimedIgDiffers = !!row.ig_handle && bareHandle(row.ig_handle).toLowerCase() !== bareHandle(currentIg?.handle).toLowerCase();
  const claimedYtDiffers = !!row.youtube_handle && bareHandle(row.youtube_handle).toLowerCase() !== bareHandle(currentYt?.handle).toLowerCase();
  const handleNames = accounts.map(a => showHandle(a.platform, a.handle)).join(' and ');

  async function doVerify() {
    if (!confirm(`Verify ${handleNames || `@${row.ig_handle}`} as this creator's channels and approve the account?`)) return;
    setBusy(true); setErr(null);
    const res = await adminApi.verifyCreator(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Verify failed'); return; }
    if (onNotice) {
      const renamed = res.data?.record_renamed;
      onNotice(
        `${handleNames || `@${row.ig_handle}`} ${accounts.length > 1 ? 'are' : 'is'} now hers on INFLX; measuring starts now — numbers appear within the hour.` +
        (renamed === false ? ' (the signup record kept its old handle: another profile already uses the new one)' : '')
      );
    }
    onChange();
  }

  async function doReject() {
    if (!rejectReason.trim()) { setErr('Reason required'); return; }
    setBusy(true); setErr(null);
    const res = await adminApi.rejectCreator(row.id, rejectReason.trim());
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Reject failed'); return; }
    setShowReject(false); setRejectReason('');
    onChange();
  }

  async function doReset() {
    if (!confirm(`Reset @${row.ig_handle} back to unclaimed? Another user will be able to claim it.`)) return;
    setBusy(true); setErr(null);
    const res = await adminApi.resetCreator(row.id);
    setBusy(false);
    if (!res.success) { setErr(res.error?.message || 'Reset failed'); return; }
    onChange();
  }

  const isPending = !row.followers_count && !row.full_name;

  return (
    <div className="p-3 flex items-start gap-3">
      {row.profile_pic_url ? (
        <img src={row.profile_pic_url} alt="" className="w-10 h-10 rounded-full bg-surface2 object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-[10px] font-bold text-t3 flex-shrink-0">
          {bareHandle(currentIg?.handle || row.ig_handle || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* Current channels — large, linked, each with a small mono platform label */}
        <div className="flex items-center gap-x-3.5 gap-y-1 flex-wrap mb-0.5">
          {accounts.map(a => {
            const href = channelUrl(a.platform, a.handle, a.url);
            const label = <span className="font-mono text-[10px] uppercase tracking-wider text-t3 mr-1">{platformLabel(a.platform)}</span>;
            const text = showHandle(a.platform, a.handle);
            return (
              <span key={a.platform} className="inline-flex items-center">
                {label}
                {href
                  ? <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-sm text-t1 hover:text-orange">{text}</a>
                  : <span className="font-semibold text-sm text-t1">{text}</span>}
              </span>
            );
          })}
          {accounts.length === 0 && <span className="font-semibold text-sm text-t3">No channels on file</span>}
          {changed.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange/10 text-orange-deep">CHANGED SINCE SIGNUP</span>
          )}
          {(changed.length === 0 || row.verification_status !== 'claimed') && <VerifyStatusPill status={row.verification_status} />}
        </div>

        {/* Amber block — only when she changed a channel after signing up (mockup V1) */}
        {changed.length > 0 && (
          <div className="mt-2 rounded-lg border border-orange/40 bg-orange/10 px-2.5 py-2 space-y-1">
            <div className="text-[11.5px] font-bold text-orange-deep">She changed her channels after signing up</div>
            {changed.map(c => <HandleChange key={c.platform} platform={c.platform} from={c.from} to={c.to} />)}
            <p className="text-[11px] text-orange-deep">Check the new ones belong to her before verifying. Verify approves the new channels and starts measuring them.</p>
          </div>
        )}

        {/* Signup profile — the scraped facts of the profile she claimed with */}
        <div className="mt-1.5 text-[11px] text-t3 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-bold text-t2">Signup profile</span>
          {claimedIgDiffers && <span>@{bareHandle(row.ig_handle)}</span>}
          {claimedYtDiffers && <span>YT: {bareHandle(row.youtube_handle)}</span>}
          {row.full_name && <span>{row.full_name}</span>}
          {row.followers_count > 0 && <span>{fmtNum(row.followers_count)} followers</span>}
          {row.follower_tier && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gold/10 text-yellow-700 border border-gold/30">{row.follower_tier}</span>}
          {isPending && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gold-pale text-yellow-700">SCRAPE PENDING</span>}
          {row.bio_email && <span>✉ {row.bio_email}</span>}
          {row.bio_phone && <span>📞 {row.bio_phone}</span>}
        </div>
        {row.rejection_reason && (
          <div className="mt-1 text-[11px] text-red bg-red/5 border border-red/20 rounded px-2 py-1">Rejected: {row.rejection_reason}</div>
        )}
        {err && <div className="mt-1 text-[11px] text-red">{err}</div>}
        {showReject && !readOnly && (
          <div className="mt-2 flex items-stretch gap-2">
            <input type="text" placeholder="Why rejecting? (visible to admins)" value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs" disabled={busy} />
            <button onClick={doReject} disabled={busy} className="px-3 py-1 rounded text-xs font-bold bg-red text-white disabled:opacity-50">Confirm reject</button>
            <button onClick={() => { setShowReject(false); setRejectReason(''); setErr(null); }} disabled={busy} className="px-3 py-1 rounded text-xs font-bold bg-surface2 text-t3">Cancel</button>
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="flex gap-1 flex-shrink-0">
          {row.verification_status === 'claimed' && !showReject && (
            <>
              <button onClick={doVerify} disabled={busy} className="px-2.5 py-1 rounded text-[11px] font-bold bg-teal-deep text-white hover:bg-teal-deep/90 disabled:opacity-50">✓ Verify & approve</button>
              <button onClick={() => setShowReject(true)} disabled={busy} className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-red/10 hover:text-red">Reject</button>
            </>
          )}
        </div>
      )}
      {readOnly && row.verification_status === 'rejected' && (
        <button onClick={doReset} disabled={busy} className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface2 text-t2 hover:bg-gold/15 hover:text-gold flex-shrink-0">Reset → unclaimed</button>
      )}
    </div>
  );
}

function VerifyStatusPill({ status }) {
  const cfg = {
    claimed:   { c: 'bg-gold-pale text-yellow-700', label: 'CLAIMED' },
    verified:  { c: 'bg-teal-pale text-teal-deep',  label: 'VERIFIED' },
    rejected:  { c: 'bg-red-pale text-red',         label: 'REJECTED' },
    unclaimed: { c: 'bg-surface2 text-t3',          label: 'UNCLAIMED' },
  };
  const s = cfg[status] || cfg.unclaimed;
  return <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${s.c}`}>{s.label}</span>;
}

// ─── LIVE tab (this page's original directory content) ─────────────────────
// Status is read-only here — sourced from what Pending Verification decided.

const LIVE_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'approved',  label: 'Approved' },
  { key: 'pending',   label: 'Pending' },
  { key: 'rejected',  label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

const SAMPLE_CSV = `full_name,phone,instagram_handle,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language
Priya Sharma,+919000000001,priyacooks,micro,180000,6.2,Food,Lifestyle,Vijayawada,Andhra Pradesh,female,Instagram,22000,11160,890,true,Telugu;English
Arun Mehta,+919000000002,arunfashion,macro,240000,4.8,Fashion,Lifestyle,Mumbai,Maharashtra,male,Instagram,35000,11520,650,true,Hindi;English`;

function StatCard({ label, value, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600', red: 'text-red' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'}`}>{value}</div>
    </div>
  );
}

const fmtLiveNum = (n) => (n == null ? '--' : Number(n).toLocaleString('en-IN'));

function LiveTab() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [influencers, setInfluencers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Suspend / Reinstate — already-approved (or already-suspended) creators
  // only. This is NOT a second approval path: the buttons below only ever
  // render for status === 'approved' (Suspend) or status === 'suspended'
  // (Reinstate) — a 'pending' row gets neither, so it can't be moved to
  // 'approved' from here. Pending Verification stays the only place that
  // decision happens.
  const [suspendTarget, setSuspendTarget] = useState(null); // influencer row
  const [suspendReason, setSuspendReason] = useState('');
  const [reinstateTarget, setReinstateTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getInfluencers(tab, search, page);
    setLoading(false);
    if (res.success) {
      setInfluencers(res.data?.influencers || []);
      setSummary(res.data?.summary || null);
      const total = res.meta?.total || 0;
      const limit = res.meta?.limit || 20;
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    } else {
      setError(res.error?.message || 'Could not load creators');
    }
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'influencer_upload_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    const res = await adminApi.bulkUploadInfluencers(file);
    setUploading(false);
    if (res.success) { setResult(res.data); setFile(null); load(); }
    else setError(res.error?.message || 'Upload failed');
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function confirmSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setActionBusy(true);
    const res = await adminApi.updateInfluencerStatus(suspendTarget.id, { status: 'suspended', reason: suspendReason.trim() });
    setActionBusy(false);
    if (res.success) { showToast('Creator suspended'); setSuspendTarget(null); setSuspendReason(''); load(); }
    else showToast(res.error?.message || 'Failed to suspend');
  }

  async function confirmReinstate() {
    if (!reinstateTarget) return;
    setActionBusy(true);
    const res = await adminApi.updateInfluencerStatus(reinstateTarget.id, { status: 'approved' });
    setActionBusy(false);
    if (res.success) { showToast('Creator reinstated'); setReinstateTarget(null); load(); }
    else showToast(res.error?.message || 'Failed to reinstate');
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <p className="text-xs text-t3">Click a row to open their account.</p>
        <button onClick={() => setUploadOpen(v => !v)}
          className="px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-border text-t2 hover:border-navy hover:text-navy transition-colors">
          {uploadOpen ? 'Close' : 'Bulk upload CSV'}
        </button>
      </div>

      {uploadOpen && (
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="text-xs font-bold text-t1">Add creators from a spreadsheet</div>
            <button onClick={downloadTemplate} className="text-xs text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-orange/10 transition-colors">
              Download template CSV
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input type="file" accept=".csv" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(null); }} className="text-xs text-t2" />
            <button onClick={handleUpload} disabled={!file || uploading}
              className="px-4 py-2 bg-navy text-white font-bold text-xs rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {result && (
            <div className="mt-3 p-3 bg-teal-pale rounded-lg text-xs text-teal-deep">
              Added {result.created ?? result.inserted ?? 0}{result.skipped ? ` · skipped ${result.skipped}` : ''}
            </div>
          )}
          {error && <div className="mt-3 p-3 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Total"     value={summary.total}     color="navy" />
          <StatCard label="Approved"  value={summary.approved}  color="teal" />
          <StatCard label="Pending"   value={summary.pending}   color="gold" />
          <StatCard label="Rejected"  value={summary.rejected}  color="red" />
          <StatCard label="Suspended" value={summary.suspended} color="orange" />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }} className="flex gap-2 mb-3">
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Name, handle, phone or city"
          className="flex-1 max-w-sm border border-border rounded-lg px-3 py-2 text-xs bg-white" />
        <button className="px-4 py-2 bg-navy text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity">Search</button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-3 py-2 text-xs text-t3 hover:text-t2">Clear</button>
        )}
      </form>

      <div className="flex gap-2 mb-3 flex-wrap">
        {LIVE_TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-navy text-white' : 'bg-white border border-border text-t2 hover:border-navy hover:text-navy'}`}>
            {t.label}
            {summary && t.key !== 'all' && <span className="ml-1.5 opacity-60">({summary[t.key] || 0})</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.6fr_0.7fr_0.7fr_0.6fr_0.8fr_0.7fr] gap-2 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">
            <div>Creator</div><div>Contact</div><div>City</div><div>INFLX</div><div>Instagram</div><div>YouTube</div><div>Status</div><div>Joined</div><div>Actions</div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-t3 text-sm">Loading...</div>
          ) : influencers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-sm text-t3">{search ? 'No creators matching your search' : `No ${tab === 'all' ? '' : tab + ' '}creators found`}</div>
            </div>
          ) : (
            influencers.map(i => (
              <div key={i.id} onClick={() => router.push(`/admin/influencers/${i.id}`)}
                className="grid grid-cols-[1.6fr_1fr_0.8fr_0.6fr_0.7fr_0.7fr_0.6fr_0.8fr_0.7fr] gap-2 px-4 py-3 border-b border-border last:border-0 items-center cursor-pointer hover:bg-surface2/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-orange-pale flex items-center justify-center text-[10px] font-bold text-orange-deep font-display flex-shrink-0">
                    {(i.full_name || i.name || i.instagram_handle || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-t1 truncate">{i.full_name || i.name || '--'}</div>
                    <div className="text-[10px] text-t3 truncate">
                      @{i.instagram_handle || '--'}{i.youtube_handle && ` · yt/@${String(i.youtube_handle).replace(/^@+/, '')}`}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-t2 truncate">{i.phone || '--'}</div>
                <div className="text-xs text-t2 truncate">{i.city || '--'}</div>
                <div className="text-xs font-semibold text-t1">{fmtLiveNum(i.inflx_followers)}</div>
                <div className="text-xs text-t2">
                  {i.scrape_last_run && i.followers_count != null ? fmtLiveNum(i.followers_count) : <span className="text-t3">--</span>}
                </div>
                <div className="text-xs text-t2">
                  {!i.youtube_handle ? <span className="text-t3">--</span>
                    : !i.youtube_scrape_last_run ? <span className="text-t3 italic text-[10px]">not checked</span>
                    : i.youtube_subscribers == null ? <span className="text-t3 italic text-[10px]">hidden</span>
                    : fmtLiveNum(i.youtube_subscribers)}
                </div>
                <div><LiveStatusBadge status={i.status} /></div>
                <div className="text-xs text-t3">{i.created_at ? new Date(i.created_at).toLocaleDateString('en-IN') : '--'}</div>
                <div onClick={e => e.stopPropagation()}>
                  {i.status === 'approved' && (
                    <button onClick={() => { setSuspendTarget(i); setSuspendReason(''); }}
                      className="px-2 py-1 text-[10px] font-bold bg-surface2 text-t3 border border-border rounded-lg hover:bg-red-pale hover:text-red hover:border-red/20 transition-colors">
                      Suspend
                    </button>
                  )}
                  {i.status === 'suspended' && (
                    <button onClick={() => setReinstateTarget(i)}
                      className="px-2 py-1 text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/20 rounded-lg hover:bg-teal hover:text-white transition-colors">
                      Reinstate
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-border text-t2 disabled:opacity-40">Previous</button>
          <span className="text-xs text-t3">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-border text-t2 disabled:opacity-40">Next</button>
        </div>
      )}
      <p className="text-[10px] text-t3 mt-2">
        Approving or rejecting a NEW signup still happens only in Influencers → Pending
        Verification — that's the one place identity gets decided. Suspend/Reinstate here is a
        different, narrower action: it only ever applies to an already-approved creator, turning
        dashboard access off and back on.
      </p>

      {suspendTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">Suspend Creator</h3>
            <p className="text-xs text-t3 mb-4">{suspendTarget.full_name || suspendTarget.name || suspendTarget.instagram_handle}</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Suspension Reason (required)</label>
              <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="e.g. Repeated content policy violations flagged by brands"
                className="w-full border-2 border-border2 rounded-xl p-3 text-sm text-t1 outline-none focus:border-gold resize-none" rows={3} />
            </div>
            <div className="mb-4 p-3 bg-red-pale border border-red/20 rounded-xl">
              <div className="text-xs text-red font-medium">This creator will be suspended and lose access to their dashboard.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmSuspend} disabled={actionBusy || !suspendReason.trim()}
                className="flex-1 py-2.5 font-bold rounded-xl text-sm disabled:opacity-40 text-white bg-gradient-to-r from-red to-orange">
                {actionBusy ? 'Processing…' : 'Confirm Suspension'}
              </button>
              <button onClick={() => { setSuspendTarget(null); setSuspendReason(''); }} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {reinstateTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">Reinstate Creator</h3>
            <p className="text-xs text-t3 mb-4">{reinstateTarget.full_name || reinstateTarget.name || reinstateTarget.instagram_handle}</p>
            <div className="mb-4 p-3 bg-teal-pale border border-teal/20 rounded-xl">
              <div className="text-xs text-teal-deep font-medium">
                This creator will be restored to approved and regain dashboard access. Their previous
                suspension note will be cleared and they will be notified immediately.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmReinstate} disabled={actionBusy}
                className="flex-1 py-2.5 font-bold rounded-xl text-sm disabled:opacity-40 text-white bg-gradient-to-r from-teal to-teal-deep">
                {actionBusy ? 'Processing…' : 'Confirm Reinstate'}
              </button>
              <button onClick={() => setReinstateTarget(null)} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}

// ─── HANDLE CHECKS tab (item 3b) ──────────────────────────────────────────────
// A changed or newly added Instagram/YouTube handle after approval waits here until an
// admin confirms it belongs to the creator; only then is it measured. Below it, the
// measurement flags (3 failures in a row, monthly budget reached, 500-item ceiling hit),
// each with Measure now. Contract: features/item3b-social-numbers

function HandleChecksTab() {
  const [checks, setChecks] = useState(null);
  const [flags, setFlags] = useState([]);
  const [costs, setCosts] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const [c, f, k] = await Promise.all([adminApi.socialHandleChecks(), adminApi.socialFlags(), adminApi.socialCosts()]);
    setChecks(c.success ? c.data.checks : []);
    setFlags(f.success ? f.data.flags : []);
    setCosts(k.success ? k.data : null);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(kind, id) {
    setBusy(id + kind);
    const r = kind === 'confirm' ? await adminApi.socialConfirmHandle(id)
      : kind === 'reject' ? await adminApi.socialRejectHandle(id, 'Not the creator\'s account')
      : kind === 'measure' ? await adminApi.socialMeasureNow(id)
      : await adminApi.socialResolveFlag(id);
    setBusy('');
    setMsg(r.success ? 'Done' : (r.error?.message || 'Failed'));
    setTimeout(() => setMsg(''), 2500);
    load();
  }
  const openUrl = (u) => u ? <a href={u} target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">{u.replace(/^https?:\/\/(www\.)?/, '')} ↗</a> : <span className="text-t3">—</span>;
  if (checks === null) return <div className="p-8 text-center text-t3 text-sm">Loading…</div>;
  return (
    <div>
      {msg && <div className="mb-3 text-xs font-semibold text-teal-deep">{msg}</div>}
      <div className="bg-white rounded-2xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-2">Pending handle checks <span className="text-t3 font-normal">({checks.length})</span></h3>
        {checks.length === 0 && <div className="text-xs text-t3 italic">Nothing waiting.</div>}
        {checks.map(c => (
          <div key={c.id} className="border-t border-border py-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 text-xs">
            <div>
              <div className="font-bold text-t1">{c.creator_name} <span className="text-t3 font-normal capitalize">· {c.platform}</span></div>
              <div className="mt-1"><HandleChange platform={c.platform} from={c.old_handle} to={c.handle_norm} /></div>
              <div className="text-t2 mt-0.5">Open: old {openUrl(c.old_url)} <span className="text-t3">·</span> new {openUrl(c.channel_url)}</div>
              <div className="text-t3 mt-1">Asked {new Date(c.created_at).toLocaleString('en-IN')}</div>
            </div>
            <div className="flex gap-2 items-start">
              <button onClick={() => act('confirm', c.id)} disabled={!!busy} className="px-3 py-1.5 bg-teal-pale text-teal-deep font-bold rounded-lg">Confirm</button>
              <button onClick={() => act('reject', c.id)} disabled={!!busy} className="px-3 py-1.5 bg-red-pale text-red font-bold rounded-lg">Reject</button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-border p-5 mb-4">
        <h3 className="font-display text-sm font-bold text-t1 mb-2">Measurement flags <span className="text-t3 font-normal">({flags.length})</span></h3>
        {flags.length === 0 && <div className="text-xs text-t3 italic">No open flags.</div>}
        {flags.map(f => (
          <div key={f.id} className="border-t border-border py-3 flex items-start justify-between gap-2 text-xs">
            <div>
              <div className="font-bold text-t1">{f.kind === 'failing_3' ? '3 failures in a row' : f.kind === 'budget' ? 'Monthly Apify budget reached' : 'Safety ceiling hit'}{f.creator_name ? ` · ${f.creator_name} (${f.platform} @${f.handle_norm})` : ''}</div>
              <div className="text-t3 mt-1">{new Date(f.created_at).toLocaleString('en-IN')} · {JSON.stringify(f.detail)}</div>
            </div>
            <div className="flex gap-2">
              {f.account_id && <button onClick={() => act('measure', f.account_id)} disabled={!!busy} className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 font-bold rounded-lg">↻ Measure now</button>}
              <button onClick={() => act('resolve', f.id)} disabled={!!busy} className="px-3 py-1.5 bg-surface2 text-t2 font-bold rounded-lg">Resolve</button>
            </div>
          </div>
        ))}
      </div>
      {costs && (
        <div className="text-xs text-t2">Apify this month ({costs.month}): <b>${Number(costs.accountMonthUsd ?? costs.socialRunsUsd ?? 0).toFixed(2)}</b> of ${costs.budgetUsd} budget
          {costs.byPlatform && costs.byPlatform.length > 0 && <span className="text-t3"> — social runs: {costs.byPlatform.map(p => `${p.platform} $${p.usd.toFixed(2)} (${p.runs} runs)`).join(', ')}</span>}
        </div>
      )}
    </div>
  );
}

// ─── page shell ─────────────────────────────────────────────────────────────

function InfluencersPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tabKey = TABS.find(t => t.key === params.get('tab'))?.key || 'leads';
  const openAddLead = params.get('add') === '1';

  function setTab(key) {
    router.push(`/admin/influencers?tab=${key}`);
  }
  function clearAddLeadParam() {
    router.replace(`/admin/influencers?tab=leads`);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-extrabold text-t1">Influencers</h1>
          <p className="text-xs text-t3 mt-0.5">Every creator, from first scrape to live on the platform — one pipeline, four stages.</p>
        </div>
      </div>

      <div className="flex border-b border-border mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${tabKey === t.key ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tabKey === 'leads' && <LeadsTab openAddLead={openAddLead} onOpenAddLeadHandled={clearAddLeadParam} />}
      {tabKey === 'invited' && <InvitedTab />}
      {tabKey === 'pending' && <PendingVerificationTab />}
      {tabKey === 'live' && <LiveTab />}
      {tabKey === 'handles' && <HandleChecksTab />}
    </div>
  );
}

export default function InfluencersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-t3 text-sm">Loading…</div>}>
      <InfluencersPageInner />
    </Suspense>
  );
}
