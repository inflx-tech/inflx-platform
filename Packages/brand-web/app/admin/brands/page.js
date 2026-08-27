'use client';

/**
 * Admin -> Brands.
 * Contract: features/admin-people-pipeline
 *
 * Same regroup as Influencers (see `../influencers/page.js`): one pipeline instead of
 * scattered screens. This page used to be only the "Live" directory with an inline
 * approve/reject/suspend modal. It now hosts three tabs — Leads (was Marketing ->
 * Triage, brand rows), Pending Verification (was the brand half of /admin/approvals),
 * and Live (this page's original content, decision modal removed — read-only status
 * badge only). Pending Verification is now the ONLY place a brand account gets
 * approved or rejected.
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, marketingApi, getStoredUser } from '../../../lib/api';

const TABS = [
  { key: 'leads',   label: 'Leads' },
  { key: 'pending', label: 'Pending Verification' },
  { key: 'live',    label: 'Live' },
];

function LiveStatusBadge({ status }) {
  const cfg = {
    approved:  'bg-teal-pale text-teal-deep',
    pending:   'bg-gold-pale text-yellow-700',
    rejected:  'bg-red-pale text-red',
    suspended: 'bg-surface2 text-t3',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status}
    </span>
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

function ChannelDots({ phone, email, whatsapp }) {
  return (
    <div className="flex gap-1 items-center">
      <span className={`text-[10px] ${phone ? 'opacity-100' : 'opacity-20'}`} title={phone || 'no phone'}>📞</span>
      <span className={`text-[10px] ${email ? 'opacity-100' : 'opacity-20'}`} title={email || 'no email'}>✉️</span>
      <span className={`text-[10px] ${whatsapp ? 'opacity-100' : 'opacity-20'}`} title={whatsapp || 'no whatsapp'}>💬</span>
    </div>
  );
}

function StatCard({ label, value, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600', red: 'text-red' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'}`}>{value}</div>
    </div>
  );
}

// ─── Add Lead modal (folded in from the old /admin/marketing/add) ─────────────

function AddLeadModal({ onClose, onCreated }) {
  const [handle, setHandle] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);

  async function submit(force_action) {
    setSubmitting(true);
    setError(null);
    const payload = {
      target_type: 'brand',
      handle, business_name: businessName,
      city, state: stateVal,
      industry, sub_industry: subIndustry,
      phone, email, whatsapp, website,
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
        <h3 className="font-display text-base font-bold text-t1 mb-1">Add Lead — Brand</h3>
        <p className="text-xs text-t3 mb-4">Paste a handle to start enrichment. Inflx will scrape, score, and add it to this list within 2-3 minutes.</p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input placeholder="Instagram handle *" value={handle} onChange={e => setHandle(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs col-span-2 font-mono" />
          <input placeholder="Business name" value={businessName} onChange={e => setBusinessName(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs col-span-2" />
          <input placeholder="City" value={city} onChange={e => setCity(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="State" value={stateVal} onChange={e => setStateVal(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Industry" value={industry} onChange={e => setIndustry(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Sub-industry" value={subIndustry} onChange={e => setSubIndustry(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="WhatsApp (if different)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
          <input placeholder="Website" value={website} onChange={e => setWebsite(e.target.value)}
            className="border border-border2 rounded-lg px-3 py-2 text-xs" />
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

// ─── LEADS tab (filtered to target_type=brand) ─────────────────────────────

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
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('priority_score_desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState({ cities: [], industries: [], sub_industries: [], brand_tiers: [] });
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
      target_type: 'brand',
      status, min_score: minScore, city,
      category: industry, sub_category: subIndustry, tier,
      search, sort, page, limit,
    });
    setLoading(false);
    if (res.success) {
      setRows(Array.isArray(res.data) ? res.data : []);
      setTotal(res.meta?.total || 0);
    }
  }, [status, minScore, city, industry, subIndustry, tier, search, sort, page, limit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openAddLead) { setShowAdd(true); onOpenAddLeadHandled(); }
  }, [openAddLead, onOpenAddLeadHandled]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  function clearAll() {
    setStatus(''); setMinScore(''); setCity(''); setIndustry(''); setSubIndustry(''); setTier(''); setSearch(''); setSearchInput(''); setPage(1);
  }
  const hasFilters = status || minScore || city || industry || subIndustry || tier || search;

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
          <select value={industry} onChange={e => { setIndustry(e.target.value); setSubIndustry(''); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[160px]">
            <option value="">All industries</option>
            {opts.industries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={subIndustry} onChange={e => { setSubIndustry(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white max-w-[160px]">
            <option value="">All sub-industries</option>
            {opts.sub_industries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tier} onChange={e => { setTier(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white">
            <option value="">All tiers</option>
            {opts.brand_tiers.map(t => <option key={t} value={t}>{t}</option>)}
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
                <th className="text-left px-3 py-2 font-bold">Business</th>
                <th className="text-left px-3 py-2 font-bold">City</th>
                <th className="text-left px-3 py-2 font-bold">Industry</th>
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
                  <td className="px-3 py-2 text-right tabular-nums font-bold">{Number(r.priority_score || 0).toFixed(0)}</td>
                  <td className="px-3 py-2"><LeadStatusBadge status={r.outreach_status} /></td>
                  <td className="px-3 py-2"><ChannelDots phone={r.phone} email={r.email} whatsapp={r.whatsapp} /></td>
                  <td className="px-3 py-2 text-right">
                    <a href={`/admin/marketing/leads/brand/${r.id}`} className="text-orange font-semibold text-[11px] hover:underline">Open →</a>
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

// ─── PENDING VERIFICATION tab (was the brand half of /admin/approvals) ─────
// The ONLY place a brand account gets approved or rejected.

const REJECTION_REASONS = [
  'Incomplete business information',
  'Invalid or unverifiable GST number',
  'Blurry or invalid ID documents',
  'Business category not supported',
  'Duplicate account',
  'Other',
];

function Fact({ label, value, missing = 'Not given', href, mono }) {
  const has = value != null && value !== '';
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-t3 mb-0.5">{label}</div>
      {has ? (
        href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className={`text-xs font-medium text-navy hover:underline truncate block ${mono ? 'tabular-nums' : ''}`}>{value} ↗</a>
        ) : (
          <div className={`text-xs font-medium text-t1 truncate ${mono ? 'tabular-nums' : ''}`}>{value}</div>
        )
      ) : (
        <div className="text-xs text-t3 italic truncate">{missing}</div>
      )}
    </div>
  );
}

function PendingVerificationTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getBrandQueue();
    setLoading(false);
    if (res.success) setRows(res.data?.brands || res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); }

  async function handleAction(id, status, reason) {
    const body = { status };
    if (reason) body.reason = reason;
    const res = await adminApi.updateBrandStatus(id, body);
    if (res.success) { showToast(`Brand ${status} successfully`); load(); }
    else showToast(res.error?.message || 'Action failed');
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-border p-4">
        <p className="text-xs text-t3">
          Everything each applicant supplied, so the decision can be made here. This is the
          only place a brand account gets approved.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-3xl mb-3">✅</div>
            <div className="text-sm font-bold text-t1">Queue is empty</div>
            <div className="text-xs text-t3 mt-1">No pending brand applications</div>
          </div>
        ) : (
          <div className="px-3">
            {rows.map(item => (
              <PendingBrandRow key={item.id} item={item} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toastMsg}</div>
      )}
    </div>
  );
}

function PendingBrandRow({ item, onAction }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    await onAction(item.id, 'approved', null);
    setLoading(false);
  }

  async function reject() {
    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason) return;
    setLoading(true);
    await onAction(item.id, 'rejected', finalReason);
    setLoading(false);
    setShowReject(false);
  }

  const title = item.business_name || item.brand_name || item.name;
  const place = [item.city, item.state].filter(Boolean).join(', ');
  const submitted = item.created_at || item.submitted_at;
  const days = submitted ? Math.floor((Date.now() - new Date(submitted).getTime()) / 86400000) : null;

  return (
    <div className="border-b border-border last:border-0 py-3.5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold font-display flex-shrink-0 bg-navy-pale text-navy">
          {(title || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-t1 truncate">{title || '—'}</div>
          <div className="text-[10px] text-t3">
            {item.category || 'No category'} · applied {submitted ? new Date(submitted).toLocaleDateString('en-IN') : '—'}
            {days != null && days > 0 && ` · waiting ${days} day${days === 1 ? '' : 's'}`}
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gold-pale text-yellow-700 border-gold/20">
          {item.user_status || item.status}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a href={`/admin/brands/${item.id}`} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface2 text-t2 border border-border2 hover:border-navy hover:text-navy transition-colors">Full record</a>
          <button onClick={approve} disabled={loading}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/25 hover:bg-teal hover:text-white transition-colors disabled:opacity-40">
            {loading ? '...' : 'Approve'}
          </button>
          <button onClick={() => setShowReject(!showReject)} disabled={loading}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-pale text-red border border-red/25 hover:bg-red hover:text-white transition-colors">
            Reject
          </button>
        </div>
      </div>

      <div className="ml-12 bg-surface2/60 border border-border2/60 rounded-xl px-3.5 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
          <Fact label="Contact person" value={item.name} />
          <Fact label="Phone" value={item.phone} missing="No number on file" mono />
          <Fact label="Where" value={place} missing="Not stated" />
          <Fact label="GST number" value={item.gstin} missing="Not supplied" mono />
          <Fact label="Address" value={item.address_line} missing="Not supplied" />
          <Fact label="Pincode" value={item.pincode} missing="Not supplied" mono />
          <Fact label="Category" value={item.category} missing="Not stated" />
          <Fact label="Email" value={item.email} missing="Not supplied" />
        </div>
      </div>

      {showReject && (
        <div className="ml-12 mt-3">
          <div className="bg-red-pale/50 border border-red/10 rounded-xl p-3">
            <div className="text-xs font-bold text-t2 mb-2">Select rejection reason</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REJECTION_REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-colors ${reason === r ? 'bg-red text-white border-red' : 'bg-white text-t2 border-border2 hover:border-red hover:text-red'}`}>
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Enter custom reason..."
                className="w-full border border-border2 rounded-lg p-2 text-xs text-t1 outline-none focus:border-red resize-none" rows={2} />
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={reject} disabled={!reason || (reason === 'Other' && !customReason)} className="px-3 py-1.5 bg-red text-white text-xs font-bold rounded-lg disabled:opacity-40">Confirm Reject</button>
              <button onClick={() => setShowReject(false)} className="px-3 py-1.5 bg-surface2 text-t2 text-xs font-bold rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LIVE tab (this page's original directory content, decision modal removed) ─

const LIVE_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'approved',  label: 'Approved' },
  { key: 'pending',   label: 'Pending' },
  { key: 'rejected',  label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

function LiveTab() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [brands, setBrands] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [feeModal, setFeeModal] = useState(null);
  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  const [toast, setToast] = useState('');

  // Suspend / Reinstate — already-approved (or already-suspended) brands
  // only. Not a second approval path: the buttons only ever render for
  // status === 'approved' (Suspend) or status === 'suspended' (Reinstate),
  // so a 'pending' row gets neither — Pending Verification stays the only
  // place a new signup gets decided.
  const [suspendTarget, setSuspendTarget] = useState(null); // brand row
  const [suspendReason, setSuspendReason] = useState('');
  const [reinstateTarget, setReinstateTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const canFee = user?.admin_role === 'finance' || user?.admin_role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getBrands(tab, search, page);
    setLoading(false);
    if (res.success) {
      setBrands(res.data?.brands || []);
      setSummary(res.data?.summary || null);
      const total = res.meta?.total || 0;
      const limit = res.meta?.limit || 20;
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    }
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  function handleSearch(e) { e.preventDefault(); setPage(1); setSearch(searchInput); }

  async function handleSaveFee() {
    if (!feeModal) return;
    const pct = parseFloat(feeInput);
    if (isNaN(pct) || pct < 0 || pct > 50) { showToast('Enter a valid fee 0-50%'); return; }
    setSavingFee(true);
    const res = await adminApi.setBrandPlatformFee(feeModal.id, pct);
    setSavingFee(false);
    if (res.success) { showToast(`Platform fee updated to ${res.data.platform_fee_pct}%`); setFeeModal(null); setFeeInput(''); load(); }
    else showToast(res.error?.message || 'Failed to update fee');
  }

  async function confirmSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setActionBusy(true);
    const res = await adminApi.updateBrandStatus(suspendTarget.id, { status: 'suspended', reason: suspendReason.trim() });
    setActionBusy(false);
    if (res.success) { showToast('Brand suspended'); setSuspendTarget(null); setSuspendReason(''); load(); }
    else showToast(res.error?.message || 'Failed to suspend');
  }

  async function confirmReinstate() {
    if (!reinstateTarget) return;
    setActionBusy(true);
    const res = await adminApi.updateBrandStatus(reinstateTarget.id, { status: 'approved' });
    setActionBusy(false);
    if (res.success) { showToast('Brand reinstated'); setReinstateTarget(null); load(); }
    else showToast(res.error?.message || 'Failed to reinstate');
  }

  function fmtMoney(p) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0); }
  function fmtDate(d) { if (!d) return '--'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-t3">All registered brands on the platform. Click a row to open their account.</p>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, phone, city, category..."
            className="w-60 border border-border2 rounded-lg px-3 py-1.5 text-xs text-t1 outline-none focus:border-navy" />
          <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-navy text-white rounded-lg">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="px-2 py-1.5 text-xs text-t3 hover:text-t1">Clear</button>
          )}
        </form>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <StatCard label="Total Brands" value={summary.total} color="navy" />
          <StatCard label="Approved" value={summary.approved} color="teal" />
          <StatCard label="Pending" value={summary.pending} color="gold" />
          <StatCard label="Rejected" value={summary.rejected} color="red" />
          <StatCard label="Suspended" value={summary.suspended} color="orange" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {LIVE_TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-navy text-white' : 'bg-white border border-border text-t2 hover:border-navy hover:text-navy'}`}>
            {t.label}
            {summary && t.key !== 'all' && <span className="ml-1.5 opacity-60">({summary[t.key] || 0})</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.6fr_0.6fr_0.6fr_0.7fr_90px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">
          <div>Brand</div><div>Contact</div><div>Category</div><div>City</div><div>Status</div><div>Wallet</div><div>Fee</div><div>Joined</div><div>Actions</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : brands.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm text-t3">{search ? 'No brands matching your search' : `No ${tab === 'all' ? '' : tab + ' '}brands found`}</div>
          </div>
        ) : (
          brands.map(b => (
            <div key={b.id} onClick={() => router.push(`/admin/brands/${b.id}`)}
              className="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.6fr_0.6fr_0.6fr_0.7fr_90px] gap-2 px-4 py-3 border-b border-border last:border-0 items-center cursor-pointer hover:bg-surface2/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-navy-pale flex items-center justify-center text-[10px] font-bold text-navy font-display flex-shrink-0">
                  {(b.business_name || '').slice(0, 2).toUpperCase()}
                </div>
                <div className="text-xs font-medium text-t1 truncate">{b.business_name}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-t1 truncate">{b.contact_name}</div>
                <div className="text-[10px] text-t3 truncate">{b.phone}</div>
              </div>
              <div className="text-xs text-t2 truncate capitalize">{b.category || '--'}</div>
              <div className="text-xs text-t2 truncate">{b.city || '--'}</div>
              <div><LiveStatusBadge status={b.status} /></div>
              <div className="font-bold text-t1 font-display text-xs">{fmtMoney(b.wallet_balance)}</div>
              <div className="text-xs text-t2">{b.platform_fee_pct != null ? `${b.platform_fee_pct}%` : '8%'}</div>
              <div className="text-[10px] text-t3">{fmtDate(b.created_at)}</div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {b.status === 'approved' && (
                  <button onClick={() => { setSuspendTarget(b); setSuspendReason(''); }}
                    className="px-2 py-1 text-[10px] font-bold bg-surface2 text-t3 border border-border rounded-lg hover:bg-red-pale hover:text-red hover:border-red/20 transition-colors">
                    Suspend
                  </button>
                )}
                {b.status === 'suspended' && (
                  <button onClick={() => setReinstateTarget(b)}
                    className="px-2 py-1 text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/20 rounded-lg hover:bg-teal hover:text-white transition-colors">
                    Reinstate
                  </button>
                )}
                {canFee && (
                  <button onClick={() => { setFeeModal(b); setFeeInput(String(b.platform_fee_pct ?? 8)); }}
                    className="px-2 py-1 text-[10px] font-bold bg-gold-pale text-yellow-700 border border-gold/20 rounded-lg hover:bg-gold hover:text-white transition-colors"
                    title="Set platform fee">
                    Fee
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg disabled:opacity-30">Prev</button>
          <span className="text-xs text-t3">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg disabled:opacity-30">Next</button>
        </div>
      )}

      <p className="text-[10px] text-t3 mt-2">
        Approving or rejecting a NEW signup still happens only in Brands → Pending Verification —
        that's the one place identity gets decided. Suspend/Reinstate here is a different,
        narrower action: it only ever applies to an already-approved brand, turning dashboard
        access off and back on. Fee override stays available (finance-only), unrelated to
        approval status.
      </p>

      {suspendTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">Suspend Brand</h3>
            <p className="text-xs text-t3 mb-4">{suspendTarget.business_name}</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Suspension Reason (required)</label>
              <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="e.g. Repeated policy violations — wallet flagged for review"
                className="w-full border-2 border-border2 rounded-xl p-3 text-sm text-t1 outline-none focus:border-gold resize-none" rows={3} />
            </div>
            <div className="mb-4 p-3 bg-red-pale border border-red/20 rounded-xl">
              <div className="text-xs text-red font-medium">This brand will be suspended and lose access to their dashboard.</div>
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
            <h3 className="font-display text-base font-bold text-t1 mb-1">Reinstate Brand</h3>
            <p className="text-xs text-t3 mb-4">{reinstateTarget.business_name}</p>
            <div className="mb-4 p-3 bg-teal-pale border border-teal/20 rounded-xl">
              <div className="text-xs text-teal-deep font-medium">
                This brand will be restored to approved and regain dashboard access. Their previous
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

      {feeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">Set Platform Fee</h3>
            <p className="text-xs text-t3 mb-4">{feeModal.business_name} — current: {feeModal.platform_fee_pct ?? 8}%</p>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1">
                <input type="number" value={feeInput} onChange={e => setFeeInput(e.target.value)} placeholder="8" min="0" max="50" step="0.5"
                  className="flex-1 px-3 py-2.5 text-sm outline-none" />
                <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveFee} disabled={savingFee || !feeInput}
                className="flex-1 py-2.5 bg-navy text-white font-bold rounded-xl text-sm disabled:opacity-40">
                {savingFee ? 'Saving...' : 'Save Fee'}
              </button>
              <button onClick={() => { setFeeModal(null); setFeeInput(''); }} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}

// ─── page shell ─────────────────────────────────────────────────────────────

function BrandsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tabKey = TABS.find(t => t.key === params.get('tab'))?.key || 'leads';
  const openAddLead = params.get('add') === '1';

  function setTab(key) { router.push(`/admin/brands?tab=${key}`); }
  function clearAddLeadParam() { router.replace(`/admin/brands?tab=leads`); }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-extrabold text-t1">Brands</h1>
          <p className="text-xs text-t3 mt-0.5">Every business, from first scrape to live on the platform.</p>
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
      {tabKey === 'pending' && <PendingVerificationTab />}
      {tabKey === 'live' && <LiveTab />}
    </div>
  );
}

export default function BrandsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-t3 text-sm">Loading…</div>}>
      <BrandsPageInner />
    </Suspense>
  );
}
